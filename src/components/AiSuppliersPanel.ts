/**
 * AiSuppliersPanel — Supplier Discovery panel.
 *
 * Displays a grid of supplier cards with contact info, ratings,
 * platforms and prices. Receives data from the same
 * fetchProductTrends() call used by AiDashboardPanel (trends).
 */

import { Panel } from './Panel';
import { h, replaceChildren } from '@/utils/dom-utils';
import type {
  GetProductTrendsResponse,
  ProductSupplier,
} from '@/services/ai-invest';

// ========================================================================
// Component
// ========================================================================

export class AiSuppliersPanel extends Panel {
  private suppliers: ProductSupplier[] = [];

  constructor() {
    super({
      id: 'ai-suppliers',
      title: 'Fornitori & Grossisti',
      showCount: false,
      infoTooltip: 'Scoperta fornitori AI per i prodotti di tendenza. Contatti, MOQ e prezzi.',
    });
  }

  public setLoading(): void {
    this.showLoading('Ricerca fornitori...');
  }

  /** Accepts the full product-trends response; extracts only the supplier slice. */
  public updateSuppliers(data: GetProductTrendsResponse): void {
    this.suppliers = data.suppliers ?? [];
    this.render();
  }

  // ── Main render ──

  private render(): void {
    if (this.suppliers.length === 0) {
      replaceChildren(this.content,
        h('div', { className: 'ai-error-message' }, 'Nessun fornitore trovato.'),
      );
      return;
    }

    const sections: HTMLElement[] = [];

    // KPI summary row
    sections.push(this.renderKpi());

    // Supplier grid
    sections.push(this.renderSuppliers(this.suppliers));

    replaceChildren(this.content, ...sections);
  }

  // ========================================================================
  // KPI summary
  // ========================================================================

  private renderKpi(): HTMLElement {
    const total = this.suppliers.length;
    const avgRating = total > 0
      ? (this.suppliers.reduce((s, sup) => s + sup.rating, 0) / total).toFixed(1)
      : '0';
    const platforms = new Set(this.suppliers.map((s) => s.platform));
    const locations = new Set(this.suppliers.map((s) => s.location));

    const cards = [
      this.kpiCard('\u{1F4E6} Fornitori', `${total}`, 'trovati'),
      this.kpiCard('\u2B50 Rating Medio', avgRating, 'su 5'),
      this.kpiCard('\u{1F310} Piattaforme', `${platforms.size}`, [...platforms].slice(0, 3).join(', ')),
      this.kpiCard('\u{1F4CD} Localita\'', `${locations.size}`, 'paesi'),
    ];

    return h('div', { className: 'dash-section' },
      h('div', { className: 'dash-section-label' }, 'PANORAMICA FORNITORI'),
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
  // Supplier grid
  // ========================================================================

  private renderSuppliers(suppliers: ProductSupplier[]): HTMLElement {
    const cards = suppliers.map((sup) => {
      const ratingStars = '\u2605'.repeat(Math.round(sup.rating)) + '\u2606'.repeat(5 - Math.round(sup.rating));

      const contactItems: HTMLElement[] = [];

      if (sup.contactEmail) {
        const emailLink = h('a', { className: 'dash-sup-contact-link' }, sup.contactEmail);
        (emailLink as HTMLAnchorElement).href = `mailto:${sup.contactEmail}`;
        emailLink.addEventListener('click', (e) => e.stopPropagation());
        contactItems.push(h('div', { className: 'dash-sup-contact-item' }, '\u{1F4E7} ', emailLink));
      }

      if (sup.contactPhone) {
        const phoneLink = h('a', { className: 'dash-sup-contact-link' }, sup.contactPhone);
        (phoneLink as HTMLAnchorElement).href = `tel:${sup.contactPhone}`;
        phoneLink.addEventListener('click', (e) => e.stopPropagation());
        contactItems.push(h('div', { className: 'dash-sup-contact-item' }, '\u{1F4DE} ', phoneLink));
      }

      const card = h('div', { className: 'dash-sup-card' },
        h('div', { className: 'dash-sup-header' },
          h('span', { className: 'dash-sup-name' }, sup.supplierName),
          h('span', { className: 'dash-sup-platform-badge' }, sup.platform),
        ),
        h('div', { className: 'dash-sup-product' }, `Per: ${sup.productName}`),
        h('div', { className: 'dash-sup-details' },
          h('span', null, `\u{1F4B0} ${sup.price}`),
          h('span', null, `MOQ: ${sup.moq}`),
          h('span', null, `\u{1F4CD} ${sup.location}`),
        ),
        h('div', { className: 'dash-sup-rating' }, `${ratingStars} ${sup.rating.toFixed(1)}`),
        ...(contactItems.length > 0
          ? [h('div', { className: 'dash-sup-contacts' }, ...contactItems)]
          : []),
        h('span', { className: 'dash-sup-link-icon' }, '\u{1F517}'),
      );

      if (sup.url) {
        card.style.cursor = 'pointer';
        card.title = `Apri fornitore su ${sup.platform}`;
        card.addEventListener('click', () => {
          window.open(sup.url, '_blank', 'noopener,noreferrer');
        });
      }

      return card;
    });

    return h('div', { className: 'dash-section' },
      h('div', { className: 'dash-section-label' }, `FORNITORI & GROSSISTI (${suppliers.length})`),
      h('div', { className: 'dash-suppliers-grid' }, ...cards),
    );
  }
}
