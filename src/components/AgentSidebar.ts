/**
 * AgentSidebar – slide-out chat panel powered by /api/agent/chat.
 * Supports three modes: free-form chat, morning briefing, market signals.
 * Streams responses via SSE for real-time display.
 */

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AgentSidebar {
  private el: HTMLElement;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private history: ChatMessage[] = [];
  private isStreaming = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'agent-sidebar';
    this.el.innerHTML = this.buildHTML();
    document.body.appendChild(this.el);
    this.bind();
  }

  private buildHTML(): string {
    return `
      <div class="agent-sidebar-backdrop"></div>
      <div class="agent-sidebar-panel">
        <div class="agent-sidebar-header">
          <span class="agent-sidebar-title">⬡ 007 Agent</span>
          <div class="agent-sidebar-actions">
            <button class="agent-action-btn" data-mode="briefing" title="Morning Briefing">📋</button>
            <button class="agent-action-btn" data-mode="signals" title="Market Signals">📊</button>
            <button class="agent-action-btn agent-clear-btn" title="Clear chat">🗑</button>
          </div>
          <button class="agent-sidebar-close">&times;</button>
        </div>
        <div class="agent-sidebar-messages"></div>
        <div class="agent-sidebar-input-row">
          <textarea class="agent-sidebar-input" placeholder="Ask the analyst..." rows="1"></textarea>
          <button class="agent-sidebar-send">▶</button>
        </div>
      </div>
    `;
  }

  private bind(): void {
    this.messagesEl = this.el.querySelector('.agent-sidebar-messages')!;
    this.inputEl = this.el.querySelector('.agent-sidebar-input')!;

    this.el.querySelector('.agent-sidebar-backdrop')!.addEventListener('click', () => this.close());
    this.el.querySelector('.agent-sidebar-close')!.addEventListener('click', () => this.close());
    this.el.querySelector('.agent-sidebar-send')!.addEventListener('click', () => this.sendChat());

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
    });

    // Auto-resize textarea
    this.inputEl.addEventListener('input', () => {
      this.inputEl.style.height = 'auto';
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
    });

    // Mode buttons (briefing / signals)
    this.el.querySelectorAll<HTMLButtonElement>('.agent-action-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as 'briefing' | 'signals';
        this.sendMode(mode);
      });
    });

    // Clear button
    this.el.querySelector('.agent-clear-btn')!.addEventListener('click', () => {
      this.history = [];
      this.messagesEl.innerHTML = '';
    });
  }

  open(): void {
    this.el.classList.add('open');
    document.body.classList.add('agent-sidebar-open');
    setTimeout(() => this.inputEl.focus(), 300);
  }

  close(): void {
    this.el.classList.remove('open');
    document.body.classList.remove('agent-sidebar-open');
  }

  toggle(): void {
    if (this.el.classList.contains('open')) this.close();
    else this.open();
  }

  private async sendChat(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text || this.isStreaming) return;
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this.appendMessage('user', text);
    await this.callAgent({ message: text, mode: 'chat' });
  }

  private async sendMode(mode: 'briefing' | 'signals'): Promise<void> {
    if (this.isStreaming) return;
    const label = mode === 'briefing' ? '📋 Morning Briefing' : '📊 Market Signals';
    this.appendMessage('user', label);
    await this.callAgent({ mode });
  }

  private async callAgent(body: { message?: string; mode: string }): Promise<void> {
    this.isStreaming = true;
    this.setSendState(true);

    const bubbleEl = this.appendMessage('assistant', '');
    const contentEl = bubbleEl.querySelector('.agent-msg-content')!;

    try {
      const resp = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          history: this.history.slice(-6),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        contentEl.textContent = `Error: ${(err as { error?: string }).error || resp.statusText}`;
        this.isStreaming = false;
        this.setSendState(false);
        return;
      }

      const text = await resp.text();
      let fullText = '';

      // Parse SSE events
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const parsed = JSON.parse(payload) as { text?: string };
          if (parsed.text) fullText += parsed.text;
        } catch { /* skip malformed */ }
      }

      contentEl.innerHTML = this.renderMarkdown(fullText || 'No response.');

      if (body.message) {
        this.history.push({ role: 'user', content: body.message });
      }
      this.history.push({ role: 'assistant', content: fullText });

    } catch (err) {
      contentEl.textContent = 'Connection error. Try again.';
    } finally {
      this.isStreaming = false;
      this.setSendState(false);
      this.scrollToBottom();
    }
  }

  private appendMessage(role: 'user' | 'assistant', content: string): HTMLElement {
    const bubble = document.createElement('div');
    bubble.className = `agent-msg agent-msg-${role}`;
    bubble.innerHTML = `<div class="agent-msg-content">${role === 'user' ? this.escapeHtml(content) : (content ? this.renderMarkdown(content) : '<span class="agent-typing">Thinking...</span>')}</div>`;
    this.messagesEl.appendChild(bubble);
    this.scrollToBottom();
    return bubble;
  }

  private renderMarkdown(text: string): string {
    return text
      // Headers
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      // Bold & italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Bullet lists
      .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Line breaks
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }

  private setSendState(streaming: boolean): void {
    const btn = this.el.querySelector('.agent-sidebar-send') as HTMLButtonElement;
    btn.disabled = streaming;
    btn.textContent = streaming ? '...' : '▶';
  }
}
