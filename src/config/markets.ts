import type { Sector, Commodity, MarketSymbol } from '@/types';
import { SITE_VARIANT } from '@/config/variant';

export const SECTORS: Sector[] = [
  { symbol: 'XLK', name: 'Tech' },
  { symbol: 'XLF', name: 'Finance' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Health' },
  { symbol: 'XLY', name: 'Consumer' },
  { symbol: 'XLI', name: 'Industrial' },
  { symbol: 'XLP', name: 'Staples' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Est' },
  { symbol: 'XLC', name: 'Comms' },
  { symbol: 'SMH', name: 'Semis' },
];

const GLOBAL_COMMODITIES: Commodity[] = [
  { symbol: '^VIX', name: 'VIX', display: 'VIX' },
  { symbol: 'GC=F', name: 'Gold', display: 'GOLD' },
  { symbol: 'CL=F', name: 'Crude Oil', display: 'OIL' },
  { symbol: 'NG=F', name: 'Natural Gas', display: 'NATGAS' },
  { symbol: 'SI=F', name: 'Silver', display: 'SILVER' },
  { symbol: 'HG=F', name: 'Copper', display: 'COPPER' },
];

const ITALIA_COMMODITIES: Commodity[] = [
  { symbol: 'GC=F', name: 'Oro', display: 'ORO' },
  { symbol: 'BZ=F', name: 'Brent', display: 'BRENT' },
  { symbol: 'NG=F', name: 'Gas Naturale', display: 'GAS' },
  { symbol: 'EURUSD=X', name: 'Euro/Dollaro', display: 'EUR/USD' },
  { symbol: 'EURGBP=X', name: 'Euro/Sterlina', display: 'EUR/GBP' },
  { symbol: 'SI=F', name: 'Argento', display: 'ARGENTO' },
  { symbol: 'HG=F', name: 'Rame', display: 'RAME' },
  { symbol: 'ZW=F', name: 'Grano', display: 'GRANO' },
];

export const COMMODITIES: Commodity[] = SITE_VARIANT === 'italia' ? ITALIA_COMMODITIES : GLOBAL_COMMODITIES;

const GLOBAL_MARKET_SYMBOLS: MarketSymbol[] = [
  { symbol: '^GSPC', name: 'S&P 500', display: 'SPX' },
  { symbol: '^DJI', name: 'Dow Jones', display: 'DOW' },
  { symbol: '^IXIC', name: 'NASDAQ', display: 'NDX' },
  { symbol: 'AAPL', name: 'Apple', display: 'AAPL' },
  { symbol: 'MSFT', name: 'Microsoft', display: 'MSFT' },
  { symbol: 'NVDA', name: 'NVIDIA', display: 'NVDA' },
  { symbol: 'GOOGL', name: 'Alphabet', display: 'GOOGL' },
  { symbol: 'AMZN', name: 'Amazon', display: 'AMZN' },
  { symbol: 'META', name: 'Meta', display: 'META' },
  { symbol: 'BRK-B', name: 'Berkshire', display: 'BRK.B' },
  { symbol: 'TSM', name: 'TSMC', display: 'TSM' },
  { symbol: 'LLY', name: 'Eli Lilly', display: 'LLY' },
  { symbol: 'TSLA', name: 'Tesla', display: 'TSLA' },
  { symbol: 'AVGO', name: 'Broadcom', display: 'AVGO' },
  { symbol: 'WMT', name: 'Walmart', display: 'WMT' },
  { symbol: 'JPM', name: 'JPMorgan', display: 'JPM' },
  { symbol: 'V', name: 'Visa', display: 'V' },
  { symbol: 'UNH', name: 'UnitedHealth', display: 'UNH' },
  { symbol: 'NVO', name: 'Novo Nordisk', display: 'NVO' },
  { symbol: 'XOM', name: 'Exxon', display: 'XOM' },
  { symbol: 'MA', name: 'Mastercard', display: 'MA' },
  { symbol: 'ORCL', name: 'Oracle', display: 'ORCL' },
  { symbol: 'PG', name: 'P&G', display: 'PG' },
  { symbol: 'COST', name: 'Costco', display: 'COST' },
  { symbol: 'JNJ', name: 'J&J', display: 'JNJ' },
  { symbol: 'HD', name: 'Home Depot', display: 'HD' },
  { symbol: 'NFLX', name: 'Netflix', display: 'NFLX' },
  { symbol: 'BAC', name: 'BofA', display: 'BAC' },
];

const ITALIA_MARKET_SYMBOLS: MarketSymbol[] = [
  // Indici
  { symbol: 'FTSEMIB.MI', name: 'FTSE MIB', display: 'FTSE MIB' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', display: 'STOXX50' },
  { symbol: '^GDAXI', name: 'DAX', display: 'DAX' },
  // Banche & Assicurazioni
  { symbol: 'ISP.MI', name: 'Intesa Sanpaolo', display: 'ISP' },
  { symbol: 'UCG.MI', name: 'UniCredit', display: 'UCG' },
  { symbol: 'G.MI', name: 'Generali', display: 'G' },
  { symbol: 'MB.MI', name: 'Mediobanca', display: 'MB' },
  { symbol: 'BMPS.MI', name: 'Banca MPS', display: 'MPS' },
  // Energia
  { symbol: 'ENEL.MI', name: 'Enel', display: 'ENEL' },
  { symbol: 'ENI.MI', name: 'Eni', display: 'ENI' },
  { symbol: 'SRG.MI', name: 'Snam', display: 'SNAM' },
  { symbol: 'TRN.MI', name: 'Terna', display: 'TERNA' },
  // Industria & Difesa
  { symbol: 'LDO.MI', name: 'Leonardo', display: 'LDO' },
  { symbol: 'STLAM.MI', name: 'Stellantis', display: 'STLA' },
  { symbol: 'PRY.MI', name: 'Prysmian', display: 'PRY' },
  // Lusso & Consumo
  { symbol: 'RACE.MI', name: 'Ferrari', display: 'FERRARI' },
  { symbol: 'MONC.MI', name: 'Moncler', display: 'MONC' },
  { symbol: 'CPR.MI', name: 'Campari', display: 'CPR' },
  // Telecom & Infrastrutture
  { symbol: 'TIT.MI', name: 'Telecom Italia', display: 'TIT' },
  { symbol: 'PST.MI', name: 'Poste Italiane', display: 'POSTE' },
  { symbol: 'AMP.MI', name: 'Amplifon', display: 'AMP' },
  { symbol: 'PIRC.MI', name: 'Pirelli', display: 'PIRC' },
];

export const MARKET_SYMBOLS: MarketSymbol[] = SITE_VARIANT === 'italia' ? ITALIA_MARKET_SYMBOLS : GLOBAL_MARKET_SYMBOLS;

export const CRYPTO_IDS = ['bitcoin', 'ethereum', 'solana', 'ripple', 'binancecoin', 'cardano', 'dogecoin', 'tron', 'avalanche-2', 'chainlink', 'polkadot', 'sui'] as const;

export const CRYPTO_MAP: Record<string, { name: string; symbol: string }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC' },
  ethereum: { name: 'Ethereum', symbol: 'ETH' },
  solana: { name: 'Solana', symbol: 'SOL' },
  ripple: { name: 'XRP', symbol: 'XRP' },
  binancecoin: { name: 'BNB', symbol: 'BNB' },
  cardano: { name: 'Cardano', symbol: 'ADA' },
  dogecoin: { name: 'Dogecoin', symbol: 'DOGE' },
  tron: { name: 'TRON', symbol: 'TRX' },
  'avalanche-2': { name: 'Avalanche', symbol: 'AVAX' },
  chainlink: { name: 'Chainlink', symbol: 'LINK' },
  polkadot: { name: 'Polkadot', symbol: 'DOT' },
  sui: { name: 'Sui', symbol: 'SUI' },
};
