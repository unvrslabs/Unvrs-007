import { Panel } from './Panel';
import { h, replaceChildren } from '@/utils/dom-utils';
// h() uses createTextNode() which is inherently XSS-safe – no need for escapeHtml
import type {
  GetMarketplaceListingsResponse,
  MarketplaceListing,
  ArbitrageMatch,
} from '@/services/ai-invest';

// ========================================================================
// Constants
// ========================================================================

const PLATFORM_ICONS: Record<string, string> = {
  'Subito.it': '\u{1F4E6}',       // package
  'eBay': '\u{1F6D2}',            // shopping cart
  'Facebook Marketplace': '\u{1F4F1}', // mobile
  'Facebook Groups': '\u{1F465}',  // people
  'Wallapop': '\u{1F4B0}',        // money bag
  'Vinted': '\u{1F455}',          // t-shirt
  'Forum': '\u{1F4AC}',           // speech bubble
};

/** Generate a platform search URL from listing title + platform name */
function buildPlatformSearchUrl(title: string, platform: string): string {
  // Extract meaningful keywords from title (remove "Cerco:", prices, etc.)
  const clean = title.replace(/^Cerco:\s*/i, '').replace(/budget\s*:?\s*\d+/gi, '').trim();
  const q = encodeURIComponent(clean.slice(0, 80));
  switch (platform) {
    case 'Subito.it': return `https://www.subito.it/annunci-italia/vendita/usato/?q=${q}`;
    case 'eBay': return `https://www.ebay.it/sch/i.html?_nkw=${q}`;
    case 'Facebook Marketplace': return `https://www.facebook.com/marketplace/search?query=${q}`;
    case 'Wallapop': return `https://it.wallapop.com/search?keywords=${q}`;
    case 'Vinted': return `https://www.vinted.it/catalog?search_text=${q}`;
    default: return `https://www.google.com/search?q=${q}+${encodeURIComponent(platform)}`;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  elettronica: '#3b82f6',
  auto: '#ef4444',
  casa: '#10b981',
  abbigliamento: '#8b5cf6',
  sport: '#f59e0b',
  altro: '#6b7280',
};

// ========================================================================
// MarketplacePanel
// ========================================================================

export class MarketplacePanel extends Panel {
  private data: GetMarketplaceListingsResponse | null = null;
  private currentQuery = '';
  private currentCountry = 'italia';

  constructor() {
    super({
      id: 'marketplace',
      title: 'Comparatore Marketplace',
      showCount: false,
    });
  }

  setLoading(): void {
    const content = this.getContentArea();
    if (!content) return;
    replaceChildren(content, h('div', { class: 'marketplace-loading' }, '\u{23F3} Analisi marketplace in corso...'));
  }

  updateListings(resp: GetMarketplaceListingsResponse): void {
    this.data = resp;
    this.render();
  }

  triggerSearch(query: string, country: string): void {
    this.currentQuery = query;
    this.currentCountry = country;
  }

  private render(): void {
    const content = this.getContentArea();
    if (!content) return;

    const data = this.data;
    if (!data) {
      replaceChildren(content, h('div', { class: 'marketplace-empty' }, 'Nessun dato disponibile'));
      return;
    }

    if (data.error) {
      replaceChildren(content, h('div', { class: 'marketplace-error' }, `\u26A0\uFE0F ${(data.error)}`));
      return;
    }

    const frag = document.createDocumentFragment();

    // Search bar
    const searchBar = this.buildSearchBar();
    frag.appendChild(searchBar);

    // Summary
    if (data.summary) {
      frag.appendChild(h('div', { class: 'marketplace-summary' }, (data.summary)));
    }

    // Two-column layout: Sell vs Buy
    const columns = h('div', { class: 'marketplace-columns' });

    // LEFT: In Vendita
    const sellCol = h('div', { class: 'marketplace-col marketplace-col-sell' });
    sellCol.appendChild(h('div', { class: 'marketplace-col-header marketplace-col-header-sell' }, `\u{1F4E4} In Vendita (${data.sellListings.length})`));
    const sellList = h('div', { class: 'marketplace-listings' });
    data.sellListings.forEach(listing => {
      sellList.appendChild(this.buildListingCard(listing, 'sell'));
    });
    if (data.sellListings.length === 0) {
      sellList.appendChild(h('div', { class: 'marketplace-no-items' }, 'Nessun annuncio di vendita'));
    }
    sellCol.appendChild(sellList);
    columns.appendChild(sellCol);

    // RIGHT: Cercano
    const buyCol = h('div', { class: 'marketplace-col marketplace-col-buy' });
    buyCol.appendChild(h('div', { class: 'marketplace-col-header marketplace-col-header-buy' }, `\u{1F4E5} Cercano di Comprare (${data.buyRequests.length})`));
    const buyList = h('div', { class: 'marketplace-listings' });
    data.buyRequests.forEach(listing => {
      buyList.appendChild(this.buildListingCard(listing, 'buy'));
    });
    if (data.buyRequests.length === 0) {
      buyList.appendChild(h('div', { class: 'marketplace-no-items' }, 'Nessuna richiesta di acquisto'));
    }
    buyCol.appendChild(buyList);
    columns.appendChild(buyCol);

    frag.appendChild(columns);

    // Arbitrage matches
    if (data.arbitrageMatches.length > 0) {
      const matchSection = h('div', { class: 'marketplace-arbitrage' });
      matchSection.appendChild(h('div', { class: 'marketplace-arbitrage-header' }, `\u{1F4B8} Opportunita\u0300 di Arbitraggio (${data.arbitrageMatches.length})`));
      data.arbitrageMatches.forEach(match => {
        matchSection.appendChild(this.buildArbitrageCard(match));
      });
      frag.appendChild(matchSection);
    }

    // Timestamp
    if (data.generatedAt) {
      const ts = new Date(data.generatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      frag.appendChild(h('div', { class: 'marketplace-timestamp' }, `Aggiornato alle ${ts}`));
    }

    replaceChildren(content, frag);
  }

  private buildSearchBar(): HTMLElement {
    const bar = h('div', { class: 'marketplace-search-bar' });

    const countrySelect = document.createElement('select');
    countrySelect.className = 'marketplace-country-select';
    const countries = [
      { value: 'italia', label: '\u{1F1EE}\u{1F1F9} Italia' },
      { value: 'germania', label: '\u{1F1E9}\u{1F1EA} Germania' },
      { value: 'francia', label: '\u{1F1EB}\u{1F1F7} Francia' },
      { value: 'spagna', label: '\u{1F1EA}\u{1F1F8} Spagna' },
      { value: 'uk', label: '\u{1F1EC}\u{1F1E7} UK' },
      { value: 'usa', label: '\u{1F1FA}\u{1F1F8} USA' },
    ];
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.value;
      opt.textContent = c.label;
      if (c.value === this.currentCountry) opt.selected = true;
      countrySelect.appendChild(opt);
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'marketplace-search-input';
    input.placeholder = 'Cerca prodotti (es. iPhone 15, bici da corsa, divano...)';
    input.value = this.currentQuery;

    const searchBtn = document.createElement('button');
    searchBtn.className = 'marketplace-search-btn';
    searchBtn.textContent = '\u{1F50D} Cerca';
    searchBtn.addEventListener('click', () => {
      this.currentQuery = input.value.trim();
      this.currentCountry = countrySelect.value;
      if (this.currentQuery) {
        this.dispatchEvent('marketplace-search', {
          query: this.currentQuery,
          country: this.currentCountry,
        });
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchBtn.click();
    });

    bar.appendChild(countrySelect);
    bar.appendChild(input);
    bar.appendChild(searchBtn);
    return bar;
  }

  private dispatchEvent(name: string, detail: Record<string, string>): void {
    const el = this.getElement();
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  private buildListingCard(listing: MarketplaceListing, type: 'sell' | 'buy'): HTMLElement {
    const card = h('div', { class: `marketplace-card marketplace-card-${type} marketplace-card-clickable` });

    // Make card clickable — open listing URL or platform search
    const targetUrl = listing.url || buildPlatformSearchUrl(listing.title, listing.platform);
    card.addEventListener('click', () => {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    });
    card.title = 'Clicca per vedere annunci simili';

    const header = h('div', { class: 'marketplace-card-header' });
    const platformIcon = PLATFORM_ICONS[listing.platform] || '\u{1F4E6}';
    header.appendChild(h('span', { class: 'marketplace-card-platform' }, `${platformIcon} ${(listing.platform)}`));

    const catColor = CATEGORY_COLORS[listing.category] || CATEGORY_COLORS.altro || '#6b7280';
    const catBadge = h('span', { class: 'marketplace-card-category' });
    catBadge.style.backgroundColor = catColor;
    catBadge.textContent = listing.category;
    header.appendChild(catBadge);
    card.appendChild(header);

    card.appendChild(h('div', { class: 'marketplace-card-title' }, (listing.title)));
    card.appendChild(h('div', { class: 'marketplace-card-price' }, (listing.price)));

    const meta = h('div', { class: 'marketplace-card-meta' });
    if (listing.location) {
      meta.appendChild(h('span', {}, `\u{1F4CD} ${(listing.location)}`));
    }
    card.appendChild(meta);

    // Contact info section
    if (listing.sellerName || listing.sellerPhone || listing.sellerEmail) {
      const contact = h('div', { class: 'marketplace-card-contact' });
      if (listing.sellerName) {
        contact.appendChild(h('span', { class: 'marketplace-contact-item' }, `\u{1F464} ${listing.sellerName}`));
      }
      if (listing.sellerPhone) {
        const phoneLink = h('a', {
          class: 'marketplace-contact-item marketplace-contact-link',
          href: `tel:${listing.sellerPhone.replace(/\s/g, '')}`,
        }, `\u{1F4DE} ${listing.sellerPhone}`);
        phoneLink.addEventListener('click', (e) => e.stopPropagation()); // don't trigger card click
        contact.appendChild(phoneLink);
      }
      if (listing.sellerEmail) {
        const emailLink = h('a', {
          class: 'marketplace-contact-item marketplace-contact-link',
          href: `mailto:${listing.sellerEmail}`,
        }, `\u{2709}\uFE0F ${listing.sellerEmail}`);
        emailLink.addEventListener('click', (e) => e.stopPropagation());
        contact.appendChild(emailLink);
      }
      card.appendChild(contact);
    }

    // External link icon
    const linkIcon = h('span', { class: 'marketplace-card-link-icon' }, '\u{1F517}');
    card.appendChild(linkIcon);

    return card;
  }

  private buildArbitrageCard(match: ArbitrageMatch): HTMLElement {
    const card = h('div', { class: 'marketplace-arbitrage-card' });

    const flow = h('div', { class: 'marketplace-arbitrage-flow' });

    // Buy from
    const buyFrom = h('div', { class: 'marketplace-arbitrage-side marketplace-arbitrage-buy-from' });
    buyFrom.appendChild(h('div', { class: 'marketplace-arbitrage-label' }, '\u{1F6D2} Compra da'));
    buyFrom.appendChild(h('div', { class: 'marketplace-arbitrage-title' }, (match.sellListing.title)));
    buyFrom.appendChild(h('div', { class: 'marketplace-arbitrage-price' }, (match.sellListing.price)));
    buyFrom.appendChild(h('div', { class: 'marketplace-arbitrage-platform' }, (match.sellListing.platform)));
    flow.appendChild(buyFrom);

    // Arrow
    flow.appendChild(h('div', { class: 'marketplace-arbitrage-arrow' }, '\u27A1\uFE0F'));

    // Sell to
    const sellTo = h('div', { class: 'marketplace-arbitrage-side marketplace-arbitrage-sell-to' });
    sellTo.appendChild(h('div', { class: 'marketplace-arbitrage-label' }, '\u{1F4B0} Vendi a'));
    sellTo.appendChild(h('div', { class: 'marketplace-arbitrage-title' }, (match.buyRequest.title)));
    sellTo.appendChild(h('div', { class: 'marketplace-arbitrage-price' }, (match.buyRequest.price)));
    sellTo.appendChild(h('div', { class: 'marketplace-arbitrage-platform' }, (match.buyRequest.platform)));
    flow.appendChild(sellTo);

    card.appendChild(flow);

    // Profit
    const profitBar = h('div', { class: 'marketplace-arbitrage-profit' });
    profitBar.appendChild(h('span', { class: 'marketplace-arbitrage-profit-label' }, `Profitto stimato: ${(match.estimatedProfit)}`));
    const profitPct = h('span', { class: 'marketplace-arbitrage-profit-pct' });
    profitPct.textContent = `+${match.profitPercent}%`;
    profitPct.style.color = match.profitPercent >= 20 ? '#10b981' : '#f59e0b';
    profitBar.appendChild(profitPct);
    card.appendChild(profitBar);

    // AI Note
    if (match.aiNote) {
      card.appendChild(h('div', { class: 'marketplace-arbitrage-note' }, `\u{1F916} ${(match.aiNote)}`));
    }

    return card;
  }

  private getContentArea(): HTMLElement | null {
    const el = this.getElement();
    let content = el.querySelector<HTMLElement>('.panel-content');
    if (!content) {
      content = h('div', { class: 'panel-content' }) as HTMLElement;
      el.appendChild(content);
    }
    return content;
  }
}
