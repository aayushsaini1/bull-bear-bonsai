import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Sliders, 
  Sun, 
  Cloud, 
  CloudRain, 
  Zap, 
  RefreshCw, 
  Play, 
  Pause,
  X,
  Sparkles
} from 'lucide-react';
import type { TreeData } from '../services/market';

interface DashboardProps {
  data: TreeData;
  isMockMode: boolean;
  setIsMockMode: (mode: boolean) => void;
  mockParams: {
    dailyChangePercent: number;
    weeklyChangePercent: number;
    leafDensity: number;
  };
  setMockParams: React.Dispatch<React.SetStateAction<{
    dailyChangePercent: number;
    weeklyChangePercent: number;
    leafDensity: number;
  }>>;
  onRefresh: () => void;
  isLoading: boolean;
  selectedAssetKey: "nifty" | "nasdaq" | "mf";
  setSelectedAssetKey: (key: "nifty" | "nasdaq" | "mf") => void;
  lastRefreshed: Date | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  isMockMode,
  setIsMockMode,
  mockParams,
  setMockParams,
  onRefresh,
  isLoading,
  selectedAssetKey,
  setSelectedAssetKey,
  lastRefreshed
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Toggle dynamic simulation in mock mode
  React.useEffect(() => {
    if (isSimulating && isMockMode) {
      simulationInterval.current = setInterval(() => {
        setMockParams(prev => {
          // Add small random walks to the inputs
          const newDaily = Math.max(-3.0, Math.min(3.0, prev.dailyChangePercent + (Math.random() - 0.5) * 0.15));
          const newWeekly = Math.max(-5.0, Math.min(5.0, prev.weeklyChangePercent + (Math.random() - 0.5) * 0.25));
          const newDensity = Math.max(0.05, Math.min(1.0, prev.leafDensity + (Math.random() - 0.5) * 0.05));
          
          return {
            dailyChangePercent: parseFloat(newDaily.toFixed(2)),
            weeklyChangePercent: parseFloat(newWeekly.toFixed(2)),
            leafDensity: parseFloat(newDensity.toFixed(2))
          };
        });
      }, 1500);
    } else {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    }

    return () => {
      if (simulationInterval.current) clearInterval(simulationInterval.current);
    };
  }, [isSimulating, isMockMode, setMockParams]);

  // Determine active weather icon
  const getWeatherIcon = (weeklyChange: number) => {
    if (weeklyChange > 1.0) return <Sun className="weather-icon text-yellow-500 animate-pulse-slow" />;
    if (weeklyChange >= -0.5) return <Cloud className="weather-icon text-gray-400" />;
    if (weeklyChange >= -2.0) return <CloudRain className="weather-icon text-blue-400 animate-bounce-slow" />;
    return <Zap className="weather-icon text-purple-400 animate-flash" />;
  };

  const getWeatherText = (weeklyChange: number) => {
    if (weeklyChange > 1.0) return 'Sunny (Soft Breeze)';
    if (weeklyChange >= -0.5) return 'Cloudy (Still)';
    if (weeklyChange >= -2.0) return 'Rainy (Moderate Gusts)';
    return 'Stormy (Heavy Winds)';
  };

  // Format currency helper
  const formatPrice = (value: number, symbol: string) => {
    if (symbol === "^NSEI") {
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (symbol === "^IXIC") {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${value.toFixed(2)}`; // Clean PPFAS NAV display
  };

  const cleanSymbol = (symbol: string) => {
    if (symbol === "^NSEI") return "NSEI";
    if (symbol === "^IXIC") return "IXIC";
    if (symbol === "122639") return "MUTUAL FUND"; // Hide scheme code as requested
    return symbol;
  };

  const getTreeColorClass = (dailyChange: number) => {
    if (dailyChange > 0.5) return 'green-glow-text';
    if (dailyChange < -0.5) return 'red-glow-text';
    return 'yellow-glow-text';
  };

  const displayDaily = isMockMode ? mockParams.dailyChangePercent : data.dailyChangePercent;
  const displayWeekly = isMockMode ? mockParams.weeklyChangePercent : data.weeklyChangePercent;
  const displayDensity = isMockMode ? mockParams.leafDensity : data.leafDensity;

  return (
    <>
      {/* LEFT SIDEBAR HUD */}
      <aside className="sidebar-hud">
        {/* Header */}
        <div className="sidebar-header">
          <div className="flex-between w-full">
            <div>
              <h1 className="app-title">BULL-BEAR BONSAI</h1>
              <p className="app-subtitle">Asset-Driven 3D Living Art</p>
            </div>
            <div className="badge-container">
              <span className={`status-badge ${isMockMode ? 'badge-dev' : 'badge-live'}`}>
                {isMockMode ? 'DEV' : 'LIVE'}
              </span>
              <button 
                className={`refresh-btn ${isLoading ? 'spinning' : ''}`}
                onClick={onRefresh}
                disabled={isMockMode || isLoading}
                title={isMockMode ? "Refresh disabled in Dev Mode" : "Refresh Market Feed"}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          {lastRefreshed && !isMockMode && (
            <div className="last-refreshed-badge">
              Last Refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>

        {/* 1. TREE CONDITION CARD (Hidden, kept for future use) */}
        {false && (
          <div className="glass-card tree-condition-card">
            <div className="card-header">
              <span className="asset-name">Tree Condition</span>
              <span className="asset-ticker">SYSTEM</span>
            </div>
            <div className="tree-metrics-list">
              <div className="tree-metric-row">
                <span className="metric-label">Leaf Color</span>
                <span className={`metric-value ${getTreeColorClass(displayDaily)}`}>
                  {displayDaily >= 0 ? '+' : ''}{displayDaily.toFixed(2)}%
                </span>
              </div>
              
              <div className="tree-metric-row">
                <span className="metric-label">Weather System</span>
                <span className="metric-value flex-center">
                  {getWeatherIcon(displayWeekly)}
                  <span style={{ marginLeft: '6px' }}>{getWeatherText(displayWeekly)}</span>
                </span>
              </div>
              
              <div className="tree-metric-row">
                <span className="metric-label">Leaf Density</span>
                <span className="metric-value text-indigo">
                  {Math.round(displayDensity * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Divider Title */}
        <div className="sidebar-section-title">Market Assets</div>

        {/* 2. INDICES CARDS */}
        <div className="sidebar-indices-container">
          {Object.entries(data.assets).map(([key, asset]) => {
            const isSelected = selectedAssetKey === key;
            const isPositive = asset.dailyChangePercent >= 0;
            return (
              <div 
                key={asset.symbol} 
                className={`glass-card index-small-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedAssetKey(key as "nifty" | "nasdaq" | "mf")}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-header">
                  <span className="asset-name">{asset.name}</span>
                  <span className="asset-tag">{cleanSymbol(asset.symbol)}</span>
                </div>
                <div className="card-body">
                  <div className="asset-price">
                    {formatPrice(asset.currentPrice, asset.symbol)}
                  </div>
                  <div className={`asset-change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span className="change-text">
                      {isPositive ? '+' : ''}{asset.dailyChangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Clear message if market is closed */}
                {asset.isClosed && (
                  <div className="market-closed-badge">
                    Markets Closed
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 3. INLINE DEV CONTROL PANEL */}
        {isDrawerOpen && (
          <div className="sidebar-dev-panel">
            <div className="dev-panel-header">
              <span className="dev-panel-title">Development Controls</span>
              <button className="close-inline-btn" onClick={() => setIsDrawerOpen(false)}>
                <X size={14} />
              </button>
            </div>
            
            <div className="dev-panel-body">
              {/* Mode Switcher */}
              <div className="control-group">
                <label className="control-label">Control Mode</label>
                <div className="toggle-container">
                  <button 
                    className={`toggle-btn ${!isMockMode ? 'active' : ''}`}
                    onClick={() => {
                      setIsMockMode(false);
                      setIsSimulating(false);
                    }}
                  >
                    Live Market
                  </button>
                  <button 
                    className={`toggle-btn ${isMockMode ? 'active' : ''}`}
                    onClick={() => setIsMockMode(true)}
                  >
                    Mock Sliders
                  </button>
                </div>
              </div>

              {isMockMode ? (
                <>
                  {/* Simulation Mode */}
                  <div className="control-group border-top">
                    <div className="flex-between">
                      <label className="control-label flex-center">
                        <Sparkles size={13} className="text-yellow-500 mr-1 animate-pulse" />
                        Market Simulator
                      </label>
                      <button 
                        className={`sim-btn ${isSimulating ? 'active' : ''}`}
                        onClick={() => setIsSimulating(!isSimulating)}
                      >
                        {isSimulating ? <Pause size={12} /> : <Play size={12} />}
                        <span>{isSimulating ? 'Simulating' : 'Start Feed'}</span>
                      </button>
                    </div>
                    <p className="control-help">Simulates a live market feed ticking with minor adjustments</p>
                  </div>

                  {/* Slider 1: Daily Change */}
                  <div className="control-group border-top">
                    <div className="flex-between">
                      <span className="slider-label">Daily % Change (Leaf Color)</span>
                      <span className={`slider-value ${getTreeColorClass(mockParams.dailyChangePercent)}`}>
                        {mockParams.dailyChangePercent >= 0 ? '+' : ''}{mockParams.dailyChangePercent}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-3.0" 
                      max="3.0" 
                      step="0.05"
                      value={mockParams.dailyChangePercent} 
                      disabled={isSimulating}
                      onChange={(e) => setMockParams(prev => ({ ...prev, dailyChangePercent: parseFloat(e.target.value) }))}
                      className="slider-input"
                    />
                  </div>

                  {/* Slider 2: Weekly Change */}
                  <div className="control-group">
                    <div className="flex-between">
                      <span className="slider-label">Weekly % Change (Weather)</span>
                      <span className="slider-value text-indigo">
                        {mockParams.weeklyChangePercent >= 0 ? '+' : ''}{mockParams.weeklyChangePercent}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="-5.0" 
                      max="5.0" 
                      step="0.1"
                      value={mockParams.weeklyChangePercent} 
                      disabled={isSimulating}
                      onChange={(e) => setMockParams(prev => ({ ...prev, weeklyChangePercent: parseFloat(e.target.value) }))}
                      className="slider-input"
                    />
                  </div>

                  {/* Slider 3: Leaf Density */}
                  <div className="control-group">
                    <div className="flex-between">
                      <span className="slider-label">Leaf Density (52W Position)</span>
                      <span className="slider-value text-green-500">
                        {Math.round(mockParams.leafDensity * 100)}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="1.0" 
                      step="0.02"
                      value={mockParams.leafDensity} 
                      disabled={isSimulating}
                      onChange={(e) => setMockParams(prev => ({ ...prev, leafDensity: parseFloat(e.target.value) }))}
                      className="slider-input"
                    />
                  </div>
                </>
              ) : (
                <div className="live-instructions">
                  <p>Sliders are disabled in <strong>Live Market</strong> mode.</p>
                  <p>The tree reacts automatically to the selected market asset.</p>
                  {data.isMock && (
                    <div className="warning-box">
                      <strong>Notice:</strong> Rates limits detected. Displaying cached indices with live PPFAS NAV.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Footer */}
        <footer className="sidebar-footer">
          <button 
            className={`dev-footer-btn ${isDrawerOpen ? 'active' : ''}`}
            onClick={() => setIsDrawerOpen(prev => !prev)}
            title="Toggle Inline Dev Panel"
          >
            <Sliders size={14} style={{ marginRight: '6px' }} />
            <span>{isDrawerOpen ? 'Close Dev Panel' : 'Dev Controls'}</span>
          </button>

          <div className="sidebar-signature">
            <span className="signature-text">made by</span>
            <span className="signature-barcode" title="ALPH03">
              {[1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 2, 1].map((width, idx) => (
                <span 
                  key={idx} 
                  style={{ 
                    display: 'inline-block', 
                    width: `${width}px`, 
                    height: '11px', 
                    backgroundColor: 'var(--color-muted)',
                    marginLeft: '1.5px',
                    opacity: 0.6
                  }} 
                />
              ))}
            </span>
            <a 
              href="https://alpher03.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="signature-link"
            >
              @alpher03
            </a>
          </div>
        </footer>
      </aside>
    </>
  );
};
export default Dashboard;
