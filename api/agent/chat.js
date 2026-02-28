// api/agent/chat.js
import { getCorsHeaders } from '../_cors.js';

export const config = { runtime: 'edge' };

async function collectContext() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const context = { markets: [], sectors: [] };
  if (!url || !token) return context;

  try {
    const pipeline = [
      ['GET', 'market:quotes:v1'],
      ['GET', 'market:sectors:v1'],
    ];
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const quotes = data[0]?.result ? JSON.parse(data[0].result) : null;
      const sectors = data[1]?.result ? JSON.parse(data[1].result) : null;
      if (quotes?.quotes) {
        context.markets = quotes.quotes
          .slice(0, 12)
          .map(q => `${q.display ?? q.symbol}: ${q.price != null ? q.price.toFixed(2) : 'N/A'} (${q.change != null ? (q.change >= 0 ? '+' : '') + q.change.toFixed(2) + '%' : 'N/A'})`);
      }
      if (sectors?.sectors) {
        context.sectors = sectors.sectors
          .map(s => `${s.symbol}: ${s.change != null ? (s.change >= 0 ? '+' : '') + s.change.toFixed(2) + '%' : 'N/A'}`);
      }
    }
  } catch { /* best-effort */ }

  return context;
}

function buildSystemPrompt(mode, context) {
  const now = new Date().toUTCString();
  const marketsBlock = context.markets.length
    ? `\nMarket Snapshot:\n${context.markets.join(' | ')}`
    : '';
  const sectorsBlock = context.sectors.length
    ? `\nSector Performance:\n${context.sectors.join(' | ')}`
    : '';

  const base = `You are 007 ANALYST, a senior geopolitical and financial intelligence analyst embedded in the UNVRS 007 dashboard. Current UTC time: ${now}.${marketsBlock}${sectorsBlock}

Respond concisely and with authority. Use bullet points for lists. Highlight key risks and opportunities. When discussing markets, always connect to geopolitical drivers.`;

  if (mode === 'briefing') {
    return base + `\n\nGenerate a structured MORNING BRIEFING with these sections:
## 🌍 GEOPOLITICAL PULSE
3-5 key developments with risk assessment (🔴 Critical / 🟡 Elevated / 🟢 Stable)

## 📈 MARKET SIGNALS
Key market moves and their geopolitical drivers. Note any divergences.

## ⚡ WATCH LIST
Top 3 situations to monitor in the next 24-48h with specific triggers.

## 💡 STRATEGIC INSIGHT
One contrarian or non-obvious observation.

Be concise. Total length: 400-600 words.`;
  }

  if (mode === 'signals') {
    return base + `\n\nAnalyze the current market data and identify GEOPOLITICAL MARKET SIGNALS:
## 🎯 ACTIVE SIGNALS
For each notable market move, identify: trigger event, affected assets, risk direction, time horizon.

## 📊 CORRELATION MATRIX
Which geopolitical themes are currently driving which asset classes?

## 🚨 RISK ALERTS
Any unusual correlations or potential market dislocations?

Be specific with numbers and asset names.`;
  }

  return base + "\n\nAnswer the user's question directly and thoroughly. If asked about current events, use the market data provided as context.";
}

async function streamFromAnthropic(messages, systemPrompt, corsHeaders) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        stream: false,
      }),
    });
  } catch {
    return null;
  }

  if (!resp.ok) return null;

  let fullText = '';
  try {
    const data = await resp.json();
    fullText = data?.content?.[0]?.text ?? '';
  } catch {
    return null;
  }

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        if (fullText) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fullText })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    }
  );
}

async function streamFromGroq(messages, systemPrompt, corsHeaders) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  let resp;
  try {
    resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 1024,
        stream: false,
      }),
    });
  } catch {
    return null;
  }

  if (!resp.ok) return null;

  let fullText = '';
  try {
    const data = await resp.json();
    fullText = data?.choices?.[0]?.message?.content ?? '';
  } catch {
    return null;
  }

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        if (fullText) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fullText })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    }
  );
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { message, history = [], mode = 'chat' } = body;

  const VALID_MODES = ['chat', 'briefing', 'signals'];
  if (!VALID_MODES.includes(mode)) {
    return new Response(JSON.stringify({ error: 'Invalid mode' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (message && message.length > 4000) {
    return new Response(JSON.stringify({ error: 'Message too long (max 4000 chars)' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!message && mode === 'chat') {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const context = await collectContext();
  const systemPrompt = buildSystemPrompt(mode, context);

  const userMessage = mode === 'chat'
    ? message
    : mode === 'briefing'
      ? 'Generate the morning briefing now.'
      : 'Analyze current market signals.';

  const messages = [
    ...(history || []).slice(-6),
    { role: 'user', content: userMessage },
  ];

  const streaming =
    (await streamFromAnthropic(messages, systemPrompt, corsHeaders)) ??
    (await streamFromGroq(messages, systemPrompt, corsHeaders));

  if (!streaming) {
    return new Response(JSON.stringify({ error: 'No LLM provider available' }), {
      status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return streaming;
}
