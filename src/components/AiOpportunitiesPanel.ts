import { Panel } from './Panel';
import { h, replaceChildren } from '@/utils/dom-utils';
// h() uses createTextNode() which is inherently XSS-safe – no need for escapeHtml
import type { InvestmentOpportunity } from '@/services/ai-invest';

// ========================================================================
// Constants
// ========================================================================

const OPPORTUNITY_DOMAIN_ICONS: Record<string, string> = {
  mercati: '\u{1F4C8}',         // chart
  immobiliare: '\u{1F3E0}',     // house
  commodities: '\u{1F6E2}\uFE0F', // oil drum
  crypto: '\u{1FA99}',          // coin
  arbitraggio: '\u{1F4B1}',     // currency exchange
  business: '\u{1F4BC}',        // briefcase
  energia: '\u{26A1}',          // lightning
  collezionismo: '\u{1F3A8}',   // palette
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  COMPRA: { bg: '#10b981', text: '#fff' },
  VENDI: { bg: '#ef4444', text: '#fff' },
  MONITORA: { bg: '#f59e0b', text: '#000' },
  EVITA: { bg: '#6b7280', text: '#fff' },
};

// ========================================================================
// Component
// ========================================================================

export class AiOpportunitiesPanel extends Panel {
  private opportunities: InvestmentOpportunity[] = [];

  constructor() {
    super({
      id: 'ai-opportunities',
      title: 'Opportunità di Investimento',
      showCount: true,
      infoTooltip: 'Opportunità identificate dall\'agente AI. Non costituisce consulenza finanziaria.',
    });
  }

  public setLoading(): void {
    this.showLoading('Analisi opportunità in corso...');
  }

  public updateOpportunities(opportunities: InvestmentOpportunity[]): void {
    this.opportunities = opportunities;
    this.render();
  }

  private render(): void {
    if (this.opportunities.length === 0) {
      replaceChildren(this.content,
        h('div', { className: 'ai-opportunities-empty' }, 'Nessuna opportunità identificata'),
      );
      this.setCount(0);
      return;
    }

    const cards = this.opportunities.map((opp) => this.renderOpportunityCard(opp));

    replaceChildren(this.content,
      h('div', { className: 'ai-opportunities-section' },
        h('div', { className: 'ai-opportunities-grid' }, ...cards),
      ),
    );

    this.setCount(this.opportunities.length);
  }

  private renderOpportunityCard(opp: InvestmentOpportunity): HTMLElement {
    const actionStyle = ACTION_COLORS[opp.action] || ACTION_COLORS.MONITORA!;
    const confidenceWidth = `${Math.min(100, Math.max(0, opp.confidence))}%`;

    const badge = h('span', { className: 'ai-action-badge' }, opp.action);
    badge.style.backgroundColor = actionStyle.bg;
    badge.style.color = actionStyle.text;

    const confBar = h('div', { className: 'ai-confidence-fill' });
    confBar.style.width = confidenceWidth;
    confBar.style.backgroundColor = actionStyle.bg;

    const domainIcon = OPPORTUNITY_DOMAIN_ICONS[opp.category] || '\u{1F4C8}';
    const domainBadge = h('span', { className: 'ai-domain-badge' }, `${domainIcon} ${opp.category || 'mercati'}`);

    const card = h('div', { className: 'ai-opportunity-card ai-opportunity-card-clickable' },
      h('div', { className: 'ai-opp-header' },
        h('span', { className: 'ai-opp-asset' }, (opp.asset)),
        domainBadge,
        badge,
      ),
      opp.currentValue
        ? h('div', { className: 'ai-opp-value' }, (opp.currentValue))
        : h('span'),
      h('div', { className: 'ai-opp-rationale' }, (opp.rationale)),
      h('div', { className: 'ai-confidence-bar' },
        confBar,
        h('span', { className: 'ai-confidence-text' }, `${opp.confidence}%`),
      ),
      h('div', { className: 'ai-opp-meta' },
        h('span', null, `${this.horizonLabel(opp.timeHorizon)}`),
        h('span', null, `Rischio: ${opp.riskLevel}`),
        ...(opp.dataSources.length > 0
          ? [h('span', null, opp.dataSources.join(', '))]
          : []),
      ),
      h('span', { className: 'ai-opp-search-icon' }, '\u{1F50D}'),
    );

    // Make card clickable — search for this asset/opportunity
    card.title = `Cerca "${opp.asset}" su Google`;
    card.addEventListener('click', () => {
      const q = encodeURIComponent(opp.asset);
      window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
    });

    return card;
  }

  private horizonLabel(horizon: string): string {
    switch (horizon) {
      case 'short': return 'Breve termine';
      case 'medium': return 'Medio termine';
      case 'long': return 'Lungo termine';
      default: return horizon;
    }
  }
}
