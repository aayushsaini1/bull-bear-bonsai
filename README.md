# 🌸 Bull-Bear Bonsai

> **⚠️ Work in Progress (WIP)**
> This project is currently under active development. Features, assets, and layouts are subject to change.

An interactive, asset-driven 3D living art installation built with React, Three.js, and React Three Fiber. The Bonsai tree grows, sways, and changes color dynamically based on real-time market indices and mutual fund performance.

## 🚀 Features

- **Procedural 3D Environment**: Immersive weather system with dynamic sky backgrounds, mist, rain, golden pollen motes, and lightning thunderstorms.
- **Dynamic 3D Sakura Model**: Loads a custom glTF Sakura tree that bends with the wind and blooms dynamically.
- **Market Reactivity**:
  - **Leaf/Blossom Color**: Interpolates between bullish green, neutral yellow, and bearish crimson based on daily % change.
  - **Foliage Density**: Scales the density and sizing of cherry blossoms matching the 52-week position range.
  - **Wind/Weather Intensity**: Controls wind sway speed and particle effects (Sunny, Cloudy, Rainy, Stormy) based on weekly performance.
- **Glassmorphism Left Panel**: A clean sidebar built with pure CSS displaying live indices (NSEI, IXIC, Mutual Fund NAV) with timezone-aware trading status indicators.
- **Inline Developer Controls**: Simulator and sliders built directly into the sidebar footer for testing different market conditions.

## 🛠️ Tech Stack

- **Framework**: React (Vite, TypeScript)
- **3D Graphics**: Three.js, React Three Fiber (R3F), `@react-three/drei`
- **Styling**: Vanilla CSS (glassmorphism details, Inter font family)
- **Data Source**: Yahoo Finance API (via Vercel Serverless proxy) & Indian Mutual Fund API

## 💻 Getting Started

### Development
Start the local development server:
```bash
npm run dev
```

### Production Build
Compile and bundle the production files:
```bash
npm run build
```
