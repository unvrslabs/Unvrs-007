/**
 * RPC: GetProductTrends
 * Generates AI-powered product trend analysis with supplier discovery.
 * Identifies trending products sold online and finds suppliers.
 */

declare const process: { env: Record<string, string | undefined> };

import type {
  ServerContext,
  GetProductTrendsRequest,
  GetProductTrendsResponse,
  ProductTrend,
  ProductSupplier,
  TrendCategory,
} from '../../../../src/generated/server/worldmonitor/ai_invest/v1/service_server';

import { cachedFetchJson } from '../../../_shared/redis';
import { GROQ_API_URL, GROQ_MODEL, UPSTREAM_TIMEOUT_MS, hashString } from './_shared';
import { CHROME_UA } from '../../../_shared/constants';

const TRENDS_CACHE_TTL = 1800; // 30 min

const SYSTEM_PROMPT = `Sei un analista esperto di e-commerce e tendenze di mercato. Analizzi i prodotti piu' venduti online, le tendenze emergenti e trovi fornitori affidabili.

ISTRUZIONI:
1. Identifica 8-12 prodotti di tendenza venduti online nel paese specificato
2. Per ogni prodotto, fornisci dati realistici su domanda, ricerche mensili, piattaforme dove viene venduto
3. Identifica 6-10 fornitori reali o realistici per i prodotti di tendenza (grossisti, produttori, distributori)
4. Categorizza i prodotti per settore e valuta la domanda
5. Genera sparkline (array di 12 numeri che rappresentano 12 mesi di trend)

CATEGORIE PRODOTTO:
- Elettronica (smartphone, accessori, gadget, domotica)
- Moda (abbigliamento, scarpe, accessori, vintage)
- Casa & Giardino (arredamento, decorazioni, utensili)
- Salute & Bellezza (skincare, integratori, fitness)
- Sport & Outdoor (attrezzatura, abbigliamento sportivo)
- Alimentare (prodotti bio, specialita', integratori)
- Bambini & Giochi (giocattoli, educativi, abbigliamento)
- Auto & Moto (accessori, ricambi, tuning)

PIATTAFORME da considerare: Amazon, eBay, Subito.it, Etsy, Alibaba, AliExpress, Temu, Shein, Wallapop, Vinted

RISPONDI SOLO con JSON valido nel seguente formato:
{
  "trends": [
    {
      "id": "trend_1",
      "name": "Nome prodotto specifico",
      "category": "Elettronica",
      "demand_level": "Alto|Medio|Basso",
      "trend_direction": "up|stable|down",
      "price_range": "15-25 EUR",
      "monthly_searches": 45000,
      "sparkline": [30, 35, 40, 38, 45, 50, 55, 60, 58, 65, 70, 75],
      "platforms": ["Amazon", "eBay", "Temu"]
    }
  ],
  "suppliers": [
    {
      "id": "sup_1",
      "product_name": "Nome prodotto correlato",
      "supplier_name": "Nome fornitore/grossista",
      "platform": "Alibaba|AliExpress|Diretto|Grossista",
      "price": "8.50 EUR/pezzo",
      "moq": "50 pezzi",
      "location": "Shenzhen, Cina",
      "url": "https://example.com",
      "rating": 4.5,
      "contact_email": "supplier@example.com",
      "contact_phone": "+86 123 456 7890"
    }
  ],
  "categories": [
    {
      "category": "Elettronica",
      "demand_score": 85,
      "growth": "+12%",
      "top_product": "Auricolari wireless"
    }
  ],
  "summary": "Riepilogo delle tendenze principali in 2-3 frasi"
}`;

export async function getProductTrends(
  _ctx: ServerContext,
  req: GetProductTrendsRequest,
): Promise<GetProductTrendsResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return getDemoTrends();
  }

  const inputHash = hashString(`product-trends:${req.country}:${req.lang}`);
  const cacheKey = `ai-invest:trends:v1:${inputHash}`;

  try {
    const result = await cachedFetchJson<GetProductTrendsResponse>(
      cacheKey,
      TRENDS_CACHE_TTL,
      async () => {
        const userMessage = `PAESE: ${req.country || 'Italia'}
LINGUA: ${req.lang || 'it'}
DATA: ${new Date().toISOString().split('T')[0]}

Analizza le tendenze di prodotto attuali per il mercato ${req.country || 'italiano'}.
Identifica i prodotti piu' venduti e di tendenza online, e trova fornitori affidabili.
Concentrati su prodotti con alto margine di profitto per rivenditori.`;

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
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.4,
            max_tokens: 3000,
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
          trends?: Array<{
            id?: string; name?: string; category?: string; demand_level?: string;
            trend_direction?: string; price_range?: string; monthly_searches?: number;
            sparkline?: number[]; platforms?: string[];
          }>;
          suppliers?: Array<{
            id?: string; product_name?: string; supplier_name?: string; platform?: string;
            price?: string; moq?: string; location?: string; url?: string;
            rating?: number; contact_email?: string; contact_phone?: string;
          }>;
          categories?: Array<{
            category?: string; demand_score?: number; growth?: string; top_product?: string;
          }>;
          summary?: string;
        };

        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return null;
        }

        const trends: ProductTrend[] = (parsed.trends || []).map((t, i) => ({
          id: t.id || `trend_${i + 1}`,
          name: t.name || '',
          category: t.category || 'Altro',
          demandLevel: t.demand_level || 'Medio',
          trendDirection: t.trend_direction || 'stable',
          priceRange: t.price_range || '',
          monthlySearches: t.monthly_searches || 0,
          sparkline: t.sparkline || [],
          platforms: t.platforms || [],
        }));

        const suppliers: ProductSupplier[] = (parsed.suppliers || []).map((s, i) => ({
          id: s.id || `sup_${i + 1}`,
          productName: s.product_name || '',
          supplierName: s.supplier_name || '',
          platform: s.platform || '',
          price: s.price || '',
          moq: s.moq || '',
          location: s.location || '',
          url: s.url || '',
          rating: s.rating || 0,
          contactEmail: s.contact_email || '',
          contactPhone: s.contact_phone || '',
        }));

        const categories: TrendCategory[] = (parsed.categories || []).map((c) => ({
          category: c.category || '',
          demandScore: c.demand_score || 0,
          growth: c.growth || '0%',
          topProduct: c.top_product || '',
        }));

        return {
          trends,
          suppliers,
          categories,
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
        trends: [],
        suppliers: [],
        categories: [],
        summary: '',
        model: GROQ_MODEL,
        generatedAt: Date.now(),
        cached: false,
        error: 'Analisi tendenze non disponibile al momento. Riprova tra qualche minuto.',
      };
    }

    return result;
  } catch {
    return {
      trends: [],
      suppliers: [],
      categories: [],
      summary: '',
      model: GROQ_MODEL,
      generatedAt: Date.now(),
      cached: false,
      error: 'Errore durante l\'analisi tendenze. Riprova tra qualche minuto.',
    };
  }
}

// ============================================================
// Demo data for local development (no GROQ_API_KEY required)
// ============================================================

function getDemoTrends(): GetProductTrendsResponse {
  const trends: ProductTrend[] = [
    {
      id: 'trend_1',
      name: 'Auricolari Wireless ANC',
      category: 'Elettronica',
      demandLevel: 'Alto',
      trendDirection: 'up',
      priceRange: '20-80 EUR',
      monthlySearches: 74000,
      sparkline: [40, 42, 45, 48, 52, 55, 60, 63, 67, 70, 74, 78],
      platforms: ['Amazon', 'eBay', 'Temu', 'AliExpress'],
    },
    {
      id: 'trend_2',
      name: 'Lampade LED Smart WiFi',
      category: 'Casa & Giardino',
      demandLevel: 'Alto',
      trendDirection: 'up',
      priceRange: '12-35 EUR',
      monthlySearches: 52000,
      sparkline: [30, 33, 35, 38, 42, 45, 48, 50, 53, 56, 58, 62],
      platforms: ['Amazon', 'eBay', 'Leroy Merlin'],
    },
    {
      id: 'trend_3',
      name: 'Creatina Monoidrato 500g',
      category: 'Salute & Bellezza',
      demandLevel: 'Alto',
      trendDirection: 'up',
      priceRange: '15-30 EUR',
      monthlySearches: 61000,
      sparkline: [35, 38, 40, 43, 46, 50, 55, 58, 62, 65, 68, 72],
      platforms: ['Amazon', 'MyProtein', 'Bulk'],
    },
    {
      id: 'trend_4',
      name: 'Cover MagSafe iPhone 16',
      category: 'Elettronica',
      demandLevel: 'Alto',
      trendDirection: 'up',
      priceRange: '8-25 EUR',
      monthlySearches: 89000,
      sparkline: [10, 15, 25, 40, 55, 65, 72, 78, 82, 85, 88, 92],
      platforms: ['Amazon', 'eBay', 'AliExpress', 'Temu'],
    },
    {
      id: 'trend_5',
      name: 'Tappetino Yoga Antiscivolo',
      category: 'Sport & Outdoor',
      demandLevel: 'Medio',
      trendDirection: 'stable',
      priceRange: '15-45 EUR',
      monthlySearches: 33000,
      sparkline: [28, 30, 32, 30, 31, 33, 35, 34, 36, 35, 37, 38],
      platforms: ['Amazon', 'Decathlon', 'eBay'],
    },
    {
      id: 'trend_6',
      name: 'Friggitrice ad Aria 6L',
      category: 'Casa & Giardino',
      demandLevel: 'Alto',
      trendDirection: 'up',
      priceRange: '50-120 EUR',
      monthlySearches: 95000,
      sparkline: [45, 48, 50, 55, 58, 62, 65, 70, 75, 80, 88, 95],
      platforms: ['Amazon', 'MediaWorld', 'Unieuro'],
    },
    {
      id: 'trend_7',
      name: 'Sneakers Retro Running',
      category: 'Moda',
      demandLevel: 'Alto',
      trendDirection: 'up',
      priceRange: '40-130 EUR',
      monthlySearches: 67000,
      sparkline: [35, 38, 40, 42, 45, 50, 55, 58, 60, 63, 65, 70],
      platforms: ['Amazon', 'Zalando', 'Vinted', 'StockX'],
    },
    {
      id: 'trend_8',
      name: 'Siero Vitamina C Viso',
      category: 'Salute & Bellezza',
      demandLevel: 'Medio',
      trendDirection: 'up',
      priceRange: '8-22 EUR',
      monthlySearches: 41000,
      sparkline: [22, 25, 28, 30, 33, 35, 38, 40, 42, 44, 46, 48],
      platforms: ['Amazon', 'Notino', 'Lookfantastic'],
    },
    {
      id: 'trend_9',
      name: 'Mini Proiettore Portatile',
      category: 'Elettronica',
      demandLevel: 'Medio',
      trendDirection: 'up',
      priceRange: '60-200 EUR',
      monthlySearches: 28000,
      sparkline: [15, 18, 20, 22, 25, 28, 32, 35, 38, 40, 42, 45],
      platforms: ['Amazon', 'AliExpress', 'eBay'],
    },
    {
      id: 'trend_10',
      name: 'Giochi Montessori Legno',
      category: 'Bambini & Giochi',
      demandLevel: 'Medio',
      trendDirection: 'up',
      priceRange: '10-35 EUR',
      monthlySearches: 36000,
      sparkline: [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42],
      platforms: ['Amazon', 'Etsy', 'eBay'],
    },
  ];

  const suppliers: ProductSupplier[] = [
    {
      id: 'sup_1',
      productName: 'Auricolari Wireless ANC',
      supplierName: 'Shenzhen SoundTech Co.',
      platform: 'Alibaba',
      price: '4.80 EUR/pezzo',
      moq: '100 pezzi',
      location: 'Shenzhen, Cina',
      url: 'https://www.alibaba.com',
      rating: 4.6,
      contactEmail: 'sales@soundtech-sz.com',
      contactPhone: '+86 755 8888 1234',
    },
    {
      id: 'sup_2',
      productName: 'Cover MagSafe iPhone 16',
      supplierName: 'Dongguan CasePro Factory',
      platform: 'AliExpress',
      price: '1.20 EUR/pezzo',
      moq: '50 pezzi',
      location: 'Dongguan, Cina',
      url: 'https://www.aliexpress.com',
      rating: 4.3,
      contactEmail: 'info@casepro-dg.com',
      contactPhone: '+86 769 7777 5678',
    },
    {
      id: 'sup_3',
      productName: 'Lampade LED Smart WiFi',
      supplierName: 'Ningbo SmartLight Ltd.',
      platform: 'Alibaba',
      price: '3.50 EUR/pezzo',
      moq: '200 pezzi',
      location: 'Ningbo, Cina',
      url: 'https://www.alibaba.com',
      rating: 4.5,
      contactEmail: 'export@smartlight-nb.com',
      contactPhone: '+86 574 6666 9012',
    },
    {
      id: 'sup_4',
      productName: 'Friggitrice ad Aria 6L',
      supplierName: 'Foshan KitchenMaster Co.',
      platform: 'Alibaba',
      price: '18.00 EUR/pezzo',
      moq: '30 pezzi',
      location: 'Foshan, Cina',
      url: 'https://www.alibaba.com',
      rating: 4.7,
      contactEmail: 'trade@kitchenmaster-fs.com',
      contactPhone: '+86 757 5555 3456',
    },
    {
      id: 'sup_5',
      productName: 'Creatina Monoidrato 500g',
      supplierName: 'NutraItalia Srl',
      platform: 'Grossista',
      price: '6.50 EUR/pezzo',
      moq: '100 pezzi',
      location: 'Modena, Italia',
      url: 'https://www.nutraitalia.it',
      rating: 4.8,
      contactEmail: 'ordini@nutraitalia.it',
      contactPhone: '+39 059 123 4567',
    },
    {
      id: 'sup_6',
      productName: 'Mini Proiettore Portatile',
      supplierName: 'Shenzhen ProjectX Tech',
      platform: 'AliExpress',
      price: '22.00 EUR/pezzo',
      moq: '20 pezzi',
      location: 'Shenzhen, Cina',
      url: 'https://www.aliexpress.com',
      rating: 4.2,
      contactEmail: 'sales@projectx-tech.com',
      contactPhone: '+86 755 4444 7890',
    },
    {
      id: 'sup_7',
      productName: 'Siero Vitamina C Viso',
      supplierName: 'Guangzhou BeautyChem Lab',
      platform: 'Alibaba',
      price: '1.80 EUR/pezzo',
      moq: '500 pezzi',
      location: 'Guangzhou, Cina',
      url: 'https://www.alibaba.com',
      rating: 4.4,
      contactEmail: 'cosmetics@beautychem-gz.com',
      contactPhone: '+86 20 3333 4567',
    },
    {
      id: 'sup_8',
      productName: 'Giochi Montessori Legno',
      supplierName: 'WoodCraft Europa Kft.',
      platform: 'Diretto',
      price: '3.20 EUR/pezzo',
      moq: '200 pezzi',
      location: 'Budapest, Ungheria',
      url: 'https://www.woodcraft-eu.com',
      rating: 4.6,
      contactEmail: 'orders@woodcraft-eu.com',
      contactPhone: '+36 1 234 5678',
    },
  ];

  const categories: TrendCategory[] = [
    { category: 'Elettronica', demandScore: 92, growth: '+18%', topProduct: 'Cover MagSafe iPhone 16' },
    { category: 'Casa & Giardino', demandScore: 88, growth: '+15%', topProduct: 'Friggitrice ad Aria 6L' },
    { category: 'Salute & Bellezza', demandScore: 78, growth: '+12%', topProduct: 'Creatina Monoidrato' },
    { category: 'Moda', demandScore: 72, growth: '+8%', topProduct: 'Sneakers Retro Running' },
    { category: 'Sport & Outdoor', demandScore: 65, growth: '+5%', topProduct: 'Tappetino Yoga' },
    { category: 'Bambini & Giochi', demandScore: 60, growth: '+10%', topProduct: 'Giochi Montessori Legno' },
  ];

  return {
    trends,
    suppliers,
    categories,
    summary: 'Il mercato e-commerce italiano mostra forte crescita nell\'elettronica di consumo e nei prodotti per la casa smart. Le cover per iPhone 16 e le friggitrici ad aria dominano le ricerche. Il settore integratori sportivi continua a crescere trainato dal fitness trend. I margini migliori si trovano nell\'importazione diretta da fornitori cinesi con rivendita su Amazon/eBay.',
    model: 'demo-mode',
    generatedAt: Date.now(),
    cached: false,
    error: '',
  };
}
