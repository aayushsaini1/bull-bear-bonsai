import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sliders,
  Cloud,
  RefreshCw,
  Play,
  Pause,
  Sparkles,
  Leaf,
  Wind,
  Activity,
} from 'lucide-react';
import type { TreeData } from '../services/market';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  selectedAssetKey: 'nifty' | 'nasdaq' | 'mf';
  setSelectedAssetKey: (key: 'nifty' | 'nasdaq' | 'mf') => void;
}

// ── SparklineChart ────────────────────────────────────────────────────────────

const SparklineChart: React.FC<{
  assetKey: string;
  dailyChange: number;
  weeklyChange: number;
  width?: number;
  height?: number;
}> = ({ assetKey, dailyChange, weeklyChange, width = 120, height = 30 }) => {
  const isPositive = dailyChange >= 0;
  const lineColor = isPositive ? '#10b981' : '#ef4444';
  const gradientId = `sg-${assetKey}`;

  const pts = 14;
  const trendFactor = Math.max(-1, Math.min(1, dailyChange / 2.5));
  const vol = Math.min(1.5, Math.abs(weeklyChange) * 0.3 + 0.2);

  // Generate synthetic curve that trends with daily/weekly change
  const raw: number[] = Array.from({ length: pts }, (_, i) => {
    const progress = i / (pts - 1);
    const trendY = trendFactor * progress * (height * 0.42);
    const noise =
      Math.sin(i * 2.1 + dailyChange * 5) * vol * 4.5 +
      Math.cos(i * 3.7 + weeklyChange * 2) * vol * 2.5;
    return Math.max(3, Math.min(height - 3, height * 0.5 - trendY + noise));
  });

  // 3-point smoothing
  const smooth = raw.map((y, i) =>
    i === 0 || i === raw.length - 1 ? y : (raw[i - 1] + y + raw[i + 1]) / 3,
  );

  const pathD = smooth
    .map((y, i) => `${i === 0 ? 'M' : 'L'} ${((i / (pts - 1)) * width).toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="sparkline-svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ── Right-panel derivation helpers ────────────────────────────────────────────

function getLeafColorInfo(daily: number) {
  if (daily > 0.8)  return { text: 'Healthy Green',  color: 'green'  };
  if (daily > 0.2)  return { text: 'Light Green',    color: 'green'  };
  if (daily > -0.2) return { text: 'Neutral Amber',  color: 'yellow' };
  if (daily > -0.8) return { text: 'Pale Yellow',    color: 'yellow' };
  return              { text: 'Bear Red',            color: 'red'    };
}

function getWindKmh(weekly: number): number {
  if (weekly > 1.5)  return 8;
  if (weekly > 0.5)  return 14;
  if (weekly > -0.5) return 22;
  if (weekly > -1.5) return 38;
  return 65;
}

function getWeatherInfo(weekly: number) {
  if (weekly > 1.0)  return { text: 'Clear Sky',    color: 'yellow' };
  if (weekly >= -0.5) return { text: 'Light Rain',  color: 'blue'   };
  if (weekly >= -2.0) return { text: 'Heavy Rain',  color: 'blue'   };
  return               { text: 'Thunderstorm',     color: 'purple'  };
}

function getVolatilityInfo(data: TreeData) {
  const avgAbs =
    (Math.abs(data.assets.nifty.dailyChangePercent) +
      Math.abs(data.assets.nasdaq.dailyChangePercent) +
      Math.abs(data.assets.mf.dailyChangePercent)) /
    3;
  if (avgAbs < 0.4) return { text: 'Low',      color: 'green'  };
  if (avgAbs < 1.2) return { text: 'Moderate', color: 'yellow' };
  return              { text: 'High',         color: 'red'    };
}

function getCorrelationLabel(ratio: number) {
  if (ratio > 0.72) return 'Strong Positive';
  if (ratio > 0.52) return 'Moderate Positive';
  if (ratio > 0.35) return 'Neutral';
  return 'Negative';
}

function getMarketOverviewText(data: TreeData) {
  const d = data.dailyChangePercent;
  const w = data.weeklyChangePercent;
  if (d > 0 && w > 0)
    return 'Global markets trending higher driven by broad-based gains across indices and positive economic momentum.';
  if (d > 0)
    return 'Markets posting daily gains despite weekly headwinds. Short-term momentum remains constructive.';
  if (w > 0)
    return 'Weekly trend stays positive despite today\'s pullback. Long-term momentum remains intact.';
  return 'Markets facing broad-based pressure. Risk-off sentiment dominates across major indices.';
}

// ── Dashboard component ───────────────────────────────────────────────────────

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
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock — ticks every second, displayed as IST
  const [liveTime, setLiveTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLiveTime(
        now
          .toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Kolkata',
            hour12: true,
          })
          .toUpperCase() + ' IST',
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Dynamic market simulation in mock mode
  React.useEffect(() => {
    if (isSimulating && isMockMode) {
      simulationInterval.current = setInterval(() => {
        setMockParams(prev => {
          const newDaily  = Math.max(-3.0, Math.min(3.0, prev.dailyChangePercent  + (Math.random() - 0.5) * 0.15));
          const newWeekly = Math.max(-5.0, Math.min(5.0, prev.weeklyChangePercent + (Math.random() - 0.5) * 0.25));
          const newDensity = Math.max(0.05, Math.min(1.0, prev.leafDensity        + (Math.random() - 0.5) * 0.05));
          return {
            dailyChangePercent:  parseFloat(newDaily.toFixed(2)),
            weeklyChangePercent: parseFloat(newWeekly.toFixed(2)),
            leafDensity:         parseFloat(newDensity.toFixed(2)),
          };
        });
      }, 1500);
    } else {
      if (simulationInterval.current) clearInterval(simulationInterval.current);
    }
    return () => {
      if (simulationInterval.current) clearInterval(simulationInterval.current);
    };
  }, [isSimulating, isMockMode, setMockParams]);

  // Helpers
  const getTreeColorClass = (dailyChange: number) => {
    if (dailyChange > 0.5) return 'green-glow-text';
    if (dailyChange < -0.5) return 'red-glow-text';
    return 'yellow-glow-text';
  };

  const formatPrice = (value: number, symbol: string) => {
    if (symbol === '^NSEI')
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (symbol === '^IXIC')
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `₹${value.toFixed(2)}`;
  };

  const cleanSymbol = (symbol: string) => {
    if (symbol === '^NSEI') return 'NSEI';
    if (symbol === '^IXIC') return 'IXIC';
    if (symbol === '122639') return 'MUTUAL FUND';
    return symbol;
  };

  // Right-panel derived data
  const leafColorInfo  = getLeafColorInfo(data.dailyChangePercent);
  const windKmh        = getWindKmh(data.weeklyChangePercent);
  const weatherInfo    = getWeatherInfo(data.weeklyChangePercent);
  const volatilityInfo = getVolatilityInfo(data);
  const overviewText   = getMarketOverviewText(data);

  // Barcode element (reused in both footer and dev panel)
  const Barcode = () => (
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
            opacity: 0.6,
          }}
        />
      ))}
    </span>
  );

  return (
    <>
      {/* ═══════════════ LEFT SIDEBAR HUD ═══════════════ */}
      <aside className="sidebar-hud">

        {/* ── Scrollable sidebar content ── */}
        <div className="sidebar-content">

          {/* Header */}
          <div className="sidebar-header">
            <div className="flex-between w-full">
              <div className="app-logo-container">
                <img src="/bull-bear-bonsai-main.png" alt="Bull-Bear Bonsai" className="app-logo" />
              </div>
              {/* Refresh button */}
              <button
                className={`refresh-btn ${isLoading ? 'spinning' : ''}`}
                onClick={onRefresh}
                disabled={isMockMode || isLoading}
                title={isMockMode ? 'Refresh disabled in Dev Mode' : 'Refresh Market Feed'}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Subtitle */}
            <p className="app-subtitle">Markets breathe. We grow.</p>

            {/* Live clock badge */}
            <div className="live-clock-badge">
              <span className={`live-dot ${isMockMode ? 'dev-dot' : ''}`} />
              <span className={`live-label ${isMockMode ? 'dev-label' : ''}`}>
                {isMockMode ? 'DEV' : 'LIVE'}
              </span>
              <span className="live-time">{liveTime}</span>
            </div>
          </div>

          {/* Section label */}
          <div className="sidebar-section-title">Market Assets</div>

          {/* ── Asset cards with sparklines ── */}
          <div className="sidebar-indices-container">
            {Object.entries(data.assets).map(([key, asset]) => {
              const isSelected = selectedAssetKey === key;
              const isPositive = asset.dailyChangePercent >= 0;
              return (
                <div
                  key={asset.symbol}
                  className={`glass-card index-small-card ${isSelected ? (isPositive ? 'selected-positive' : 'selected-negative') : ''}`}
                  onClick={() => setSelectedAssetKey(key as 'nifty' | 'nasdaq' | 'mf')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-header">
                    <span className="asset-name">{asset.name}</span>
                    <span className="asset-tag">{cleanSymbol(asset.symbol)}</span>
                  </div>

                  <div className="card-body">
                    <div className="asset-price">{formatPrice(asset.currentPrice, asset.symbol)}</div>
                    <div className={`asset-change ${isPositive ? 'positive' : 'negative'}`}>
                      {isPositive ? '↗' : '↘'}{' '}
                      <span className="change-text">
                        {Math.abs(asset.dailyChangePercent).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Mini sparkline */}
                  <div className="sparkline-wrapper">
                    <SparklineChart
                      assetKey={key}
                      dailyChange={asset.dailyChangePercent}
                      weeklyChange={asset.weeklyChangePercent}
                    />
                  </div>

                  {asset.isClosed && (
                    <div className="market-closed-badge">Markets Closed</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer – Dev Mode trigger */}
          <footer className="sidebar-footer">
            <button
              className="dev-footer-btn"
              onClick={() => setIsDrawerOpen(true)}
              title="Open Dev Panel"
            >
              <Sliders size={14} style={{ marginRight: '6px' }} />
              <span>Dev Mode</span>
            </button>
          </footer>

        </div>{/* end .sidebar-content */}

        {/* ── Dev Panel Overlay – slides up over sidebar ── */}
        <div className={`sidebar-dev-overlay ${isDrawerOpen ? 'open' : ''}`}>

          {/* Overlay header */}
          <div className="dev-overlay-header">
            <button className="dev-back-btn" onClick={() => setIsDrawerOpen(false)}>
              ← Dev Controls
            </button>
            <span className="dev-overlay-title">Development Controls</span>
          </div>

          {/* Overlay body */}
          <div className="dev-overlay-body">

            {/* Mode switcher */}
            <div className="control-group">
              <label className="control-label">Control Mode</label>
              <div className="toggle-container">
                <button
                  className={`toggle-btn ${!isMockMode ? 'active' : ''}`}
                  onClick={() => { setIsMockMode(false); setIsSimulating(false); }}
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
                {/* Market simulator */}
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
                    onChange={e =>
                      setMockParams(prev => ({ ...prev, dailyChangePercent: parseFloat(e.target.value) }))
                    }
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
                    onChange={e =>
                      setMockParams(prev => ({ ...prev, weeklyChangePercent: parseFloat(e.target.value) }))
                    }
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
                    onChange={e =>
                      setMockParams(prev => ({ ...prev, leafDensity: parseFloat(e.target.value) }))
                    }
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
                    <strong>Notice:</strong> Rate limits detected. Displaying cached indices with live PPFAS NAV.
                  </div>
                )}
              </div>
            )}

          </div>{/* end .dev-overlay-body */}

          {/* Overlay footer */}
          <div className="dev-overlay-footer">
            <button className="dev-close-full-btn" onClick={() => setIsDrawerOpen(false)}>
              <Sliders size={16} style={{ marginRight: '8px' }} />
              Close Dev Panel
            </button>
            <div className="sidebar-signature">
              <span className="signature-text">made by</span>
              <Barcode />
              <a
                href="https://alpher03.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="signature-link"
              >
                @alpher03
              </a>
            </div>
          </div>

        </div>{/* end .sidebar-dev-overlay */}

      </aside>

      {/* ═══════════════ RIGHT PANEL HUD ═══════════════ */}
      <aside className="right-panel-hud">

        {/* Market Overview */}
        <div className="right-card">
          <div className="right-card-header">
            <TrendingUp size={13} className="right-card-icon" />
            <span className="right-card-title">Market Overview</span>
          </div>
          <p className="overview-body-text">{overviewText}</p>
          <div className="overview-footer">
            <span className="overview-link">See full report →</span>
            <div className="overview-sparkline">
              <SparklineChart
                assetKey="overview"
                dailyChange={data.dailyChangePercent}
                weeklyChange={data.weeklyChangePercent}
                width={80}
                height={36}
              />
            </div>
          </div>
        </div>

        {/* Tree Insights */}
        <div className="right-card">
          <div className="right-card-header">
            <span className="right-card-title">Tree Insights</span>
          </div>
          <div className="tree-insights-list">
            <div className="insight-row">
              <div className="insight-label">
                <Leaf size={13} className="insight-icon" />
                <span>Leaf Color</span>
              </div>
              <span className={`insight-value insight-${leafColorInfo.color}`}>
                • {leafColorInfo.text}
              </span>
            </div>

            <div className="insight-row">
              <div className="insight-label">
                <Wind size={13} className="insight-icon" />
                <span>Wind Speed</span>
              </div>
              <span className="insight-value insight-muted">{windKmh} km/h</span>
            </div>

            <div className="insight-row">
              <div className="insight-label">
                <Cloud size={13} className="insight-icon" />
                <span>Weather</span>
              </div>
              <span className={`insight-value insight-${weatherInfo.color}`}>
                • {weatherInfo.text}
              </span>
            </div>

            <div className="insight-row">
              <div className="insight-label">
                <Activity size={13} className="insight-icon" />
                <span>Volatility</span>
              </div>
              <span className={`insight-value insight-${volatilityInfo.color}`}>
                • {volatilityInfo.text}
              </span>
            </div>
          </div>
        </div>

        {/* Performance Correlation */}
        <div className="right-card">
          <div className="right-card-header">
            <span className="right-card-title">Performance Correlation</span>
          </div>
          <div className="correlation-list">
            {Object.entries(data.assets).map(([key, asset]) => (
              <div key={key} className="correlation-row">
                <div className="correlation-meta">
                  <span className="correlation-name">{asset.name}</span>
                  <span className="correlation-label">
                    {getCorrelationLabel(asset.rangePositionRatio)}
                  </span>
                </div>
                <div className="correlation-track">
                  <div
                    className="correlation-fill"
                    style={{ width: `${Math.round(asset.rangePositionRatio * 100)}%` }}
                  >
                    <div className="correlation-dot" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </aside>
    </>
  );
};

export default Dashboard;
