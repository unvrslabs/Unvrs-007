import { Panel } from './Panel';
import { h, replaceChildren } from '@/utils/dom-utils';
// h() uses createTextNode() which is inherently XSS-safe – no need for escapeHtml
import type {
  GetInvestmentAnalysisResponse,
  GetMarketRadarResponse,
  ReasoningStep,
  MarketSignal,
} from '@/services/ai-invest';

// ========================================================================
// Constants
// ========================================================================

const CATEGORY_ICONS: Record<string, string> = {
  data_scan: '\u{1F50D}',       // magnifying glass
  pattern_detection: '\u{1F517}', // chain link
  correlation: '\u{1F500}',     // shuffle arrows
  cross_sector: '\u{1F310}',    // globe
  conclusion: '\u{1F4A1}',      // light bulb
};

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: '#10b981',
  bearish: '#ef4444',
  mixed: '#f59e0b',
  cautious: '#8b5cf6',
};

// ========================================================================
// Component
// ========================================================================

export class AiAgentPanel extends Panel {
  private analysisData: GetInvestmentAnalysisResponse | null = null;
  private radarData: GetMarketRadarResponse | null = null;

  constructor() {
    super({
      id: 'ai-agent',
      title: 'Agente AI Investimenti',
      showCount: false,
      infoTooltip: 'Analisi AI in tempo reale basata su dati di mercato, notizie e indicatori economici. Non costituisce consulenza finanziaria.',
    });
  }

  public setLoading(): void {
    this.showLoading('Agente AI in analisi...');
  }

  public updateAnalysis(analysis: GetInvestmentAnalysisResponse): void {
    this.analysisData = analysis;
    this.render();
  }

  public updateRadar(radar: GetMarketRadarResponse): void {
    this.radarData = radar;
    this.render();
  }

  private render(): void {
    const analysis = this.analysisData;
    const radar = this.radarData;

    // Error state
    if (analysis?.error) {
      replaceChildren(this.content,
        h('div', { className: 'ai-error-message' }, (analysis.error)),
      );
      return;
    }

    // No data yet
    if (!analysis && !radar) {
      this.showLoading('In attesa dei dati...');
      return;
    }

    const sections: HTMLElement[] = [];

    // 1. Sentiment Radar Bar
    if (radar && radar.overallSentiment) {
      sections.push(this.renderSentimentBar(radar));
    }

    // 2. Reasoning Chain
    if (analysis && analysis.reasoning.length > 0) {
      sections.push(this.renderReasoningChain(analysis.reasoning));
    }

    // 3. Market Outlook
    if (analysis && analysis.marketOutlook) {
      sections.push(this.renderOutlook(analysis.marketOutlook));
    }

    // 5. Disclaimer
    if (analysis?.disclaimer) {
      sections.push(
        h('div', { className: 'ai-disclaimer' }, (analysis.disclaimer)),
      );
    }

    // Timestamp
    if (analysis?.generatedAt) {
      const date = new Date(analysis.generatedAt);
      sections.push(
        h('div', { className: 'ai-timestamp' },
          `Aggiornato: ${date.toLocaleTimeString('it-IT')} ${analysis.cached ? '(cache)' : ''}`,
        ),
      );
    }

    replaceChildren(this.content, ...sections);
  }

  // ---- Sentiment Bar ----

  private renderSentimentBar(radar: GetMarketRadarResponse): HTMLElement {
    const color = SENTIMENT_COLORS[radar.overallSentiment] || '#6b7280';
    const sentimentLabel = radar.overallSentiment.toUpperCase();

    const signalDots = radar.signals.map((signal) =>
      this.renderSignalDot(signal),
    );

    const bar = h('div', { className: 'ai-sentiment-section' },
      h('div', { className: 'ai-section-label' }, 'RADAR SENTIMENTO'),
      h('div', { className: 'ai-sentiment-bar' },
        h('div', { className: 'ai-sentiment-fill' }),
        h('span', { className: 'ai-sentiment-label' }, sentimentLabel),
      ),
      radar.summary ? h('div', { className: 'ai-sentiment-summary' }, (radar.summary)) : h('span'),
      ...(signalDots.length > 0 ? [h('div', { className: 'ai-signals-grid' }, ...signalDots)] : []),
    );

    // Set the gradient color on the bar
    const fill = bar.querySelector('.ai-sentiment-fill') as HTMLElement;
    if (fill) {
      fill.style.background = `linear-gradient(90deg, ${color}33, ${color})`;
      fill.style.width = '100%';
    }
    const label = bar.querySelector('.ai-sentiment-label') as HTMLElement;
    if (label) {
      label.style.color = color;
    }

    return bar;
  }

  private renderSignalDot(signal: MarketSignal): HTMLElement {
    const typeColors: Record<string, string> = {
      bullish: '#10b981',
      bearish: '#ef4444',
      neutral: '#6b7280',
      risk_event: '#f59e0b',
    };
    const color = typeColors[signal.type] || '#6b7280';
    const strengthBars = '\u2588'.repeat(signal.strength) + '\u2591'.repeat(5 - signal.strength);

    const dot = h('div', { className: 'ai-signal-item' },
      h('span', { className: 'ai-signal-type' }, signal.type.toUpperCase()),
      h('span', { className: 'ai-signal-sector' }, (signal.sector)),
      h('span', { className: 'ai-signal-strength' }, strengthBars),
      h('div', { className: 'ai-signal-desc' }, (signal.description)),
    );

    const typeEl = dot.querySelector('.ai-signal-type') as HTMLElement;
    if (typeEl) typeEl.style.color = color;
    const strengthEl = dot.querySelector('.ai-signal-strength') as HTMLElement;
    if (strengthEl) strengthEl.style.color = color;

    return dot;
  }

  // ---- Reasoning Chain ----

  private renderReasoningChain(steps: ReasoningStep[]): HTMLElement {
    const stepEls = steps.map((step) => {
      const icon = CATEGORY_ICONS[step.category] || '\u{1F4CB}'; // clipboard fallback
      return h('div', { className: 'ai-reasoning-step' },
        h('div', { className: 'ai-step-header' },
          h('span', { className: 'ai-step-icon' }, icon),
          h('span', { className: 'ai-step-number' }, `Step ${step.step}`),
          h('span', { className: 'ai-step-category' }, step.category.replace('_', ' ').toUpperCase()),
        ),
        h('div', { className: 'ai-step-description' }, (step.description)),
        step.evidence
          ? h('div', { className: 'ai-step-evidence' }, (step.evidence))
          : h('span'),
      );
    });

    return h('div', { className: 'ai-reasoning-section' },
      h('div', { className: 'ai-section-label' }, 'RAGIONAMENTO AGENTE'),
      h('div', { className: 'ai-reasoning-chain' }, ...stepEls),
    );
  }

  // ---- Outlook ----

  private renderOutlook(outlook: string): HTMLElement {
    return h('div', { className: 'ai-outlook-section' },
      h('div', { className: 'ai-section-label' }, 'OUTLOOK DI MERCATO'),
      h('div', { className: 'ai-outlook-text' }, (outlook)),
    );
  }
}
