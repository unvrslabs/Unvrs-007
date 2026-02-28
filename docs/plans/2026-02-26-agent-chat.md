# UNVRS 007 Agent Chat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI analyst chat sidebar (Claude Opus 4.6) to the worldmonitor dashboard, accessible from a header button, supporting chat, daily briefing, and market signals modes.

**Architecture:** New Vercel Edge streaming endpoint `/api/agent/chat.js` collects live context from Redis cache (already populated by existing endpoints), then streams responses from `claude-opus-4-6` via Server-Sent Events. Frontend `AgentSidebar.ts` component mirrors the `SearchModal` pattern — instantiated in `App.ts`, mounted from `panel-layout.ts`, opened via event-handler button click.

**Tech Stack:** Vercel Edge Functions (JS), Anthropic SDK (REST, no npm package needed), Upstash Redis (existing), TypeScript frontend, SSE streaming.

---

### Task 1: Commit all pending fixes before adding new code

**Files:**
- Modify: `api/_cors.js`, `server/cors.ts`, `server/worldmonitor/market/v1/_shared.ts`, `server/worldmonitor/market/v1/get-sector-summary.ts`, `server/worldmonitor/market/v1/list-market-quotes.ts`, `src/config/variants/full.ts`

**Step 1: Stage and commit the existing fixes**

```bash
cd worldmonitor
git add api/_cors.js server/cors.ts \
  server/worldmonitor/market/v1/_shared.ts \
  server/worldmonitor/market/v1/get-sector-summary.ts \
  server/worldmonitor/market/v1/list-market-quotes.ts \
  src/config/variants/full.ts
git commit -m "fix: CORS whitelist, Finnhub rate-limit batching, panel order"
git push
```

Expected: Vercel auto-deploys. CORS 403 errors on world.unvrslabs.dev go away.

---

### Task 2: Create the streaming chat API endpoint

**Files:**
- Create: `api/agent/chat.js`

**Step 1: Create the file with CORS + auth skeleton**

```js
// api/agent/chat.js
import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';

export const config = { runtime: 'edge' };

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
  if (!message && mode === 'chat') {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
```

**Step 2: Verify skeleton deploys**

```bash
git add api/agent/chat.js
git commit -m "feat(agent): add chat endpoint skeleton"
git push
```

Then test: `curl -X POST https://world.unvrslabs.dev/api/agent/chat -H "Content-Type: application/json" -d '{"message":"hi","mode":"chat"}'`
Expected: `{"ok":true}`

**Step 3: Add context collection helper (reads from Redis + fallback)**

Add this function inside `api/agent/chat.js` before the handler:

```js
async function collectContext() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const context = { headlines: [], markets: [], sectors: [] };
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
```

**Step 4: Add system prompt builder**

```js
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

  return base + '\n\nAnswer the user\'s question directly and thoroughly. If asked about current events, use the market data provided as context.';
}
```

**Step 5: Add Anthropic streaming call + Groq fallback**

```js
async function streamFromAnthropic(messages, systemPrompt, corsHeaders) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
      stream: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('Anthropic error:', resp.status, err);
    return null;
  }

  // Transform Anthropic SSE → simple text/event-stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.delta?.text;
            if (text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      await writer.write(encoder.encode('data: [DONE]\n\n'));
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
    },
  });
}

async function streamFromGroq(messages, systemPrompt, corsHeaders) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1024,
      stream: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) return null;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.choices?.[0]?.delta?.content;
            if (text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
    },
  });
}
```

**Step 6: Wire everything into the handler**

Replace the `return new Response(JSON.stringify({ ok: true })` stub with:

```js
  const context = await collectContext();
  const systemPrompt = buildSystemPrompt(mode, context);

  // Build message array for LLM
  const userMessage = mode === 'chat'
    ? message
    : mode === 'briefing'
      ? 'Generate the morning briefing now.'
      : 'Analyze current market signals.';

  const messages = [
    ...(history || []).slice(-6), // keep last 3 turns
    { role: 'user', content: userMessage },
  ];

  // Try Anthropic first, then Groq
  const streaming =
    (await streamFromAnthropic(messages, systemPrompt, corsHeaders)) ??
    (await streamFromGroq(messages, systemPrompt, corsHeaders));

  if (!streaming) {
    return new Response(JSON.stringify({ error: 'No LLM provider available' }), {
      status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return streaming;
```

**Step 7: Commit and test the full endpoint**

```bash
git add api/agent/chat.js
git commit -m "feat(agent): streaming chat endpoint with Anthropic + Groq fallback"
git push
```

Test streaming:
```bash
curl -N -X POST https://world.unvrslabs.dev/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the geopolitical risk today?","mode":"chat"}'
```
Expected: SSE stream of `data: {"text":"..."}` lines ending with `data: [DONE]`

---

### Task 3: Create AgentSidebar frontend component

**Files:**
- Create: `src/components/AgentSidebar.ts`

**Step 1: Create the component file**

```typescript
// src/components/AgentSidebar.ts
import { escapeHtml } from '@/utils/sanitize';

type AgentMode = 'chat' | 'briefing' | 'signals';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class AgentSidebar {
  private overlay: HTMLElement | null = null;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private history: Message[] = [];
  private mode: AgentMode = 'chat';
  private isStreaming = false;

  open(): void {
    if (this.overlay) { this.overlay.classList.add('open'); this.inputEl?.focus(); return; }
    this.render();
    requestAnimationFrame(() => this.overlay?.classList.add('open'));
    this.inputEl?.focus();
  }

  close(): void {
    this.overlay?.classList.remove('open');
  }

  destroy(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private render(): void {
    const el = document.createElement('div');
    el.className = 'agent-sidebar';
    el.innerHTML = `
      <div class="agent-sidebar-backdrop"></div>
      <div class="agent-sidebar-panel">
        <div class="agent-sidebar-header">
          <div class="agent-tabs">
            <button class="agent-tab active" data-mode="chat">CHAT</button>
            <button class="agent-tab" data-mode="briefing">BRIEFING</button>
            <button class="agent-tab" data-mode="signals">SIGNALS</button>
          </div>
          <button class="agent-close-btn" title="Close">✕</button>
        </div>
        <div class="agent-messages"></div>
        <div class="agent-input-row">
          <textarea class="agent-input" placeholder="Ask the analyst…" rows="2"></textarea>
          <button class="agent-send-btn">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.overlay = el;
    this.messagesEl = el.querySelector('.agent-messages');
    this.inputEl = el.querySelector('.agent-input');
    this.sendBtn = el.querySelector('.agent-send-btn');

    el.querySelector('.agent-sidebar-backdrop')?.addEventListener('click', () => this.close());
    el.querySelector('.agent-close-btn')?.addEventListener('click', () => this.close());

    el.querySelectorAll('.agent-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as AgentMode;
        this.switchMode(mode);
      });
    });

    this.sendBtn?.addEventListener('click', () => this.handleSend());
    this.inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
    });

    document.addEventListener('keydown', this.handleEsc);

    // Auto-generate briefing/signals on tab open
    if (this.mode !== 'chat') this.generateAutoMode();
  }

  private switchMode(mode: AgentMode): void {
    this.mode = mode;
    this.overlay?.querySelectorAll('.agent-tab').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });
    // Show/hide input row for non-chat modes
    const inputRow = this.overlay?.querySelector('.agent-input-row') as HTMLElement | null;
    if (inputRow) inputRow.style.display = mode === 'chat' ? '' : 'none';

    if (mode !== 'chat') this.generateAutoMode();
  }

  private async generateAutoMode(): Promise<void> {
    if (this.isStreaming) return;
    this.clearMessages();
    this.appendSystemMessage(this.mode === 'briefing' ? 'Generating morning briefing…' : 'Analyzing market signals…');
    await this.stream('', this.mode);
  }

  private async handleSend(): Promise<void> {
    if (this.isStreaming) return;
    const text = this.inputEl?.value.trim();
    if (!text) return;
    if (this.inputEl) this.inputEl.value = '';
    this.appendMessage('user', text);
    await this.stream(text, 'chat');
  }

  private async stream(message: string, mode: AgentMode): Promise<void> {
    this.isStreaming = true;
    if (this.sendBtn) this.sendBtn.disabled = true;

    const msgEl = this.appendMessage('assistant', '');
    const contentEl = msgEl.querySelector('.agent-msg-content') as HTMLElement;

    try {
      const resp = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode,
          history: this.history.slice(-6),
        }),
      });

      if (!resp.ok || !resp.body) {
        contentEl.textContent = 'Error: could not reach analyst.';
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) {
              fullText += parsed.text;
              contentEl.innerHTML = this.renderMarkdown(fullText);
              this.messagesEl?.scrollTo(0, this.messagesEl.scrollHeight);
            }
          } catch { /* skip */ }
        }
      }

      // Save to history for multi-turn
      if (mode === 'chat') {
        if (message) this.history.push({ role: 'user', content: message });
        if (fullText) this.history.push({ role: 'assistant', content: fullText });
      }
    } catch (err) {
      contentEl.textContent = 'Connection error.';
      console.error('[Agent]', err);
    } finally {
      this.isStreaming = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
      // Remove "generating…" system message if present
      this.overlay?.querySelector('.agent-msg-system')?.remove();
    }
  }

  private appendMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `agent-msg agent-msg-${role}`;
    el.innerHTML = `<div class="agent-msg-content">${role === 'user' ? escapeHtml(text) : this.renderMarkdown(text)}</div>`;
    this.messagesEl?.appendChild(el);
    this.messagesEl?.scrollTo(0, this.messagesEl.scrollHeight);
    return el;
  }

  private appendSystemMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'agent-msg agent-msg-system';
    el.textContent = text;
    this.messagesEl?.appendChild(el);
  }

  private clearMessages(): void {
    if (this.messagesEl) this.messagesEl.innerHTML = '';
  }

  private renderMarkdown(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, '<ul>$&</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  private handleEsc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };
}
```

**Step 2: Export from components index**

In `src/components/index.ts`, add at the end:
```typescript
export { AgentSidebar } from './AgentSidebar';
```

**Step 3: Commit**

```bash
git add src/components/AgentSidebar.ts src/components/index.ts
git commit -m "feat(agent): AgentSidebar component"
```

---

### Task 4: Wire AgentSidebar into the app

**Files:**
- Modify: `src/app/app-context.ts`
- Modify: `src/app/panel-layout.ts`
- Modify: `src/app/event-handlers.ts`

**Step 1: Add agentSidebar to AppContext**

In `src/app/app-context.ts`:

At the top, add import:
```typescript
import type { AgentSidebar } from '@/components/AgentSidebar';
```

In the `AppContext` interface, after `searchModal`:
```typescript
  agentSidebar: AgentSidebar | null;
```

**Step 2: Add AGENT button to header in panel-layout.ts**

In `src/app/panel-layout.ts`, find the `<div class="header-right">` block.
After `<button class="search-btn" id="searchBtn">...`, add:

```html
<button class="agent-btn" id="agentBtn">⬡ AGENT</button>
```

**Step 3: Initialize AgentSidebar in App.ts**

Find where `ctx.searchModal` is initialized in `src/App.ts` (or wherever the app bootstraps). Add alongside it:

```typescript
import { AgentSidebar } from '@/components/AgentSidebar';
// ...
ctx.agentSidebar = new AgentSidebar();
```

Note: If `App.ts` doesn't import/init components directly, find the file that sets `ctx.searchModal = new SearchModal(...)` and mirror that pattern for `agentSidebar`.

**Step 4: Add event listener in event-handlers.ts**

In `src/app/event-handlers.ts`, inside `setupEventListeners()`, after the `searchBtn` listener:

```typescript
document.getElementById('agentBtn')?.addEventListener('click', () => {
  this.ctx.agentSidebar?.open();
});
```

**Step 5: Add agentSidebar to destroy cleanup**

Find `destroy()` in `src/app/event-handlers.ts` or wherever other modals are destroyed, and add:
```typescript
this.ctx.agentSidebar?.destroy();
this.ctx.agentSidebar = null;
```

**Step 6: Commit**

```bash
git add src/app/app-context.ts src/app/panel-layout.ts src/app/event-handlers.ts src/App.ts
git commit -m "feat(agent): wire AgentSidebar into app header and event handlers"
```

---

### Task 5: Add CSS for AgentSidebar + AGENT button

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add these styles at the end of main.css (before the last `}` if any, or just append)**

```css
/* ── Agent Button ── */
.agent-btn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.agent-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Agent Sidebar ── */
.agent-sidebar {
  position: fixed;
  inset: 0;
  z-index: 1100;
  pointer-events: none;
  display: flex;
  justify-content: flex-end;
}
.agent-sidebar.open {
  pointer-events: auto;
}
.agent-sidebar-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  transition: background 0.25s ease;
}
.agent-sidebar.open .agent-sidebar-backdrop {
  background: rgba(0, 0, 0, 0.4);
}
.agent-sidebar-panel {
  position: relative;
  width: 420px;
  max-width: 100vw;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.agent-sidebar.open .agent-sidebar-panel {
  transform: translateX(0);
}
.agent-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.agent-tabs {
  display: flex;
  gap: 4px;
}
.agent-tab {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.15s ease;
}
.agent-tab:hover {
  color: var(--text);
  background: var(--overlay-light);
}
.agent-tab.active {
  color: var(--accent);
  border-color: var(--border-strong);
  background: var(--overlay-medium);
}
.agent-close-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  line-height: 1;
  transition: color 0.15s;
}
.agent-close-btn:hover { color: var(--text); }

.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
.agent-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.agent-msg-user {
  align-items: flex-end;
}
.agent-msg-user .agent-msg-content {
  background: var(--overlay-medium);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 12px 12px 2px 12px;
  font-size: 12px;
  max-width: 85%;
  text-align: right;
}
.agent-msg-assistant .agent-msg-content {
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
  max-width: 100%;
}
.agent-msg-assistant .agent-msg-content h3 {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--accent);
  margin: 12px 0 4px;
}
.agent-msg-assistant .agent-msg-content h4 {
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  margin: 8px 0 4px;
}
.agent-msg-assistant .agent-msg-content ul {
  padding-left: 16px;
  margin: 4px 0;
}
.agent-msg-assistant .agent-msg-content li {
  margin-bottom: 3px;
}
.agent-msg-assistant .agent-msg-content strong {
  color: var(--text);
}
.agent-msg-assistant .agent-msg-content p {
  margin: 4px 0;
}
.agent-msg-system {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: 8px;
}

.agent-input-row {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-shrink: 0;
}
.agent-input {
  flex: 1;
  background: var(--input-bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  resize: none;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s;
}
.agent-input:focus {
  border-color: var(--border-strong);
}
.agent-send-btn {
  padding: 8px 16px;
  background: var(--overlay-medium);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  white-space: nowrap;
}
.agent-send-btn:hover {
  background: var(--overlay-heavy);
}
.agent-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .agent-btn { display: none; }
  .agent-sidebar-panel { width: 100vw; }
}
```

**Step 2: Commit**

```bash
git add src/styles/main.css
git commit -m "feat(agent): AgentSidebar CSS + agent-btn styles"
```

---

### Task 6: Find exact init location for AgentSidebar and fix any TypeScript errors

**Step 1: Find where searchModal is initialized**

```bash
grep -n "searchModal" src/App.ts src/app/*.ts
```

Note the pattern — `agentSidebar` should be initialized in the same place.

**Step 2: Build the project to catch TS errors**

```bash
npm run build 2>&1 | head -60
```

Fix any TypeScript errors (likely missing `agentSidebar` on the context initializer object).

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(agent): TypeScript fixes for AgentSidebar integration"
git push
```

---

### Task 7: End-to-end verification + final deploy

**Step 1: Open https://world.unvrslabs.dev in browser**

Check: AGENT button visible in header-right (next to Search).

**Step 2: Click AGENT button**

Check: Sidebar slides in from right. Three tabs: CHAT | BRIEFING | SIGNALS.

**Step 3: Test CHAT mode**

Type: "What are the top geopolitical risks right now?"
Expected: Streaming text response from Claude Opus.

**Step 4: Test BRIEFING tab**

Click BRIEFING tab.
Expected: Auto-generates structured briefing with sections (Geopolitical Pulse, Market Signals, Watch List, Strategic Insight).

**Step 5: Test SIGNALS tab**

Click SIGNALS tab.
Expected: Market signal analysis using real Redis-cached market data.

**Step 6: Test ESC and backdrop close**

Press Escape or click outside sidebar. Expected: closes smoothly.

**Step 7: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "feat(agent): UNVRS 007 AI analyst chat sidebar complete"
git push
```

---

## Summary of Files

| File | Action |
|------|--------|
| `api/agent/chat.js` | Create — streaming endpoint |
| `src/components/AgentSidebar.ts` | Create — sidebar component |
| `src/components/index.ts` | Modify — export AgentSidebar |
| `src/app/app-context.ts` | Modify — add agentSidebar field |
| `src/app/panel-layout.ts` | Modify — add AGENT button to header |
| `src/app/event-handlers.ts` | Modify — wire button click |
| `src/App.ts` | Modify — init agentSidebar |
| `src/styles/main.css` | Modify — append sidebar CSS |
