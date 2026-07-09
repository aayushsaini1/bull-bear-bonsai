export interface AssetMetrics {
  name: string;
  symbol: string;
  currentPrice: number;
  dailyChangePercent: number;
  weeklyChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  rangePositionRatio: number; // (current - low) / (high - low)
  isClosed: boolean;           // Tracks if the asset's primary market is closed
  historicalPrices: number[];  // Last 5 closing prices for weekly charts
}

export interface TreeData {
  dailyChangePercent: number;    // Leaves color: green -> yellow -> red
  weeklyChangePercent: number;   // Weather/Wind: sunny -> cloudy -> rainy -> storm
  leafDensity: number;           // Leaves quantity: 0 (bare) to 1 (full)
  assets: {
    nifty: AssetMetrics;
    nasdaq: AssetMetrics;
    gold: AssetMetrics;
    btc: AssetMetrics;
  };
  isMock: boolean;
}

/**
 * Checks if the primary market is closed for a given asset symbol
 */
export function checkMarketClosed(symbol: string): boolean {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;

  if (symbol === "^NSEI" || symbol === "GOLDBEES.NS") {
    // Nifty 50 & Gold ETF: Monday-Friday, 9:15 AM - 3:30 PM IST (UTC+5:30)
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const day = istTime.getDay();
    if (day === 0 || day === 6) return true; // Weekend
    const mins = istTime.getHours() * 60 + istTime.getMinutes();
    return mins < (9 * 60 + 15) || mins > (15 * 60 + 30);
  }
  
  if (symbol === "NDAQ") {
    // Nasdaq: Monday-Friday, 9:30 AM - 4:00 PM EST/EDT
    // Convert to US East Coast time zone
    try {
      const estTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const estTime = new Date(estTimeStr);
      const day = estTime.getDay();
      if (day === 0 || day === 6) return true; // Weekend
      const mins = estTime.getHours() * 60 + estTime.getMinutes();
      return mins < (9 * 60 + 30) || mins > (16 * 60);
    } catch (e) {
      // Fallback approximation (UTC-5)
      const estTime = new Date(utc - 5 * 60 * 60 * 1000);
      const day = estTime.getDay();
      if (day === 0 || day === 6) return true;
      const mins = estTime.getHours() * 60 + estTime.getMinutes();
      return mins < (9 * 60 + 30) || mins > (16 * 60);
    }
  }
  
  if (symbol === "BTC-USD") {
    // Bitcoin USD is open 24/7
    return false;
  }
  
  return false;
}

// Healthy default mock values in case APIs fail
export const MOCK_DATA: TreeData = {
  dailyChangePercent: 0.35,
  weeklyChangePercent: 1.15,
  leafDensity: 0.85,
  assets: {
    nifty: {
      name: "Nifty 50",
      symbol: "^NSEI",
      currentPrice: 23962.80,
      dailyChangePercent: 0.34,
      weeklyChangePercent: 1.25,
      fiftyTwoWeekHigh: 25078.00,
      fiftyTwoWeekLow: 19300.00,
      rangePositionRatio: 0.82,
      isClosed: checkMarketClosed("^NSEI"),
      historicalPrices: [23810.5, 23902.1, 23785.4, 23912.0, 23962.8],
    },
    nasdaq: {
      name: "Nasdaq, Inc.",
      symbol: "NDAQ",
      currentPrice: 87.43,
      dailyChangePercent: 3.60,
      weeklyChangePercent: 2.10,
      fiftyTwoWeekHigh: 92.00,
      fiftyTwoWeekLow: 58.50,
      rangePositionRatio: 0.88,
      isClosed: checkMarketClosed("NDAQ"),
      historicalPrices: [84.15, 85.32, 84.90, 86.40, 87.43],
    },
    gold: {
      name: "Nippon India ETF Gold BeES",
      symbol: "GOLDBEES.NS",
      currentPrice: 118.42,
      dailyChangePercent: 1.25,
      weeklyChangePercent: 0.85,
      fiftyTwoWeekHigh: 125.00,
      fiftyTwoWeekLow: 95.00,
      rangePositionRatio: 0.78,
      isClosed: checkMarketClosed("GOLDBEES.NS"),
      historicalPrices: [116.85, 117.40, 117.95, 118.10, 118.42],
    },
    btc: {
      name: "Bitcoin USD",
      symbol: "BTC-USD",
      currentPrice: 63226.43,
      dailyChangePercent: 1.60,
      weeklyChangePercent: 0.40,
      fiftyTwoWeekHigh: 73000.00,
      fiftyTwoWeekLow: 38000.00,
      rangePositionRatio: 0.72,
      isClosed: checkMarketClosed("BTC-USD"),
      historicalPrices: [61850.0, 62450.5, 61990.2, 62820.0, 63226.43],
    }
  },
  isMock: true
};

/**
 * Calculates range ratio and clamps to [0, 1]
 */
function calculateRangeRatio(current: number, low: number, high: number): number {
  if (high === low) return 0.5;
  const ratio = (current - low) / (high - low);
  return Math.min(Math.max(ratio, 0), 1);
}

/**
 * Fetches 1-year chart data for a symbol via Yahoo Finance proxy and parses it
 */
async function fetchYahooSymbol(symbol: string, name: string): Promise<AssetMetrics> {
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Yahoo data for ${symbol}: ${response.statusText}`);
  }

  const json = await response.json();
  const result = json.chart?.result?.[0];
  if (!result) {
    throw new Error(`Invalid Yahoo response format for ${symbol}`);
  }

  const close = result.indicators?.quote?.[0]?.close as (number | null)[];

  if (!close || close.length === 0) {
    throw new Error(`No close prices found for ${symbol}`);
  }

  // Filter out null values
  const prices = close.filter((p): p is number => p !== null && p !== undefined);
  if (prices.length === 0) {
    throw new Error(`All prices are null for ${symbol}`);
  }

  const currentPrice = prices[prices.length - 1];
  
  // Daily Change %
  const prevPrice = prices.length > 1 ? prices[prices.length - 2] : currentPrice;
  const dailyChangePercent = ((currentPrice - prevPrice) / prevPrice) * 100;

  // Weekly Change % (approx 5 business days ago)
  const weeklyPrevPrice = prices.length > 5 ? prices[prices.length - 6] : prices[0];
  const weeklyChangePercent = ((currentPrice - weeklyPrevPrice) / weeklyPrevPrice) * 100;

  // 52-Week High / Low
  const fiftyTwoWeekHigh = Math.max(...prices);
  const fiftyTwoWeekLow = Math.min(...prices);
  const rangePositionRatio = calculateRangeRatio(currentPrice, fiftyTwoWeekLow, fiftyTwoWeekHigh);

  // Historical prices for the past 5 trading days
  const historicalPrices = prices.slice(-5);

  return {
    name,
    symbol,
    currentPrice,
    dailyChangePercent,
    weeklyChangePercent,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    rangePositionRatio,
    isClosed: checkMarketClosed(symbol),
    historicalPrices
  };
}

/**
 * Fetches and calculates combined data for the Bonsai tree
 */
export async function getMarketData(): Promise<TreeData> {
  try {
    // Run fetches in parallel
    const [nifty, nasdaq, gold, btc] = await Promise.all([
      fetchYahooSymbol("^NSEI", "Nifty 50"),
      fetchYahooSymbol("NDAQ", "Nasdaq, Inc."),
      fetchYahooSymbol("GOLDBEES.NS", "Nippon India ETF Gold BeES"),
      fetchYahooSymbol("BTC-USD", "Bitcoin USD")
    ]);

    // Calculations based on PRD specifications:
    // Leaves Color: average of daily % changes
    const dailyChangePercent = (nifty.dailyChangePercent + nasdaq.dailyChangePercent + gold.dailyChangePercent + btc.dailyChangePercent) / 4;

    // Weather/Wind: average of weekly % changes
    const weeklyChangePercent = (nifty.weeklyChangePercent + nasdaq.weeklyChangePercent + gold.weeklyChangePercent + btc.weeklyChangePercent) / 4;

    // Leaf Density: average of 52-week position range
    const leafDensity = (nifty.rangePositionRatio + nasdaq.rangePositionRatio + gold.rangePositionRatio + btc.rangePositionRatio) / 4;

    return {
      dailyChangePercent,
      weeklyChangePercent,
      leafDensity,
      assets: { nifty, nasdaq, gold, btc },
      isMock: false
    };
  } catch (error) {
    console.warn("Error fetching real market data, falling back to mock data:", error);
    return MOCK_DATA;
  }
}
