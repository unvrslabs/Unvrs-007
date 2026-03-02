/**
 * AiDashboardPanel — Product Trends dashboard with D3.js sparklines.
 *
 * Sections:
 * 1. Summary KPI Row (top trends stats)
 * 2. Category Demand (horizontal bars with growth %)
 * 3. Trending Products (card grid with sparklines + platforms)
 */

import { Panel } from './Panel';
import * as d3 from 'd3';
import { h, replaceChildren } from '@/utils/dom-utils';
import type {
  GetProductTrendsResponse,
  ProductTrend,
  TrendCategory,
} from '@/services/ai-invest';

// ========================================================================
// Constants
// ========================================================================

const RESIZE_DEBOUNCE_MS = 200;

const CATEGORY_ICONS: Record<string, string> = {
  'Elettronica': '\u{1F4F1}',
  'Casa & Giardino': '\u{1F3E0}',
  'Salute & Bellezza': '\u{2728}',
  'Moda': '\u{1F45F}',
  'Sport & Outdoor': '\u{1F3C3}',
  'Bambini & Giochi': '\u{1F9F8}',
  'Alimentare': '\u{1F34E}',
  'Auto & Moto': '\u{1F697}',
};

const DEMAND_COLORS: Record<string, string> = {
  'Alto': '#10b981',
  'Medio': '#f59e0b',
  'Basso': '#6b7280',
};

const TREND_ARROWS: Record<string, string> = {
  'up': '\u{2197}\uFE0F',
  'stable': '\u{2194}\uFE0F',
  'down': '\u{2198}\uFE0F',
};

// ========================================================================
// Component
// ========================================================================

export class AiDashboardPanel extends Panel {
  private data: GetProductTrendsResponse | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({
      id: 'ai-dashboard',
      title: 'Tendenze Prodotti',
      showCount: false,
      infoTooltip: 'Analisi AI dei prodotti piu\' venduti online e scoperta fornitori. Non costituisce consulenza finanziaria.',
    });
    this.setupResizeObserver();
  }

  public setLoading(): void {
    this.showLoading('Analisi tendenze di mercato...');
  }

  public updateDashboard(data: GetProductTrendsResponse): void {
    this.data = data;
    this.render();
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        if (this.data) this.renderSparklines();
      }, RESIZE_DEBOUNCE_MS);
    });
    this.resizeObserver.observe(this.content);
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }

  // ── Main render ──

  private render(): void {
    const d = this.data;
    if (!d) return;

    if (d.error) {
      replaceChildren(this.content,
        h('div', { className: 'ai-error-message' }, d.error),
      );
      return;
    }

    const sections: HTMLElement[] = [];

    // Summary
    if (d.summary) {
      sections.push(
        h('div', { className: 'dash-summary' }, d.summary),
      );
    }

    // 1. KPI Row
    sections.push(this.renderKpiRow(d));

    // 2. Category Demand
    if (d.categories.length > 0) {
      sections.push(this.renderCategories(d.categories));
    }

    // 3. Trending Products
    if (d.trends.length > 0) {
      sections.push(this.renderTrends(d.trends));
    }

    // Timestamp
    if (d.generatedAt) {
      const date = new Date(d.generatedAt);
      sections.push(
        h('div', { className: 'ai-timestamp' },
          `Aggiornato: ${date.toLocaleTimeString('it-IT')} ${d.cached ? '(cache)' : ''}`,
        ),
      );
    }

    replaceChildren(this.content, ...sections);

    // D3 sparklines need to be rendered after DOM insertion
    requestAnimationFrame(() => {
      this.renderSparklines();
      this.renderCategoryBars();
    });
  }

  // ========================================================================
  // Section 1: KPI Row
  // ========================================================================

  private renderKpiRow(d: GetProductTrendsResponse): HTMLElement {
    const cards: HTMLElement[] = [];

    // Total trends
    cards.push(this.kpiCard('\u{1F4C8} Prodotti', `${d.trends.length}`, 'in tendenza'));

    // High demand count
    const highDemand = d.trends.filter((t) => t.demandLevel === 'Alto').length;
    cards.push(this.kpiCard('\u{1F525} Alta Domanda', `${highDemand}`, 'prodotti'));

    // Avg monthly searches
    const totalSearches = d.trends.reduce((sum, t) => sum + t.monthlySearches, 0);
    const avgSearches = d.trends.length > 0 ? Math.round(totalSearches / d.trends.length) : 0;
    cards.push(this.kpiCard('\u{1F50D} Ricerche/mese', this.formatNumber(avgSearches), 'media'));

    // Top category
    if (d.categories.length > 0) {
      const topCat = d.categories.reduce((a, b) => a.demandScore > b.demandScore ? a : b);
      const icon = CATEGORY_ICONS[topCat.category] || '\u{1F3AF}';
      cards.push(this.kpiCard(`${icon} Top Settore`, topCat.category, topCat.growth));
    }

    // Trending up count
    const trendingUp = d.trends.filter((t) => t.trendDirection === 'up').length;
    cards.push(this.kpiCard('\u{2197}\uFE0F In Crescita', `${trendingUp}/${d.trends.length}`, 'prodotti'));

    return h('div', { className: 'dash-section' },
      h('div', { className: 'dash-section-label' }, 'PANORAMICA MERCATO'),
      h('div', { className: 'dash-kpi-row' }, ...cards),
    );
  }

  private kpiCard(label: string, value: string, subtitle: string): HTMLElement {
    return h('div', { className: 'dash-kpi-card' },
      h('div', { className: 'dash-kpi-label' }, label),
      h('div', { className: 'dash-kpi-value' }, value),
      h('div', { className: 'dash-kpi-sublabel' }, subtitle),
    );
  }

  // ========================================================================
  // Section 2: Category Demand
  // ========================================================================

  private renderCategories(categories: TrendCategory[]): HTMLElement {
    const sorted = [...categories].sort((a, b) => b.demandScore - a.demandScore);

    const rows = sorted.map((cat) => {
      const icon = CATEGORY_ICONS[cat.category] || '\u{1F4CA}';
      const growthColor = cat.growth.startsWith('+') ? '#10b981' : cat.growth.startsWith('-') ? '#ef4444' : '#9ca3af';

      const growthSpan = h('span', { className: 'dash-cat-growth' }, cat.growth);
      growthSpan.style.color = growthColor;

      return h('div', { className: 'dash-cat-row' },
        h('div', { className: 'dash-cat-name' }, `${icon} ${cat.category}`),
        h('div', { className: 'dash-cat-bar-wrap' },
          h('div', { className: 'dash-cat-bar', id: `cat-bar-${cat.category.replace(/[^a-zA-Z]/g, '')}` }),
        ),
        h('div', { className: 'dash-cat-score' }, `${cat.demandScore}`),
        growthSpan,
        h('div', { className: 'dash-cat-top' }, cat.topProduct),
      );
    });

    return h('div', { className: 'dash-section' },
      h('div', { className: 'dash-section-label' }, 'DOMANDA PER CATEGORIA'),
      h('div', { className: 'dash-cat-grid' }, ...rows),
    );
  }

  private renderCategoryBars(): void {
    if (!this.data) return;

    for (const cat of this.data.categories) {
      const barId = `cat-bar-${cat.category.replace(/[^a-zA-Z]/g, '')}`;
      const bar = this.content.querySelector(`#${barId}`) as HTMLElement;
      if (!bar) continue;

      const pct = Math.min(100, Math.max(0, cat.demandScore));
      const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#6b7280';

      // Animate fill
      requestAnimationFrame(() => {
        bar.style.width = `${pct}%`;
        bar.style.backgroundColor = color;
      });
    }
  }

  // ========================================================================
  // Section 3: Trending Products
  // ========================================================================

  private renderTrends(trends: ProductTrend[]): HTMLElement {
    const sorted = [...trends].sort((a, b) => b.monthlySearches - a.monthlySearches);

    const cards = sorted.map((trend) => {
      const icon = CATEGORY_ICONS[trend.category] || '\u{1F4CA}';
      const demandColor = DEMAND_COLORS[trend.demandLevel] || '#6b7280';
      const trendArrow = TREND_ARROWS[trend.trendDirection] || '\u{2194}\uFE0F';

      const demandBadge = h('span', { className: 'dash-demand-badge' }, trend.demandLevel);
      demandBadge.style.backgroundColor = demandColor;
      demandBadge.style.color = trend.demandLevel === 'Medio' ? '#000' : '#fff';

      const platformTags = trend.platforms.map((p) =>
        h('span', { className: 'dash-platform-tag' }, p),
      );

      const card = h('div', { className: 'dash-trend-card' },
        h('div', { className: 'dash-trend-header' },
          h('span', { className: 'dash-trend-icon' }, icon),
          h('span', { className: 'dash-trend-name' }, trend.name),
          demandBadge,
        ),
        h('div', { className: 'dash-trend-sparkline', id: `spark-${trend.id}` }),
        h('div', { className: 'dash-trend-stats' },
          h('span', null, `${trendArrow} ${trend.priceRange}`),
          h('span', null, `${this.formatNumber(trend.monthlySearches)} ricerche/mese`),
        ),
        h('div', { className: 'dash-trend-platforms' }, ...platformTags),
        h('span', { className: 'dash-trend-search-icon' }, '\u{1F50D}'),
      );

      card.style.cursor = 'pointer';
      card.title = `Cerca "${trend.name}" su Google`;
      card.addEventListener('click', () => {
        const q = encodeURIComponent(trend.name);
        window.open(`https://www.google.com/search?q=${q}+comprare+online`, '_blank', 'noopener,noreferrer');
      });

      return card;
    });

    return h('div', { className: 'dash-section' },
      h('div', { className: 'dash-section-label' }, `PRODOTTI IN TENDENZA (${trends.length})`),
      h('div', { className: 'dash-trends-grid' }, ...cards),
    );
  }

  private renderSparklines(): void {
    if (!this.data) return;

    for (const trend of this.data.trends) {
      const container = this.content.querySelector(`#spark-${trend.id}`) as HTMLElement;
      if (!container || trend.sparkline.length < 2) continue;

      // Clear existing
      container.innerHTML = '';

      const w = container.clientWidth || 120;
      const sparkH = 64;
      if (w <= 0) continue;

      const svg = d3.select(container)
        .append('svg')
        .attr('width', w)
        .attr('height', sparkH)
        .style('display', 'block');

      const data = trend.sparkline;
      const extent = d3.extent(data) as [number, number];
      const padding = (extent[1] - extent[0]) * 0.15 || 1;

      const x = d3.scaleLinear().domain([0, data.length - 1]).range([2, w - 2]);
      const y = d3.scaleLinear().domain([extent[0] - padding, extent[1] + padding]).range([sparkH - 2, 2]);

      const isUp = data[data.length - 1]! > data[0]!;
      const lineColor = isUp ? '#10b981' : '#ef4444';
      const fillColor = isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

      // Area
      const area = d3.area<number>()
        .x((_d, i) => x(i))
        .y0(sparkH)
        .y1((d) => y(d))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(data)
        .attr('d', area)
        .attr('fill', fillColor);

      // Line
      const line = d3.line<number>()
        .x((_d, i) => x(i))
        .y((d) => y(d))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(data)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', lineColor)
        .attr('stroke-width', 1.5);

      // End dot
      svg.append('circle')
        .attr('cx', x(data.length - 1))
        .attr('cy', y(data[data.length - 1]!))
        .attr('r', 2.5)
        .attr('fill', lineColor);
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  }
}
