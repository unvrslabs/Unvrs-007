/**
 * RPC: GetAiDashboard
 * Aggregates data from multiple financial APIs into a unified dashboard response.
 * Sources: Fear & Greed, CoinGecko, Alpha Vantage, Finnhub, FRED, Twelve Data, WTO
 */

declare const process: { env: Record<string, string | undefined> };

import type {
  ServerContext,
  GetAiDashboardRequest,
  GetAiDashboardResponse,
  FearGreedData,
  TopMover,
  CandleData,
  ForexRate,
  SectorPerformance,
  MarketStatusInfo,
  EconomicIndicator,
  TechnicalIndicator,
} from '../../../../src/generated/server/worldmonitor/ai_invest/v1/service_server';

import { cachedFetchJson } from '../../../_shared/redis';
import { CHROME_UA } from '../../../_shared/constants';

// ========================================================================
// Cache TTLs (seconds)
// ========================================================================

const FEAR_GREED_TTL = 1800;      // 30 min
const CRYPTO_TTL = 600;           // 10 min
const BTC_CANDLES_TTL = 900;      // 15 min
const FOREX_TTL = 900;            // 15 min
const SECTOR_TTL = 900;           // 15 min
const MARKET_STATUS_TTL = 300;    // 5 min
const FRED_TTL = 3600;            // 1 hour
const TECHNICAL_TTL = 900;        // 15 min

// ========================================================================
// Fetch helpers
// ========================================================================

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// ── Fear & Greed Index (no key required) ──

async function fetchFearGreed(): Promise<FearGreedData> {
  const data = await cachedFetchJson<FearGreedData>(
    'ai-dash:fear-greed:v1',
    FEAR_GREED_TTL,
    async () => {
      const resp = await fetchWithTimeout('https://api.alternative.me/fng/?limit=30');
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        data?: Array<{ value: string; value_classification: string; timestamp: string }>;
      };
      if (!json.data || json.data.length === 0) return null;

      const current = json.data[0]!;
      const history = json.data.map((d) => ({
        value: parseInt(d.value, 10),
        classification: d.value_classification,
        timestamp: parseInt(d.timestamp, 10) * 1000,
      }));

      return {
        value: parseInt(current.value, 10),
        classification: current.value_classification,
        history,
      };
    },
  );
  return data || { value: 0, classification: 'N/A', history: [] };
}

// ── Top Crypto Movers (CoinGecko, no key required) ──

async function fetchTopCryptoMovers(): Promise<TopMover[]> {
  const data = await cachedFetchJson<TopMover[]>(
    'ai-dash:crypto-movers:v1',
    CRYPTO_TTL,
    async () => {
      const resp = await fetchWithTimeout(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=10&sparkline=true&price_change_percentage=24h',
      );
      if (!resp.ok) return null;
      const coins = (await resp.json()) as Array<{
        symbol: string;
        name: string;
        current_price: number;
        price_change_percentage_24h: number;
        total_volume: number;
        market_cap: number;
        sparkline_in_7d?: { price: number[] };
        image: string;
      }>;

      return coins.map((c) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price || 0,
        change24h: c.price_change_percentage_24h || 0,
        volume24h: c.total_volume || 0,
        marketCap: c.market_cap || 0,
        sparkline: (c.sparkline_in_7d?.price || []).filter((_, i) => i % 4 === 0), // downsample
        image: c.image || '',
      }));
    },
  );
  return data || [];
}

// ── BTC Candles (Alpha Vantage) ──

async function fetchBtcCandles(): Promise<CandleData[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const data = await cachedFetchJson<CandleData[]>(
    'ai-dash:btc-candles:v1',
    BTC_CANDLES_TTL,
    async () => {
      const resp = await fetchWithTimeout(
        `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=EUR&apikey=${apiKey}`,
        20_000,
      );
      if (!resp.ok) return null;
      const json = (await resp.json()) as Record<string, unknown>;
      const series = json['Time Series (Digital Currency Daily)'] as Record<string, Record<string, string>> | undefined;
      if (!series) return null;

      const entries = Object.entries(series).slice(0, 30).reverse();
      return entries.map(([date, vals]) => ({
        timestamp: new Date(date).getTime(),
        open: parseFloat(vals['1a. open (EUR)'] || vals['1. open'] || '0'),
        high: parseFloat(vals['2a. high (EUR)'] || vals['2. high'] || '0'),
        low: parseFloat(vals['3a. low (EUR)'] || vals['3. low'] || '0'),
        close: parseFloat(vals['4a. close (EUR)'] || vals['4. close'] || '0'),
        volume: parseFloat(vals['5. volume'] || '0'),
      }));
    },
  );
  return data || [];
}

// ── Forex Rates (Alpha Vantage) ──

async function fetchForexRates(): Promise<ForexRate[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const pairs = [
    { from: 'EUR', to: 'USD' },
    { from: 'EUR', to: 'GBP' },
    { from: 'EUR', to: 'JPY' },
    { from: 'EUR', to: 'CHF' },
  ];

  const data = await cachedFetchJson<ForexRate[]>(
    'ai-dash:forex:v1',
    FOREX_TTL,
    async () => {
      const results: ForexRate[] = [];
      // Alpha Vantage rate limit: fetch sequentially with small delay
      for (const p of pairs) {
        try {
          const resp = await fetchWithTimeout(
            `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${p.from}&to_currency=${p.to}&apikey=${apiKey}`,
          );
          if (!resp.ok) continue;
          const json = (await resp.json()) as Record<string, unknown>;
          const rateData = json['Realtime Currency Exchange Rate'] as Record<string, string> | undefined;
          if (!rateData) continue;

          results.push({
            pair: `${p.from}/${p.to}`,
            rate: parseFloat(rateData['5. Exchange Rate'] || '0'),
            change: rateData['9. Change'] || '0',
            bid: parseFloat(rateData['8. Bid Price'] || '0'),
            ask: parseFloat(rateData['9. Ask Price'] || '0'),
          });
          // Small delay to avoid rate limiting
          await new Promise((r) => setTimeout(r, 300));
        } catch {
          // skip failed pairs
        }
      }
      return results.length > 0 ? results : null;
    },
  );
  return data || [];
}

// ── Sector Performance (Alpha Vantage) ──

async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const data = await cachedFetchJson<SectorPerformance[]>(
    'ai-dash:sectors:v1',
    SECTOR_TTL,
    async () => {
      const resp = await fetchWithTimeout(
        `https://www.alphavantage.co/query?function=SECTOR&apikey=${apiKey}`,
      );
      if (!resp.ok) return null;
      const json = (await resp.json()) as Record<string, Record<string, string>>;

      const day = json['Rank B: 1 Day Performance'] || {};
      const week = json['Rank C: 5 Day Performance'] || {};
      const month = json['Rank D: 1 Month Performance'] || {};
      const threeMonth = json['Rank E: 3 Month Performance'] || {};
      const ytd = json['Rank F: Year-to-Date (YTD) Performance'] || {};
      const year = json['Rank G: 1 Year Performance'] || {};

      const sectors = Object.keys(day);
      if (sectors.length === 0) return null;

      return sectors.map((s) => ({
        sector: s,
        change1d: day[s] || '0%',
        change1w: week[s] || '0%',
        change1m: month[s] || '0%',
        change3m: threeMonth[s] || '0%',
        changeYtd: ytd[s] || '0%',
        change1y: year[s] || '0%',
      }));
    },
  );
  return data || [];
}

// ── Market Status (Finnhub) ──

async function fetchMarketStatus(): Promise<MarketStatusInfo[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  const exchanges = ['US', 'L', 'T', 'MI']; // NYSE/NASDAQ, London, Tokyo, Milan
  const data = await cachedFetchJson<MarketStatusInfo[]>(
    'ai-dash:market-status:v1',
    MARKET_STATUS_TTL,
    async () => {
      const results: MarketStatusInfo[] = [];
      for (const ex of exchanges) {
        try {
          const resp = await fetchWithTimeout(
            `https://finnhub.io/api/v1/stock/market-status?exchange=${ex}&token=${apiKey}`,
          );
          if (!resp.ok) continue;
          const json = (await resp.json()) as { exchange?: string; isOpen?: boolean; holiday?: string };
          results.push({
            exchange: json.exchange || ex,
            isOpen: json.isOpen || false,
            holiday: json.holiday || '',
          });
        } catch {
          // skip failed
        }
      }
      return results.length > 0 ? results : null;
    },
  );
  return data || [];
}

// ── Economic Indicators (FRED) ──

async function fetchEconomicIndicators(): Promise<EconomicIndicator[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return [];

  const series = [
    { id: 'CPIAUCSL', name: 'Inflazione USA (CPI)', unit: '%' },
    { id: 'GDP', name: 'PIL USA', unit: 'Mld $' },
    { id: 'UNRATE', name: 'Disoccupazione USA', unit: '%' },
    { id: 'FEDFUNDS', name: 'Tasso Fed', unit: '%' },
    { id: 'T10Y2Y', name: 'Spread 10Y-2Y', unit: '%' },
    { id: 'DCOILWTICO', name: 'Petrolio WTI', unit: '$' },
    { id: 'GOLDAMGBD228NLBM', name: 'Oro', unit: '$' },
    { id: 'VIXCLS', name: 'VIX', unit: '' },
  ];

  const data = await cachedFetchJson<EconomicIndicator[]>(
    'ai-dash:fred:v1',
    FRED_TTL,
    async () => {
      const results: EconomicIndicator[] = [];
      for (const s of series) {
        try {
          const resp = await fetchWithTimeout(
            `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`,
          );
          if (!resp.ok) continue;
          const json = (await resp.json()) as {
            observations?: Array<{ date: string; value: string }>;
          };
          const obs = json.observations?.filter((o) => o.value !== '.');
          if (!obs || obs.length === 0) continue;

          const latest = obs[0]!;
          const prev = obs[1];
          const val = parseFloat(latest.value);
          const prevVal = prev ? parseFloat(prev.value) : val;
          const change = prevVal !== 0 ? ((val - prevVal) / Math.abs(prevVal)) * 100 : 0;
          const trend = change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'stable';

          results.push({
            id: s.id,
            name: s.name,
            value: val,
            unit: s.unit,
            change: Math.round(change * 100) / 100,
            trend,
            date: latest.date,
          });
          await new Promise((r) => setTimeout(r, 200));
        } catch {
          // skip
        }
      }
      return results.length > 0 ? results : null;
    },
  );
  return data || [];
}

// ── Technical Indicators (Twelve Data) ──

async function fetchTechnicalIndicators(): Promise<TechnicalIndicator[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return [];

  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'BTC/USD', 'EUR/USD'];

  const data = await cachedFetchJson<TechnicalIndicator[]>(
    'ai-dash:technical:v1',
    TECHNICAL_TTL,
    async () => {
      const results: TechnicalIndicator[] = [];
      for (const sym of symbols) {
        try {
          // Fetch RSI
          const rsiResp = await fetchWithTimeout(
            `https://api.twelvedata.com/rsi?symbol=${encodeURIComponent(sym)}&interval=1day&apikey=${apiKey}`,
          );
          let rsi = 50;
          if (rsiResp.ok) {
            const rsiJson = (await rsiResp.json()) as { values?: Array<{ rsi: string }> };
            if (rsiJson.values?.[0]) rsi = parseFloat(rsiJson.values[0].rsi);
          }

          // Fetch MACD
          const macdResp = await fetchWithTimeout(
            `https://api.twelvedata.com/macd?symbol=${encodeURIComponent(sym)}&interval=1day&apikey=${apiKey}`,
          );
          let macdLine = 0, macdSignal = 0, macdHist = 0;
          if (macdResp.ok) {
            const macdJson = (await macdResp.json()) as { values?: Array<{ macd: string; macd_signal: string; macd_hist: string }> };
            if (macdJson.values?.[0]) {
              macdLine = parseFloat(macdJson.values[0].macd);
              macdSignal = parseFloat(macdJson.values[0].macd_signal);
              macdHist = parseFloat(macdJson.values[0].macd_hist);
            }
          }

          // Fetch price + SMAs
          const priceResp = await fetchWithTimeout(
            `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${apiKey}`,
          );
          let price = 0, sma50 = 0, sma200 = 0;
          if (priceResp.ok) {
            const priceJson = (await priceResp.json()) as { close?: string; fifty_day_average?: string; two_hundred_day_average?: string };
            price = parseFloat(priceJson.close || '0');
            sma50 = parseFloat(priceJson.fifty_day_average || '0');
            sma200 = parseFloat(priceJson.two_hundred_day_average || '0');
          }

          results.push({
            symbol: sym,
            rsi,
            macdLine,
            macdSignal,
            macdHist,
            sma50,
            sma200,
            price,
          });
          await new Promise((r) => setTimeout(r, 500)); // Twelve Data rate limit
        } catch {
          // skip
        }
      }
      return results.length > 0 ? results : null;
    },
  );
  return data || [];
}

// ========================================================================
// Main handler
// ========================================================================

export async function getAiDashboard(
  _ctx: ServerContext,
  _req: GetAiDashboardRequest,
): Promise<GetAiDashboardResponse> {
  // Check if we have at least one API key configured
  const hasAnyKey = !!(
    process.env.ALPHA_VANTAGE_API_KEY ||
    process.env.FINNHUB_API_KEY ||
    process.env.FRED_API_KEY ||
    process.env.TWELVE_DATA_API_KEY
  );

  if (!hasAnyKey) {
    return getDemoDashboard();
  }

  try {
    const [
      fearGreedResult,
      topMoversResult,
      btcCandlesResult,
      forexRatesResult,
      sectorsResult,
      marketStatusResult,
      econResult,
      technicalResult,
    ] = await Promise.allSettled([
      fetchFearGreed(),
      fetchTopCryptoMovers(),
      fetchBtcCandles(),
      fetchForexRates(),
      fetchSectorPerformance(),
      fetchMarketStatus(),
      fetchEconomicIndicators(),
      fetchTechnicalIndicators(),
    ]);

    return {
      fearGreed: fearGreedResult.status === 'fulfilled' ? fearGreedResult.value : { value: 0, classification: 'N/A', history: [] },
      topMovers: topMoversResult.status === 'fulfilled' ? topMoversResult.value : [],
      btcCandles: btcCandlesResult.status === 'fulfilled' ? btcCandlesResult.value : [],
      forexRates: forexRatesResult.status === 'fulfilled' ? forexRatesResult.value : [],
      sectors: sectorsResult.status === 'fulfilled' ? sectorsResult.value : [],
      marketStatus: marketStatusResult.status === 'fulfilled' ? marketStatusResult.value : [],
      economicIndicators: econResult.status === 'fulfilled' ? econResult.value : [],
      technicalIndicators: technicalResult.status === 'fulfilled' ? technicalResult.value : [],
      generatedAt: Date.now(),
      cached: false,
      error: '',
    };
  } catch {
    return {
      fearGreed: { value: 0, classification: 'N/A', history: [] },
      topMovers: [],
      btcCandles: [],
      forexRates: [],
      sectors: [],
      marketStatus: [],
      economicIndicators: [],
      technicalIndicators: [],
      generatedAt: Date.now(),
      cached: false,
      error: 'Errore nel caricamento dei dati dashboard. Riprova tra qualche minuto.',
    };
  }
}

// ========================================================================
// Demo data (for local development without API keys)
// ========================================================================

function getDemoDashboard(): GetAiDashboardResponse {
  const now = Date.now();

  // Generate realistic BTC candle data (30 days)
  const btcCandles: CandleData[] = [];
  let btcBase = 58000;
  for (let i = 29; i >= 0; i--) {
    const day = now - i * 86_400_000;
    const open = btcBase + (Math.random() - 0.48) * 2000;
    const close = open + (Math.random() - 0.45) * 1500;
    const high = Math.max(open, close) + Math.random() * 800;
    const low = Math.min(open, close) - Math.random() * 800;
    btcCandles.push({
      timestamp: day,
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
      volume: Math.round(15_000_000_000 + Math.random() * 10_000_000_000),
    });
    btcBase = close;
  }

  // Generate sparkline data
  const makeSparkline = (base: number, volatility: number): number[] => {
    const pts: number[] = [];
    let v = base;
    for (let i = 0; i < 42; i++) {
      v += (Math.random() - 0.48) * volatility;
      pts.push(Math.round(v * 100) / 100);
    }
    return pts;
  };

  return {
    fearGreed: {
      value: 72,
      classification: 'Greed',
      history: Array.from({ length: 30 }, (_, i) => ({
        value: Math.round(40 + Math.random() * 45),
        classification: ['Fear', 'Neutral', 'Greed', 'Extreme Greed'][Math.floor(Math.random() * 4)]!,
        timestamp: now - (29 - i) * 86_400_000,
      })),
    },
    topMovers: [
      { symbol: 'BTC', name: 'Bitcoin', price: 62500, change24h: 2.34, volume24h: 28_500_000_000, marketCap: 1_230_000_000_000, sparkline: makeSparkline(62500, 500), image: '' },
      { symbol: 'ETH', name: 'Ethereum', price: 2450, change24h: -1.12, volume24h: 12_800_000_000, marketCap: 295_000_000_000, sparkline: makeSparkline(2450, 40), image: '' },
      { symbol: 'SOL', name: 'Solana', price: 148, change24h: 5.67, volume24h: 3_200_000_000, marketCap: 68_000_000_000, sparkline: makeSparkline(148, 5), image: '' },
      { symbol: 'BNB', name: 'BNB', price: 580, change24h: 0.89, volume24h: 1_800_000_000, marketCap: 86_000_000_000, sparkline: makeSparkline(580, 10), image: '' },
      { symbol: 'XRP', name: 'XRP', price: 2.15, change24h: -0.45, volume24h: 2_100_000_000, marketCap: 124_000_000_000, sparkline: makeSparkline(2.15, 0.08), image: '' },
      { symbol: 'ADA', name: 'Cardano', price: 0.72, change24h: 3.21, volume24h: 850_000_000, marketCap: 25_500_000_000, sparkline: makeSparkline(0.72, 0.03), image: '' },
      { symbol: 'DOGE', name: 'Dogecoin', price: 0.185, change24h: -2.15, volume24h: 1_200_000_000, marketCap: 27_000_000_000, sparkline: makeSparkline(0.185, 0.01), image: '' },
      { symbol: 'AVAX', name: 'Avalanche', price: 38.50, change24h: 4.12, volume24h: 620_000_000, marketCap: 15_200_000_000, sparkline: makeSparkline(38.5, 2), image: '' },
    ],
    btcCandles,
    forexRates: [
      { pair: 'EUR/USD', rate: 1.0852, change: '+0.0012', bid: 1.0850, ask: 1.0854 },
      { pair: 'EUR/GBP', rate: 0.8534, change: '-0.0008', bid: 0.8532, ask: 0.8536 },
      { pair: 'EUR/JPY', rate: 162.45, change: '+0.35', bid: 162.40, ask: 162.50 },
      { pair: 'EUR/CHF', rate: 0.9412, change: '+0.0005', bid: 0.9410, ask: 0.9414 },
    ],
    sectors: [
      { sector: 'Information Technology', change1d: '+1.45%', change1w: '+3.12%', change1m: '+5.67%', change3m: '+12.3%', changeYtd: '+18.5%', change1y: '+32.1%' },
      { sector: 'Health Care', change1d: '-0.32%', change1w: '+0.89%', change1m: '+2.15%', change3m: '+4.8%', changeYtd: '+7.2%', change1y: '+15.3%' },
      { sector: 'Financials', change1d: '+0.78%', change1w: '+1.56%', change1m: '+3.45%', change3m: '+8.9%', changeYtd: '+14.1%', change1y: '+22.4%' },
      { sector: 'Consumer Discretionary', change1d: '+0.92%', change1w: '+2.34%', change1m: '+4.12%', change3m: '+7.6%', changeYtd: '+11.8%', change1y: '+19.7%' },
      { sector: 'Energy', change1d: '-1.23%', change1w: '-2.45%', change1m: '-1.89%', change3m: '+2.1%', changeYtd: '-3.4%', change1y: '+5.6%' },
      { sector: 'Communication Services', change1d: '+0.56%', change1w: '+1.78%', change1m: '+3.90%', change3m: '+9.2%', changeYtd: '+16.7%', change1y: '+28.9%' },
      { sector: 'Industrials', change1d: '+0.34%', change1w: '+0.67%', change1m: '+1.23%', change3m: '+5.4%', changeYtd: '+8.9%', change1y: '+16.2%' },
      { sector: 'Real Estate', change1d: '-0.56%', change1w: '-1.12%', change1m: '+0.45%', change3m: '-1.2%', changeYtd: '+2.3%', change1y: '+8.1%' },
      { sector: 'Materials', change1d: '+0.23%', change1w: '+0.45%', change1m: '+1.67%', change3m: '+3.8%', changeYtd: '+6.5%', change1y: '+11.4%' },
      { sector: 'Utilities', change1d: '+0.12%', change1w: '+0.34%', change1m: '+0.89%', change3m: '+2.3%', changeYtd: '+5.1%', change1y: '+12.8%' },
      { sector: 'Consumer Staples', change1d: '-0.15%', change1w: '+0.23%', change1m: '+0.67%', change3m: '+1.9%', changeYtd: '+4.5%', change1y: '+9.3%' },
    ],
    marketStatus: [
      { exchange: 'US', isOpen: true, holiday: '' },
      { exchange: 'London', isOpen: true, holiday: '' },
      { exchange: 'Tokyo', isOpen: false, holiday: '' },
      { exchange: 'Milan', isOpen: true, holiday: '' },
    ],
    economicIndicators: [
      { id: 'CPIAUCSL', name: 'Inflazione USA (CPI)', value: 3.1, unit: '%', change: -0.2, trend: 'down', date: '2025-12-01' },
      { id: 'GDP', name: 'PIL USA', value: 28544.3, unit: 'Mld $', change: 2.8, trend: 'up', date: '2025-09-01' },
      { id: 'UNRATE', name: 'Disoccupazione USA', value: 3.7, unit: '%', change: 0.1, trend: 'stable', date: '2025-12-01' },
      { id: 'FEDFUNDS', name: 'Tasso Fed', value: 4.50, unit: '%', change: -0.25, trend: 'down', date: '2025-12-01' },
      { id: 'T10Y2Y', name: 'Spread 10Y-2Y', value: 0.15, unit: '%', change: 0.08, trend: 'up', date: '2025-12-01' },
      { id: 'DCOILWTICO', name: 'Petrolio WTI', value: 72.50, unit: '$', change: -1.3, trend: 'down', date: '2025-12-01' },
      { id: 'GOLDAMGBD228NLBM', name: 'Oro', value: 2850, unit: '$', change: 3.5, trend: 'up', date: '2025-12-01' },
      { id: 'VIXCLS', name: 'VIX', value: 14.2, unit: '', change: -5.2, trend: 'down', date: '2025-12-01' },
    ],
    technicalIndicators: [
      { symbol: 'AAPL', rsi: 58.3, macdLine: 2.15, macdSignal: 1.89, macdHist: 0.26, sma50: 228.5, sma200: 215.3, price: 235.8 },
      { symbol: 'MSFT', rsi: 62.1, macdLine: 3.45, macdSignal: 2.78, macdHist: 0.67, sma50: 415.2, sma200: 398.7, price: 428.5 },
      { symbol: 'GOOGL', rsi: 45.7, macdLine: -1.23, macdSignal: -0.56, macdHist: -0.67, sma50: 175.8, sma200: 168.4, price: 172.3 },
      { symbol: 'AMZN', rsi: 55.8, macdLine: 1.87, macdSignal: 1.45, macdHist: 0.42, sma50: 198.3, sma200: 185.6, price: 205.1 },
      { symbol: 'BTC/USD', rsi: 68.5, macdLine: 1250, macdSignal: 980, macdHist: 270, sma50: 58500, sma200: 52000, price: 62500 },
      { symbol: 'EUR/USD', rsi: 52.1, macdLine: 0.0012, macdSignal: 0.0008, macdHist: 0.0004, sma50: 1.078, sma200: 1.082, price: 1.085 },
    ],
    generatedAt: now,
    cached: false,
    error: '',
  };
}
