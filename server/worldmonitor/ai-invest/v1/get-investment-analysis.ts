/**
 * RPC: GetInvestmentAnalysis
 * Generates AI-powered investment opportunities with visible reasoning chain.
 */

declare const process: { env: Record<string, string | undefined> };

import type {
  ServerContext,
  GetInvestmentAnalysisRequest,
  GetInvestmentAnalysisResponse,
  ReasoningStep,
  InvestmentOpportunity,
} from '../../../../src/generated/server/worldmonitor/ai_invest/v1/service_server';

import { cachedFetchJson } from '../../../_shared/redis';
import { GROQ_API_URL, GROQ_MODEL, UPSTREAM_TIMEOUT_MS, ANALYSIS_CACHE_TTL, hashString } from './_shared';
import { CHROME_UA } from '../../../_shared/constants';

const DISCLAIMER_IT = 'Questo non e\u0300 un consiglio finanziario o di investimento. Le analisi sono generate da intelligenza artificiale e hanno scopo puramente informativo. Consulta sempre un professionista autorizzato prima di prendere decisioni.';

const SYSTEM_PROMPT = `Sei un analista senior multi-dominio. Analizzi dati di mercato, notizie, indicatori economici, immobiliare, commodities, crypto, e contesto geopolitico per identificare QUALSIASI tipo di opportunita' per fare soldi.

DOMINI DI ANALISI (valuta TUTTI, non solo la borsa):
- MERCATI FINANZIARI: azioni, ETF, obbligazioni, indici
- IMMOBILIARE: zone sottovalutate, trend prezzi per citta'/quartiere, affitti, aste
- COMMODITIES: materie prime, oro, petrolio, gas, agricoltura
- CRYPTO: Bitcoin, altcoin, DeFi, NFT, staking
- ARBITRAGGIO: differenze di prezzo tra piattaforme, marketplace, rivendita
- BUSINESS: settori in crescita, trend di mercato, nicchie emergenti
- ENERGIA: rinnovabili, mercato elettrico, incentivi statali
- COLLEZIONISMO: arte, orologi, auto d'epoca, sneakers, carte collezionabili

ISTRUZIONI:
1. Analizza TUTTI i dati forniti in modo trasversale
2. Cerca opportunita' in OGNI dominio, non limitarti alla borsa
3. Identifica correlazioni tra settori diversi (es. notizie su energia → impatto immobiliare)
4. Proponi opportunita' concrete, specifiche, azionabili
5. Prioritizza quelle con miglior rapporto rischio/rendimento

RISPONDI SOLO con JSON valido nel seguente formato:
{
  "reasoning": [
    {
      "step": 1,
      "category": "data_scan",
      "description": "Descrizione di cosa hai osservato nei dati",
      "evidence": "Dato specifico a supporto"
    }
  ],
  "opportunities": [
    {
      "id": "opp_1",
      "asset": "Nome asset, proprieta', prodotto o opportunita'",
      "action": "COMPRA|VENDI|MONITORA|EVITA",
      "confidence": 75,
      "rationale": "Motivazione dettagliata",
      "data_sources": ["markets", "news"],
      "time_horizon": "short|medium|long",
      "risk_level": "low|medium|high",
      "current_value": "valore attuale o range di prezzo",
      "category": "mercati|immobiliare|commodities|crypto|arbitraggio|business|energia|collezionismo"
    }
  ],
  "market_outlook": "Riassunto outlook generale in 2-3 frasi, coprendo piu' settori"
}

CATEGORIE REASONING: data_scan, pattern_detection, correlation, cross_sector, conclusion
AZIONI: COMPRA (segnale forte), VENDI (segnale ribassista), MONITORA (interessante ma incerto), EVITA (rischio elevato)
ORIZZONTE: short (giorni-settimana), medium (settimane-mese), long (mesi-anno)

Genera almeno 4 step di ragionamento e 3-6 opportunita' DISTRIBUITE su piu' domini. Non concentrarti solo su un settore.`;

export async function getInvestmentAnalysis(
  _ctx: ServerContext,
  req: GetInvestmentAnalysisRequest,
): Promise<GetInvestmentAnalysisResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Return demo data for local development
    return getDemoAnalysis();
  }

  const inputHash = hashString(
    `${req.marketSummary}|${req.newsSummary}|${req.economicSummary}|${req.focus}`.slice(0, 2000),
  );
  const cacheKey = `ai-invest:analysis:v1:${inputHash}`;

  try {
    const result = await cachedFetchJson<GetInvestmentAnalysisResponse>(
      cacheKey,
      ANALYSIS_CACHE_TTL,
      async () => {
        const userMessage = `FOCUS: ${req.focus || 'italia'}
LINGUA: ${req.lang || 'it'}

=== DATI DI MERCATO ===
${req.marketSummary || 'Nessun dato di mercato disponibile'}

=== NOTIZIE ===
${req.newsSummary || 'Nessuna notizia disponibile'}

=== INDICATORI ECONOMICI ===
${req.economicSummary || 'Nessun dato economico disponibile'}

Analizza tutti i dati e genera opportunita' di investimento.`;

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
            temperature: 0.3,
            max_tokens: 2000,
          }),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });

        if (!resp.ok) return null;

        const data = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (!raw) return null;

        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = raw;
        const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1]!.trim();

        let parsed: {
          reasoning?: Array<{ step?: number; category?: string; description?: string; evidence?: string }>;
          opportunities?: Array<{
            id?: string; asset?: string; action?: string; confidence?: number;
            rationale?: string; data_sources?: string[]; time_horizon?: string;
            risk_level?: string; current_value?: string; category?: string;
          }>;
          market_outlook?: string;
        };

        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return null;
        }

        const reasoning: ReasoningStep[] = (parsed.reasoning || []).map((r, i) => ({
          step: r.step || i + 1,
          category: r.category || 'data_scan',
          description: r.description || '',
          evidence: r.evidence || '',
        }));

        const opportunities: InvestmentOpportunity[] = (parsed.opportunities || []).map((o, i) => ({
          id: o.id || `opp_${i + 1}`,
          asset: o.asset || '',
          action: o.action || 'MONITORA',
          confidence: Math.min(100, Math.max(0, o.confidence || 50)),
          rationale: o.rationale || '',
          dataSources: o.data_sources || [],
          timeHorizon: o.time_horizon || 'medium',
          riskLevel: o.risk_level || 'medium',
          currentValue: o.current_value || '',
          category: o.category || 'mercati',
        }));

        return {
          reasoning,
          opportunities,
          marketOutlook: parsed.market_outlook || '',
          model: GROQ_MODEL,
          generatedAt: Date.now(),
          cached: false,
          disclaimer: DISCLAIMER_IT,
          error: '',
        };
      },
    );

    if (!result) {
      return {
        reasoning: [],
        opportunities: [],
        marketOutlook: '',
        model: GROQ_MODEL,
        generatedAt: Date.now(),
        cached: false,
        disclaimer: DISCLAIMER_IT,
        error: 'Analisi non disponibile al momento. Riprova tra qualche minuto.',
      };
    }

    return { ...result, disclaimer: DISCLAIMER_IT };
  } catch {
    return {
      reasoning: [],
      opportunities: [],
      marketOutlook: '',
      model: GROQ_MODEL,
      generatedAt: Date.now(),
      cached: false,
      disclaimer: DISCLAIMER_IT,
      error: 'Errore durante l\'analisi. Riprova tra qualche minuto.',
    };
  }
}

// ============================================================
// Demo data for local development (no GROQ_API_KEY required)
// ============================================================

function getDemoAnalysis(): GetInvestmentAnalysisResponse {
  const reasoning: ReasoningStep[] = [
    {
      step: 1,
      category: 'data_scan',
      description: 'Scansione dei dati di mercato: FTSE MIB in crescita del +1.2%, settore bancario forte. EUR/USD stabile a 1.085.',
      evidence: 'FTSE MIB: 34,520 (+1.2%), Unicredit +2.8%, Intesa +1.9%',
    },
    {
      step: 2,
      category: 'pattern_detection',
      description: 'Pattern rialzista nel settore immobiliare: i prezzi nelle citta\' di media dimensione (Bergamo, Brescia, Padova) sono cresciuti del 5-8% nell\'ultimo trimestre, superando Milano.',
      evidence: 'Dati OMI: Bergamo +7.2%, Brescia +5.8%, Padova +6.1% vs Milano +2.3%',
    },
    {
      step: 3,
      category: 'cross_sector',
      description: 'Correlazione energia-immobiliare: i nuovi incentivi per la riqualificazione energetica (Bonus Casa 2025) stanno spingendo la domanda di immobili da ristrutturare nelle zone periferiche.',
      evidence: 'Decreto Bonus Casa 50% confermato, domanda immobili classe F-G in aumento del 15%',
    },
    {
      step: 4,
      category: 'correlation',
      description: 'Il prezzo dell\'oro ha raggiunto nuovi massimi storici a $2,850/oz. Segnale di risk-off globale che potrebbe impattare le commodities agricole.',
      evidence: 'Oro: $2,850/oz (+12% YTD), rendimenti Treasury USA in calo',
    },
    {
      step: 5,
      category: 'conclusion',
      description: 'Le condizioni attuali favoriscono un approccio diversificato: immobiliare in citta\' medie, settore bancario italiano, e posizioni difensive in oro. Attenzione al rischio geopolitico.',
      evidence: 'Spread BTP-Bund a 125bp, sotto la media storica di 180bp',
    },
  ];

  const opportunities: InvestmentOpportunity[] = [
    {
      id: 'opp_1',
      asset: 'Immobili da ristrutturare a Bergamo/Brescia',
      action: 'COMPRA',
      confidence: 82,
      rationale: 'I prezzi nelle citta\' di media dimensione lombarde stanno crescendo piu\' di Milano. Con il Bonus Casa 50% attivo, gli immobili di classe F-G offrono un margine di rivalutazione del 15-25% dopo la ristrutturazione. Domanda in forte crescita da famiglie che lasciano Milano.',
      dataSources: ['immobiliare', 'incentivi_fiscali', 'demografia'],
      timeHorizon: 'medium',
      riskLevel: 'medium',
      currentValue: '1,200-1,800 EUR/mq (classe F-G)',
      category: 'immobiliare',
    },
    {
      id: 'opp_2',
      asset: 'Unicredit (UCG.MI)',
      action: 'COMPRA',
      confidence: 75,
      rationale: 'Settore bancario italiano in forte momentum. P/E di Unicredit a 6.5x, significativamente sotto la media europea di 9x. Buyback da 3.5 miliardi annunciato. Target price consenso a +18% dal livello attuale.',
      dataSources: ['markets', 'earnings'],
      timeHorizon: 'short',
      riskLevel: 'medium',
      currentValue: '38.50 EUR (+2.8% oggi)',
      category: 'mercati',
    },
    {
      id: 'opp_3',
      asset: 'Oro fisico / ETF Gold',
      action: 'MONITORA',
      confidence: 68,
      rationale: 'L\'oro ha raggiunto massimi storici ma il momentum resta forte. Le tensioni geopolitiche e i tagli tassi attesi dalla BCE supportano ulteriori rialzi. Rischio di correzione tecnica nel breve.',
      dataSources: ['commodities', 'macro'],
      timeHorizon: 'long',
      riskLevel: 'low',
      currentValue: '$2,850/oz',
      category: 'commodities',
    },
    {
      id: 'opp_4',
      asset: 'Pannelli solari residenziali (rivendita e installazione)',
      action: 'COMPRA',
      confidence: 71,
      rationale: 'Il costo dei pannelli solari e\' sceso del 40% in 2 anni mentre gli incentivi restano alti. Margini di rivendita del 25-35% per installatori. Domanda in crescita del 22% YoY.',
      dataSources: ['energia', 'incentivi_fiscali'],
      timeHorizon: 'medium',
      riskLevel: 'low',
      currentValue: 'Investimento: 8,000-15,000 EUR per impianto domestico',
      category: 'energia',
    },
    {
      id: 'opp_5',
      asset: 'Bitcoin (BTC)',
      action: 'MONITORA',
      confidence: 60,
      rationale: 'BTC sopra i $95,000 con ETF che attraggono flussi record. Halving recente supporta la tesi rialzista. Volatilita\' elevata consiglia ingressi graduali con DCA.',
      dataSources: ['crypto', 'etf_flows'],
      timeHorizon: 'long',
      riskLevel: 'high',
      currentValue: '$97,200',
      category: 'crypto',
    },
  ];

  return {
    reasoning,
    opportunities,
    marketOutlook: 'Il mercato italiano si trova in una fase costruttiva, supportato da un settore bancario forte e da un immobiliare in espansione nelle citta\' secondarie. Le tensioni geopolitiche globali consigliano posizioni difensive in oro e una diversificazione settoriale. I nuovi incentivi energetici creano opportunita\' concrete nel fotovoltaico residenziale.',
    model: 'demo-mode',
    generatedAt: Date.now(),
    cached: false,
    disclaimer: DISCLAIMER_IT,
    error: '',
  };
}
