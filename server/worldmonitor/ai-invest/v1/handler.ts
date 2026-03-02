import type { AiInvestServiceHandler } from '../../../../src/generated/server/worldmonitor/ai_invest/v1/service_server';

import { getInvestmentAnalysis } from './get-investment-analysis';
import { getMarketRadar } from './get-market-radar';
import { getMarketplaceListings } from './get-marketplace-listings';
import { getAiDashboard } from './get-ai-dashboard';
import { getProductTrends } from './get-product-trends';

export const aiInvestHandler: AiInvestServiceHandler = {
  getInvestmentAnalysis,
  getMarketRadar,
  getMarketplaceListings,
  getAiDashboard,
  getProductTrends,
};
