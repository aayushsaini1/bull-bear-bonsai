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
}

export interface TreeData {
  dailyChangePercent: number;    // Leaves color: green -> yellow -> red
  weeklyChangePercent: number;   // Weather/Wind: sunny -> cloudy -> rainy -> storm
  leafDensity: number;           // Leaves quantity: 0 (bare) to 1 (full)
  assets: {
    nifty: AssetMetrics;
    nasdaq: AssetMetrics;
    mf: AssetMetrics;
  };
  isMock: boolean;
}

/**
 * Checks if the primary market is closed for a given asset symbol
 */
export function checkMarketClosed(symbol: string): boolean {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;

  if (symbol === "^NSEI") {
    // Nifty 50: Monday-Friday, 9:15 AM - 3:30 PM IST (UTC+5:30)
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const day = istTime.getDay();
    if (day === 0 || day === 6) return true; // Weekend
    const mins = istTime.getHours() * 60 + istTime.getMinutes();
    return mins < (9 * 60 + 15) || mins > (15 * 60 + 30);
  }
  
  if (symbol === "^IXIC") {
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
  
  // PPFAS Mutual Fund updates daily in the late evening on business days.
  // It remains static (closed) outside weekday late evenings.
  const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
  const day = istTime.getDay();
  if (day === 0 || day === 6) return true;
  const hr = istTime.getHours();
  // Active only between 8 PM and 11 PM when NAV is updated
  return hr < 20 || hr >= 23;
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
      currentPrice: 24320.50,
      dailyChangePercent: 0.45,
      weeklyChangePercent: 1.25,
      fiftyTwoWeekHigh: 25078.00,
      fiftyTwoWeekLow: 19300.00,
      rangePositionRatio: 0.87,
      isClosed: checkMarketClosed("^NSEI"),
    },
    nasdaq: {
      name: "Nasdaq Composite",
      symbol: "^IXIC",
      currentPrice: 19120.30,
      dailyChangePercent: -0.15,
      weeklyChangePercent: 0.60,
      fiftyTwoWeekHigh: 20120.00,
      fiftyTwoWeekLow: 14500.00,
      rangePositionRatio: 0.82,
      isClosed: checkMarketClosed("^IXIC"),
    },
    mf: {
      name: "Parag Parikh Flexi Cap Fund",
      symbol: "122639",
      currentPrice: 91.29,
      dailyChangePercent: 0.75,
      weeklyChangePercent: 1.60,
      fiftyTwoWeekHigh: 95.00,
      fiftyTwoWeekLow: 68.50,
      rangePositionRatio: 0.86,
      isClosed: checkMarketClosed("122639"),
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

  return {
    name,
    symbol,
    currentPrice,
    dailyChangePercent,
    weeklyChangePercent,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    rangePositionRatio,
    isClosed: checkMarketClosed(symbol)
  };
}

/**
 * Fetches Mutual Fund data from mfapi.in
 */
async function fetchMutualFund(schemeCode: string, name: string): Promise<AssetMetrics> {
  const url = `https://api.mfapi.in/mf/${schemeCode}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch MF data for ${schemeCode}: ${response.statusText}`);
  }

  const json = await response.json();
  const data = json.data as { date: string; nav: string }[];
  if (!data || data.length === 0) {
    throw new Error(`No data found for MF ${schemeCode}`);
  }

  // Parse NAVs (latest date is index 0)
  const navs = data.map(d => parseFloat(d.nav)).filter(n => !isNaN(n));
  if (navs.length === 0) {
    throw new Error(`No valid NAVs found for MF ${schemeCode}`);
  }

  const currentPrice = navs[0];
  
  // Daily Change % (index 0 vs index 1)
  const prevPrice = navs.length > 1 ? navs[1] : currentPrice;
  const dailyChangePercent = ((currentPrice - prevPrice) / prevPrice) * 100;

  // Weekly Change % (approx 5 business days ago)
  const weeklyPrevPrice = navs.length > 5 ? navs[5] : navs[navs.length - 1];
  const weeklyChangePercent = ((currentPrice - weeklyPrevPrice) / weeklyPrevPrice) * 100;

  // 52-Week High / Low (approx 250 business days)
  const trailingYearNavs = navs.slice(0, 250);
  const fiftyTwoWeekHigh = Math.max(...trailingYearNavs);
  const fiftyTwoWeekLow = Math.min(...trailingYearNavs);
  const rangePositionRatio = calculateRangeRatio(currentPrice, fiftyTwoWeekLow, fiftyTwoWeekHigh);

  return {
    name,
    symbol: schemeCode,
    currentPrice,
    dailyChangePercent,
    weeklyChangePercent,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    rangePositionRatio,
    isClosed: checkMarketClosed(schemeCode)
  };
}

/**
 * Fetches and calculates combined data for the Bonsai tree
 */
export async function getMarketData(): Promise<TreeData> {
  try {
    // Run fetches in parallel
    const [nifty, nasdaq, mf] = await Promise.all([
      fetchYahooSymbol("^NSEI", "Nifty 50"),
      fetchYahooSymbol("^IXIC", "Nasdaq Composite"),
      fetchMutualFund("122639", "Parag Parikh Flexi Cap Fund")
    ]);

    // Calculations based on PRD specifications:
    // Leaves Color: average of daily % changes
    const dailyChangePercent = (nifty.dailyChangePercent + nasdaq.dailyChangePercent + mf.dailyChangePercent) / 3;

    // Weather/Wind: average of weekly % changes
    const weeklyChangePercent = (nifty.weeklyChangePercent + nasdaq.weeklyChangePercent + mf.weeklyChangePercent) / 3;

    // Leaf Density: average of 52-week position range
    const leafDensity = (nifty.rangePositionRatio + nasdaq.rangePositionRatio + mf.rangePositionRatio) / 3;

    return {
      dailyChangePercent,
      weeklyChangePercent,
      leafDensity,
      assets: { nifty, nasdaq, mf },
      isMock: false
    };
  } catch (error) {
    console.warn("Error fetching real market data, falling back to mock data:", error);
    // If Yahoo blocks us but MF works, we could still fall back to mock for Nifty/Nasdaq
    // Let's attempt to fetch MF data individually to see if it works, otherwise return complete mock
    try {
      const mf = await fetchMutualFund("122639", "Parag Parikh Flexi Cap Fund");
      const mockNifty = MOCK_DATA.assets.nifty;
      const mockNasdaq = MOCK_DATA.assets.nasdaq;
      
      const dailyChangePercent = (mockNifty.dailyChangePercent + mockNasdaq.dailyChangePercent + mf.dailyChangePercent) / 3;
      const weeklyChangePercent = (mockNifty.weeklyChangePercent + mockNasdaq.weeklyChangePercent + mf.weeklyChangePercent) / 3;
      const leafDensity = (mockNifty.rangePositionRatio + mockNasdaq.rangePositionRatio + mf.rangePositionRatio) / 3;

      return {
        dailyChangePercent,
        weeklyChangePercent,
        leafDensity,
        assets: {
          nifty: mockNifty,
          nasdaq: mockNasdaq,
          mf
        },
        isMock: true // Still flag it as using some mock since indices are mock
      };
    } catch (e) {
      // Total fallback
      return MOCK_DATA;
    }
  }
}
