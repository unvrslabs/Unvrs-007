/**
 * RPC: GetMarketRadar
 * Quick market sentiment scan from headlines and price changes.
 */

declare const process: { env: Record<string, string | undefined> };

import type {
  ServerContext,
  GetMarketRadarRequest,
  GetMarketRadarResponse,
  MarketSignal,
} from '../../../../src/generated/server/worldmonitor/ai_invest/v1/service_server';

import { cachedFetchJson } from '../../../_shared/redis';
import { GROQ_API_URL, GROQ_MODEL, UPSTREAM_TIMEOUT_MS, RADAR_CACHE_TTL, hashString } from './_shared';
import { CHROME_UA } from '../../../_shared/constants';

const RADAR_SYSTEM_PROMPT = `Sei un analista multi-settore specializzato in sentiment analysis. Analizzi titoli di notizie e variazioni di prezzo per identificare segnali in TUTTI i settori: finanza, immobiliare, commodities, crypto, energia, business, consumi.

RISPONDI SOLO con JSON valido:
{
  "signals": [
    {
      "type": "bullish|bearish|neutral|risk_event|opportunity",
      "sector": "Settore specifico (es. Immobiliare Milano, Crypto DeFi, Energia Solare, ecc.)",
      "description": "Descrizione breve del segnale",
      "strength": 3
    }
  ],
  "overall_sentiment": "bullish|bearish|mixed|cautious",
  "summary": "Riassunto in una frase del sentiment multi-settore"
}

TIPO SEGNALE: bullish (positivo), bearish (negativo), neutral (neutro), risk_event (evento di rischio), opportunity (opportunita' emergente)
FORZA: 1 (debole) a 5 (molto forte)

NON limitarti ai mercati finanziari. Cerca segnali anche in: immobiliare, energia, consumi, tecnologia, arbitraggio, trend di consumo.
Genera 4-8 segnali DIVERSIFICATI su piu' settori.`;

export async function getMarketRadar(
  _ctx: ServerContext,
  req: GetMarketRadarRequest,
): Promise<GetMarketRadarResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Return demo data for local development
    return getDemoRadar();
  }

  const headlinesText = (req.headlines || []).slice(0, 30).join('\n');
  const inputHash = hashString(`${headlinesText}|${req.priceChanges}`.slice(0, 1500));
  const cacheKey = `ai-invest:radar:v1:${inputHash}`;

  try {
    const result = await cachedFetchJson<GetMarketRadarResponse>(
      cacheKey,
      RADAR_CACHE_TTL,
      async () => {
        const userMessage = `LINGUA: ${req.lang || 'it'}

=== TITOLI NOTIZIE ===
${headlinesText || 'Nessun titolo disponibile'}

=== VARIAZIONI PREZZO ===
${req.priceChanges || 'Nessuna variazione disponibile'}

Analizza il sentiment di mercato.`;

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
              { role: 'system', content: RADAR_SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.2,
            max_tokens: 1000,
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
          signals?: Array<{ type?: string; sector?: string; description?: string; strength?: number }>;
          overall_sentiment?: string;
          summary?: string;
        };

        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return null;
        }

        const signals: MarketSignal[] = (parsed.signals || []).map((s) => ({
          type: s.type || 'neutral',
          sector: s.sector || '',
          description: s.description || '',
          strength: Math.min(5, Math.max(1, s.strength || 3)),
        }));

        return {
          signals,
          overallSentiment: parsed.overall_sentiment || 'mixed',
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
        signals: [],
        overallSentiment: 'mixed',
        summary: '',
        model: GROQ_MODEL,
        generatedAt: Date.now(),
        cached: false,
        error: 'Radar non disponibile al momento.',
      };
    }

    return result;
  } catch {
    return {
      signals: [],
      overallSentiment: 'mixed',
      summary: '',
      model: GROQ_MODEL,
      generatedAt: Date.now(),
      cached: false,
      error: 'Errore durante lo scan radar.',
    };
  }
}

// ============================================================
// Demo data for local development (no GROQ_API_KEY required)
// ============================================================

function getDemoRadar(): GetMarketRadarResponse {
  const signals: MarketSignal[] = [
    {
      type: 'bullish',
      sector: 'Bancario Italia',
      description: 'Settore bancario in forte rally: Unicredit e Intesa ai massimi da 15 anni, buyback record e dividendi elevati.',
      strength: 4,
    },
    {
      type: 'opportunity',
      sector: 'Immobiliare Citta\' Medie',
      description: 'Prezzi in crescita a Bergamo (+7.2%), Brescia (+5.8%). Bonus Casa 50% spinge la domanda di ristrutturazioni.',
      strength: 4,
    },
    {
      type: 'bullish',
      sector: 'Oro e Metalli Preziosi',
      description: 'Oro a nuovi massimi storici ($2,850/oz). Risk-off globale e attesa tagli tassi BCE supportano il trend.',
      strength: 3,
    },
    {
      type: 'bearish',
      sector: 'Auto Europa',
      description: 'Vendite auto in calo del -8% in EU. Transizione elettrica costosa, margini compressi per i produttori tradizionali.',
      strength: 3,
    },
    {
      type: 'opportunity',
      sector: 'Energia Solare Residenziale',
      description: 'Costo pannelli -40% in 2 anni, incentivi confermati. Margini installazione al 25-35%. Domanda +22% YoY.',
      strength: 4,
    },
    {
      type: 'risk_event',
      sector: 'Geopolitica',
      description: 'Tensioni commerciali USA-Cina e conflitti in corso aumentano l\'incertezza. Impatto potenziale su supply chain.',
      strength: 3,
    },
    {
      type: 'bullish',
      sector: 'Crypto',
      description: 'Bitcoin sopra $95K, ETF con afflussi netti record. Post-halving storicamente positivo nei 6-12 mesi successivi.',
      strength: 3,
    },
  ];

  return {
    signals,
    overallSentiment: 'cautious',
    summary: 'Sentiment misto con segnali positivi su bancario italiano, immobiliare citta\' medie e energia solare, ma cautela per rischi geopolitici e rallentamento auto. Diversificazione consigliata.',
    model: 'demo-mode',
    generatedAt: Date.now(),
    cached: false,
    error: '',
  };
}
