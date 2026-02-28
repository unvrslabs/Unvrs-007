# UNVRS 007 Agent — Design Doc
Date: 2026-02-26

## Summary
Add an AI analyst agent + chat sidebar to the worldmonitor dashboard.
Personal use only. Opens from a header button.

## Use Cases
- **Chat**: Free-form Q&A with live dashboard context
- **Briefing**: One-click structured morning report (geo + markets + signals)
- **Signals**: Auto-correlation of geopolitical news → market impact

## UI
- Header button `⬡ AGENT` in `header-right` (next to Search)
- Sidebar overlay from the right, ~420px wide, does not push panels
- Three tabs: CHAT | BRIEFING | SIGNALS
- Streaming responses (token-by-token, not wait-then-show)

## Backend
- New Vercel serverless endpoint: `api/agent/chat.js`
- Input: `{ message, history, mode: 'chat' | 'briefing' | 'signals' }`
- Context collection: reads from Redis cache (market:quotes:v1, market:sectors:v1) + latest RSS headlines via rss-proxy
- LLM: `claude-opus-4-6` via Anthropic API (key: ANTHROPIC_API_KEY on Vercel)
- Fallback: `groq` if Anthropic key missing
- Streaming: SSE (Server-Sent Events)
- Conversation history: Redis key `agent:history:{sessionId}`, TTL 24h

## System Prompt
Geopolitical + financial analyst persona. Receives live context block:
- Top 20 headlines (by source tier) across politics/intel/markets/tech
- Market quotes snapshot (SPY, QQQ, BTC, gold, oil, etc.)
- Sector performance (XLK, XLF, XLE, etc.)

## Files to Create/Modify
- `api/agent/chat.js` — new streaming endpoint
- `src/components/AgentSidebar.ts` — new sidebar component
- `src/app/panel-layout.ts` — add AGENT button + mount sidebar
- `src/styles/main.css` — sidebar styles + agent button styles
