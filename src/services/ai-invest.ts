/**
 * AI Investment Analysis service module.
 * Calls the AiInvestService RPCs for investment analysis and market radar.
 */

import {
  AiInvestServiceClient,
  type GetInvestmentAnalysisResponse,
  type GetMarketRadarResponse,
  type GetMarketplaceListingsResponse,
  type GetAiDashboardResponse,
  type GetProductTrendsResponse,
} from '@/generated/client/worldmonitor/ai_invest/v1/service_client';
import { createCircuitBreaker } from '@/utils';

const client = new AiInvestServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

const analysisBreaker = createCircuitBreaker<GetInvestmentAnalysisResponse>({
  name: 'AI Investment Analysis',
  cacheTtlMs: 0,
});

const radarBreaker = createCircuitBreaker<GetMarketRadarResponse>({
  name: 'AI Market Radar',
  cacheTtlMs: 0,
});

const marketplaceBreaker = createCircuitBreaker<GetMarketplaceListingsResponse>({
  name: 'AI Marketplace',
  cacheTtlMs: 0,
});

const dashboardBreaker = createCircuitBreaker<GetAiDashboardResponse>({
  name: 'AI Dashboard',
  cacheTtlMs: 0,
});

const trendsBreaker = createCircuitBreaker<GetProductTrendsResponse>({
  name: 'AI Product Trends',
  cacheTtlMs: 0,
});

const emptyAnalysis: GetInvestmentAnalysisResponse = {
  reasoning: [],
  opportunities: [],
  marketOutlook: '',
  model: '',
  generatedAt: 0,
  cached: false,
  disclaimer: '',
  error: '',
};

const emptyMarketplace: GetMarketplaceListingsResponse = {
  sellListings: [],
  buyRequests: [],
  arbitrageMatches: [],
  summary: '',
  model: '',
  generatedAt: 0,
  cached: false,
  error: '',
};

const emptyRadar: GetMarketRadarResponse = {
  signals: [],
  overallSentiment: '',
  summary: '',
  model: '',
  generatedAt: 0,
  cached: false,
  error: '',
};

const emptyTrends: GetProductTrendsResponse = {
  trends: [],
  suppliers: [],
  categories: [],
  summary: '',
  model: '',
  generatedAt: 0,
  cached: false,
  error: '',
};

const emptyDashboard: GetAiDashboardResponse = {
  fearGreed: { value: 0, classification: 'N/A', history: [] },
  topMovers: [],
  btcCandles: [],
  forexRates: [],
  sectors: [],
  marketStatus: [],
  economicIndicators: [],
  technicalIndicators: [],
  generatedAt: 0,
  cached: false,
  error: '',
};

export async function fetchInvestmentAnalysis(
  marketSummary: string,
  newsSummary: string,
  economicSummary: string,
  focus = 'italia',
  lang = 'it',
): Promise<GetInvestmentAnalysisResponse> {
  return analysisBreaker.execute(async () => {
    return client.getInvestmentAnalysis({
      marketSummary,
      newsSummary,
      economicSummary,
      focus,
      lang,
    });
  }, emptyAnalysis);
}

export async function fetchMarketRadar(
  headlines: string[],
  priceChanges: string,
  lang = 'it',
): Promise<GetMarketRadarResponse> {
  return radarBreaker.execute(async () => {
    return client.getMarketRadar({
      headlines,
      priceChanges,
      lang,
    });
  }, emptyRadar);
}

export async function fetchMarketplaceListings(
  query: string,
  country = 'italia',
  lang = 'it',
): Promise<GetMarketplaceListingsResponse> {
  return marketplaceBreaker.execute(async () => {
    return client.getMarketplaceListings({ query, country, lang });
  }, emptyMarketplace);
}

export async function fetchAiDashboard(
  lang = 'it',
): Promise<GetAiDashboardResponse> {
  return dashboardBreaker.execute(async () => {
    return client.getAiDashboard({ lang });
  }, emptyDashboard);
}

export async function fetchProductTrends(
  country = 'italia',
  lang = 'it',
): Promise<GetProductTrendsResponse> {
  return trendsBreaker.execute(async () => {
    return client.getProductTrends({ country, lang });
  }, emptyTrends);
}

export type { GetInvestmentAnalysisResponse, GetMarketRadarResponse, GetMarketplaceListingsResponse, GetAiDashboardResponse, GetProductTrendsResponse };
export type {
  ReasoningStep,
  InvestmentOpportunity,
  MarketSignal,
  MarketplaceListing,
  ArbitrageMatch,
  FearGreedData,
  TopMover,
  CandleData,
  ForexRate,
  SectorPerformance,
  MarketStatusInfo,
  EconomicIndicator,
  TechnicalIndicator,
  ProductTrend,
  ProductSupplier,
  TrendCategory,
} from '@/generated/client/worldmonitor/ai_invest/v1/service_client';
