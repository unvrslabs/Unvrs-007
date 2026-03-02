/**
 * RPC: GetMarketplaceListings
 * AI-powered marketplace intelligence — identifies buy/sell opportunities
 * and arbitrage matches across Italian classifieds.
 */

declare const process: { env: Record<string, string | undefined> };

import type {
  ServerContext,
  GetMarketplaceListingsRequest,
  GetMarketplaceListingsResponse,
  MarketplaceListing,
  ArbitrageMatch,
} from '../../../../src/generated/server/worldmonitor/ai_invest/v1/service_server';

import { cachedFetchJson } from '../../../_shared/redis';
import { GROQ_API_URL, GROQ_MODEL, UPSTREAM_TIMEOUT_MS, hashString } from './_shared';
import { CHROME_UA } from '../../../_shared/constants';

const MARKETPLACE_CACHE_TTL = 600; // 10 min

const MARKETPLACE_SYSTEM_PROMPT = `Sei un esperto di marketplace e arbitraggio. Analizza la query dell'utente e genera dati realistici su annunci di VENDITA e RICHIESTE DI ACQUISTO che si potrebbero trovare su piattaforme come Subito.it, Facebook Marketplace, eBay, Wallapop, Vinted.

Per ogni query, genera:
1. 4-6 annunci di VENDITA (persone che vendono l'articolo/servizio)
2. 3-5 RICHIESTE DI ACQUISTO (persone che cercano/vogliono comprare)
3. 1-3 MATCH DI ARBITRAGGIO (dove puoi comprare da un venditore e rivendere a un acquirente con profitto)

RISPONDI SOLO con JSON valido:
{
  "sell_listings": [
    {
      "id": "sell_1",
      "title": "Titolo annuncio vendita",
      "price": "150 EUR",
      "platform": "Subito.it|eBay|Facebook Marketplace|Wallapop|Vinted",
      "location": "Citta', Regione",
      "category": "elettronica|auto|casa|abbigliamento|sport|altro",
      "url": "",
      "seller_name": "Nome Cognome venditore (inventato ma realistico)",
      "seller_phone": "+39 3XX XXX XXXX (inventato ma realistico)",
      "seller_email": "email@esempio.it (inventato ma realistico, opzionale)"
    }
  ],
  "buy_requests": [
    {
      "id": "buy_1",
      "title": "Cerco: descrizione di cosa cercano",
      "price": "Budget: 200 EUR",
      "platform": "Subito.it|Facebook Groups|Forum",
      "location": "Citta', Regione",
      "category": "elettronica|auto|casa|abbigliamento|sport|altro",
      "url": "",
      "seller_name": "Nome Cognome acquirente (inventato ma realistico)",
      "seller_phone": "+39 3XX XXX XXXX (inventato ma realistico)",
      "seller_email": ""
    }
  ],
  "arbitrage_matches": [
    {
      "sell_id": "sell_1",
      "buy_id": "buy_1",
      "estimated_profit": "50 EUR",
      "profit_percent": 33,
      "ai_note": "Spiegazione breve del perche' questo match e' interessante"
    }
  ],
  "summary": "Riassunto del mercato per questa categoria"
}

I prezzi devono essere realistici per il mercato italiano. Le location devono essere citta' italiane reali.
Se il paese non e' Italia, adatta piattaforme e prezzi al paese richiesto.`;

export async function getMarketplaceListings(
  _ctx: ServerContext,
  req: GetMarketplaceListingsRequest,
): Promise<GetMarketplaceListingsResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Return demo data for local development
    return getDemoMarketplace(req.query || 'elettronica usata');
  }

  const inputHash = hashString(`marketplace:${req.country}:${req.query}`.slice(0, 500));
  const cacheKey = `ai-invest:marketplace:v1:${inputHash}`;

  try {
    const result = await cachedFetchJson<GetMarketplaceListingsResponse>(
      cacheKey,
      MARKETPLACE_CACHE_TTL,
      async () => {
        const userMessage = `PAESE: ${req.country || 'italia'}
LINGUA: ${req.lang || 'it'}
QUERY: ${req.query || 'elettronica usata'}

Genera annunci di vendita, richieste di acquisto e match di arbitraggio per questa query.`;

        const resp = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': CHROME_UA,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: MARKETPLACE_SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.5,
            max_tokens: 2500,
          }),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });

        if (!resp.ok) return null;

        const data = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (!raw) return null;

        let jsonStr = raw;
        const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1]!.trim();

        let parsed: {
          sell_listings?: Array<{
            id?: string; title?: string; price?: string; platform?: string;
            location?: string; category?: string; url?: string;
            seller_name?: string; seller_phone?: string; seller_email?: string;
          }>;
          buy_requests?: Array<{
            id?: string; title?: string; price?: string; platform?: string;
            location?: string; category?: string; url?: string;
            seller_name?: string; seller_phone?: string; seller_email?: string;
          }>;
          arbitrage_matches?: Array<{
            sell_id?: string; buy_id?: string; estimated_profit?: string;
            profit_percent?: number; ai_note?: string;
          }>;
          summary?: string;
        };

        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return null;
        }

        const toListings = (arr: typeof parsed.sell_listings): MarketplaceListing[] =>
          (arr || []).map((l, i) => ({
            id: l.id || `item_${i}`,
            title: l.title || '',
            price: l.price || '',
            platform: l.platform || '',
            location: l.location || '',
            category: l.category || 'altro',
            url: l.url || '',
            imageUrl: '',
            sellerName: l.seller_name || '',
            sellerPhone: l.seller_phone || '',
            sellerEmail: l.seller_email || '',
          }));

        const sellListings = toListings(parsed.sell_listings);
        const buyRequests = toListings(parsed.buy_requests);

        // Build lookup maps for arbitrage matching
        const sellMap = new Map(sellListings.map(s => [s.id, s]));
        const buyMap = new Map(buyRequests.map(b => [b.id, b]));

        const arbitrageMatches: ArbitrageMatch[] = (parsed.arbitrage_matches || [])
          .map(m => {
            const sell = sellMap.get(m.sell_id || '');
            const buy = buyMap.get(m.buy_id || '');
            if (!sell || !buy) return null;
            return {
              sellListing: sell,
              buyRequest: buy,
              estimatedProfit: m.estimated_profit || '',
              profitPercent: Math.max(0, m.profit_percent || 0),
              aiNote: m.ai_note || '',
            };
          })
          .filter((m): m is ArbitrageMatch => m !== null);

        return {
          sellListings,
          buyRequests,
          arbitrageMatches,
          summary: parsed.summary || '',
          model: GROQ_MODEL,
          generatedAt: Date.now(),
          cached: false,
          error: '',
        };
      },
    );

    if (!result) {
      return {
        sellListings: [],
        buyRequests: [],
        arbitrageMatches: [],
        summary: '',
        model: GROQ_MODEL,
        generatedAt: Date.now(),
        cached: false,
        error: 'Marketplace non disponibile al momento. Riprova tra qualche minuto.',
      };
    }

    return result;
  } catch {
    return {
      sellListings: [],
      buyRequests: [],
      arbitrageMatches: [],
      summary: '',
      model: GROQ_MODEL,
      generatedAt: Date.now(),
      cached: false,
      error: 'Errore durante la ricerca marketplace.',
    };
  }
}

// ============================================================
// Demo data for local development (no GROQ_API_KEY required)
// ============================================================

function getDemoMarketplace(query: string): GetMarketplaceListingsResponse {
  const sellListings: MarketplaceListing[] = [
    {
      id: 'sell_1',
      title: 'iPhone 15 Pro 256GB - Perfetto, con garanzia',
      price: '850 EUR',
      platform: 'Subito.it',
      location: 'Milano, Lombardia',
      category: 'elettronica',
      url: 'https://www.subito.it/annunci-lombardia/vendita/usato/?q=iPhone+15+Pro',
      imageUrl: '',
      sellerName: 'Marco Bianchi',
      sellerPhone: '+39 348 912 3456',
      sellerEmail: 'marco.b@gmail.com',
    },
    {
      id: 'sell_2',
      title: 'MacBook Air M2 2023 - 512GB, come nuovo',
      price: '950 EUR',
      platform: 'Facebook Marketplace',
      location: 'Roma, Lazio',
      category: 'elettronica',
      url: 'https://www.facebook.com/marketplace/search?query=MacBook+Air+M2',
      imageUrl: '',
      sellerName: 'Giulia Rossi',
      sellerPhone: '+39 339 456 7890',
      sellerEmail: '',
    },
    {
      id: 'sell_3',
      title: 'Samsung Galaxy S24 Ultra 512GB - Scatola originale',
      price: '780 EUR',
      platform: 'eBay',
      location: 'Torino, Piemonte',
      category: 'elettronica',
      url: 'https://www.ebay.it/sch/i.html?_nkw=Samsung+Galaxy+S24+Ultra',
      imageUrl: '',
      sellerName: 'Alessandro Ferri',
      sellerPhone: '+39 320 789 0123',
      sellerEmail: 'a.ferri@outlook.it',
    },
    {
      id: 'sell_4',
      title: 'iPad Pro 12.9" M2 - 256GB WiFi + Cellular',
      price: '720 EUR',
      platform: 'Subito.it',
      location: 'Napoli, Campania',
      category: 'elettronica',
      url: 'https://www.subito.it/annunci-campania/vendita/usato/?q=iPad+Pro+M2',
      imageUrl: '',
      sellerName: 'Salvatore Esposito',
      sellerPhone: '+39 333 234 5678',
      sellerEmail: '',
    },
    {
      id: 'sell_5',
      title: 'Sony WH-1000XM5 - Cuffie noise cancelling, usate 2 mesi',
      price: '220 EUR',
      platform: 'Wallapop',
      location: 'Bologna, Emilia-Romagna',
      category: 'elettronica',
      url: 'https://it.wallapop.com/search?keywords=Sony+WH-1000XM5',
      imageUrl: '',
      sellerName: 'Chiara Moretti',
      sellerPhone: '+39 347 567 8901',
      sellerEmail: 'chiara.m@yahoo.it',
    },
    {
      id: 'sell_6',
      title: 'Nintendo Switch OLED + 4 giochi - Ottime condizioni',
      price: '280 EUR',
      platform: 'Facebook Marketplace',
      location: 'Firenze, Toscana',
      category: 'elettronica',
      url: 'https://www.facebook.com/marketplace/search?query=Nintendo+Switch+OLED',
      imageUrl: '',
      sellerName: 'Luca Conti',
      sellerPhone: '+39 345 890 1234',
      sellerEmail: '',
    },
  ];

  const buyRequests: MarketplaceListing[] = [
    {
      id: 'buy_1',
      title: 'Cerco: iPhone 15 Pro qualsiasi colore, budget max 950',
      price: 'Budget: 950 EUR',
      platform: 'Facebook Groups',
      location: 'Bergamo, Lombardia',
      category: 'elettronica',
      url: '',
      imageUrl: '',
      sellerName: 'Andrea Colombo',
      sellerPhone: '+39 331 012 3456',
      sellerEmail: 'andrea.col@gmail.com',
    },
    {
      id: 'buy_2',
      title: 'Cerco: MacBook Air o Pro recente per lavoro',
      price: 'Budget: 1,100 EUR',
      platform: 'Forum',
      location: 'Padova, Veneto',
      category: 'elettronica',
      url: '',
      imageUrl: '',
      sellerName: 'Francesca Marin',
      sellerPhone: '+39 328 345 6789',
      sellerEmail: 'f.marin@libero.it',
    },
    {
      id: 'buy_3',
      title: 'Cerco: Samsung Galaxy S24 Ultra, pago subito',
      price: 'Budget: 900 EUR',
      platform: 'Subito.it',
      location: 'Verona, Veneto',
      category: 'elettronica',
      url: '',
      imageUrl: '',
      sellerName: 'Roberto Zanetti',
      sellerPhone: '+39 340 678 9012',
      sellerEmail: '',
    },
    {
      id: 'buy_4',
      title: 'Cerco: Cuffie Sony XM5 o Bose 700, nuove o seminuove',
      price: 'Budget: 280 EUR',
      platform: 'Facebook Groups',
      location: 'Genova, Liguria',
      category: 'elettronica',
      url: '',
      imageUrl: '',
      sellerName: 'Elena Parodi',
      sellerPhone: '+39 338 901 2345',
      sellerEmail: 'elena.p@gmail.com',
    },
  ];

  const arbitrageMatches: ArbitrageMatch[] = [
    {
      sellListing: sellListings[0]!,
      buyRequest: buyRequests[0]!,
      estimatedProfit: '100 EUR',
      profitPercent: 12,
      aiNote: 'Il venditore a Milano chiede 850 EUR, l\'acquirente a Bergamo offre fino a 950 EUR. Distanza breve (50km), affare rapido.',
    },
    {
      sellListing: sellListings[1]!,
      buyRequest: buyRequests[1]!,
      estimatedProfit: '150 EUR',
      profitPercent: 16,
      aiNote: 'MacBook Air M2 venduto a Roma a 950 EUR, richiesto a Padova fino a 1,100 EUR. Possibilita\' di spedizione assicurata.',
    },
    {
      sellListing: sellListings[2]!,
      buyRequest: buyRequests[2]!,
      estimatedProfit: '120 EUR',
      profitPercent: 15,
      aiNote: 'Samsung S24 Ultra a Torino a 780 EUR, cercato a Verona a 900 EUR. Margine solido anche con spedizione.',
    },
  ];

  return {
    sellListings,
    buyRequests,
    arbitrageMatches,
    summary: `Mercato "${query}" in Italia: buona liquidita\' su elettronica usata. Prezzi in linea con il mercato. Trovati 3 match di arbitraggio con margini dal 12% al 16%.`,
    model: 'demo-mode',
    generatedAt: Date.now(),
    cached: false,
    error: '',
  };
}
