# PRD: Portfolio Tree (Phase 1)

## Overview
A standalone web experiment for the portfolio "Experiments" tab. A fixed-size 3D tree
whose leaf color, weather, and leaf density reflect real market data from a fixed
basket of assets (Nifty50, Nasdaq, one Mutual Fund). No user portfolio connection,
no auth, no growth stages — kept deliberately minimal for Phase 1.

## Goals
- Build a visually alive, ambient data visualization — not a dashboard
- Use only free, no-auth data sources
- Keep scope tight: 2 data-driven properties + 1 derived property, nothing more

## Non-Goals (explicitly out of scope for Phase 1)
- No connection to personal brokerage/MF holdings
- No tree growth stages or size changes (fixed size tree)
- No wind as an independent data signal (wind is purely a cosmetic effect of weather)
- No real-time intraday polling requirement — last available close data is acceptable
- No manual data upload/input

## Fixed Asset Basket
- Nifty50 (`^NSEI`)
- Nasdaq (`^IXIC`)


## Data → Tree Property Mapping

| Property | Data Source | Calculation | Visual Behavior |
|---|---|---|---|
| **Leaf color** | Daily % change, averaged across basket | Weighted avg of `regularMarketChangePercent` (Nifty50/Nasdaq) + NAV diff (MF: `(today NAV - yesterday NAV) / yesterday NAV`) | Green (positive) → yellow (flat) → brown/red (negative) gradient |
| **Weather (+ wind as its side-effect)** | Weekly % change, averaged across basket | Same sources, averaged over trailing 5-7 days | Buckets into Sunny / Cloudy / Rainy / Storm. Wind intensity is tied to the bucket — soft breeze (sunny), near-still (cloudy), moderate gusts (rainy), heavy wind (storm). Not an independent data signal. |
| **Leaf density** | 52-week range position, per asset (averaged) | `(current price - 52w low) / (52w high - 52w low)` | Near 1 = full/lush tree, near 0 = sparse/bare branches |

## Data Sources (both free, no auth)
- **Yahoo Finance quote endpoint** (unofficial): `regularMarketChangePercent`,
  `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `regularMarketPrice` for `^NSEI` and `^IXIC`
- **mfapi.in**: NAV history array for the chosen MF scheme code — diff last 2 entries
  for daily change, ~5-7 entries back for weekly change, min/max of trailing year for
  52-week band

## Architecture
- **Frontend**: Vite + React + React Three Fiber (R3F) — chosen for Three.js-level
  performance with React state management for wiring data cleanly into 3D properties.
  Next.js skipped — no SSR/routing needed for a single-page standalone experiment.
- **Data layer**: A lightweight serverless function (Vercel function or Cloudflare
  Worker) proxies Yahoo Finance calls server-side to avoid browser CORS issues.
  mfapi.in is CORS-friendly but can be routed through the same proxy for uniformity.
- **Update cadence**: Client polls the serverless proxy every 15-30 min while the
  page is open. No build-time pre-fetching — always reasonably fresh during a session.

## Build Order
1. **3D tree scene first**, all 3 properties wired to hardcoded/mock values — validates
   the visual design (color gradient, weather states, density range) independent of
   any data plumbing
2. **Data fetch + calculation layer**, built and tested standalone (POC) — confirm
   Yahoo + mfapi.in return clean, parseable values for the fixed basket
3. **Wire real data into the tree**, replacing mock values
4. **Polish**: transitions between states, idle animation smoothing, edge case handling

## Open Items / Thresholds to Lock Next
- Color gradient stops — what daily % maps to full green vs. full red
- Weather bucket cutoffs — weekly % ranges for sunny / cloudy / rainy / storm
- Density normalization edge cases — behavior when current price equals 52w high/low
  exactly, or if 52w high == 52w low (flat instrument)
- Final MF scheme code selection