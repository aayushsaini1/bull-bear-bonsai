import { useState, useEffect, useCallback } from 'react';
import BonsaiCanvas from './components/BonsaiCanvas';
import Dashboard from './components/Dashboard';
import { getMarketData, MOCK_DATA, type TreeData } from './services/market';

function App() {
  const [data, setData] = useState<TreeData>(MOCK_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMockMode, setIsMockMode] = useState<boolean>(false);
  const [selectedAssetKey, setSelectedAssetKey] = useState<"nifty" | "nasdaq" | "mf">("nifty");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Custom mock parameters for the interactive sliders
  const [mockParams, setMockParams] = useState({
    dailyChangePercent: 0.35,
    weeklyChangePercent: 1.15,
    leafDensity: 0.85,
  });

  // Fetch live market data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const marketData = await getMarketData();
      setData(marketData);
      setLastRefreshed(new Date());

      // Seed mock sliders with actual market values initially
      setMockParams({
        dailyChangePercent: parseFloat(marketData.dailyChangePercent.toFixed(2)),
        weeklyChangePercent: parseFloat(marketData.weeklyChangePercent.toFixed(2)),
        leafDensity: parseFloat(marketData.leafDensity.toFixed(2)),
      });
    } catch (error) {
      console.error("Error updating feed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    loadData();

    // Auto refresh every 20 minutes
    const interval = setInterval(loadData, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Determine current active values to feed the 3D model based on the selected asset
  const selectedAsset = data.assets[selectedAssetKey] || data.assets.nifty;
  
  const activeDaily = isMockMode ? mockParams.dailyChangePercent : selectedAsset.dailyChangePercent;
  const activeWeekly = isMockMode ? mockParams.weeklyChangePercent : selectedAsset.weeklyChangePercent;
  const activeDensity = isMockMode ? mockParams.leafDensity : selectedAsset.rangePositionRatio;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 3D Visualizer Canvas Layer (Background) */}
      <BonsaiCanvas
        dailyChangePercent={activeDaily}
        weeklyChangePercent={activeWeekly}
        leafDensity={activeDensity}
      />

      {/* 2D Glassmorphism Interface Layer (Foreground) */}
      <div className="interface-layer">
        <Dashboard
          data={data}
          isMockMode={isMockMode}
          setIsMockMode={setIsMockMode}
          mockParams={mockParams}
          setMockParams={setMockParams}
          onRefresh={loadData}
          isLoading={isLoading}
          selectedAssetKey={selectedAssetKey}
          setSelectedAssetKey={setSelectedAssetKey}
          lastRefreshed={lastRefreshed}
        />
      </div>
    </div>
  );
}

export default App;
