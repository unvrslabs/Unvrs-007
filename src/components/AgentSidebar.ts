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
    document.removeEventListener('keydown', this.handleEsc);
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

    this.sendBtn?.addEventListener('click', () => { void this.handleSend(); });
    this.inputEl?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void this.handleSend(); }
    });

    document.addEventListener('keydown', this.handleEsc);
  }

  private switchMode(mode: AgentMode): void {
    this.mode = mode;
    this.overlay?.querySelectorAll('.agent-tab').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });
    const inputRow = this.overlay?.querySelector('.agent-input-row') as HTMLElement | null;
    if (inputRow) inputRow.style.display = mode === 'chat' ? '' : 'none';
    if (mode !== 'chat') void this.generateAutoMode();
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

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break outer;
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) {
              fullText += parsed.text;
              contentEl.innerHTML = this.renderMarkdown(fullText);
              this.messagesEl?.scrollTo(0, this.messagesEl.scrollHeight);
            }
          } catch { /* skip malformed */ }
        }
      }

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
    return escapeHtml(text)
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  private readonly handleEsc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };
}
