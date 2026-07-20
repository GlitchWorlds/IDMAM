# IDMM Phase 3 - Complete React UI Components

## Context
IDMM download engine is running at http://127.0.0.1:9977. Electron wrapper is at D:\IDMM\electron\main.js. React UI project is at D:\IDMM\electron\ui\ with Vite + React 19 + Tailwind v4 + Recharts.

Already created:
- package.json, vite.config.js, index.html, src/main.jsx, src/index.css, src/api.js
- src/App.jsx (imports all components below)
- src/hooks/useWebSocket.js

## Task
Create these 6 component files, then npm install + npm run build.

### 1. src/components/Sidebar.jsx
Fixed left sidebar (w-56), dark bg-slate-950. Shows:
- IDMM logo (h1 gradient blue-to-purple text)
- Nav buttons: All, Active, Completed, Paused, Failed (each with count badge)
- Mini speed indicator at bottom
- Settings gear icon button
- Props: filter, setFilter, stats, totalSpeed, onSettings

### 2. src/components/Header.jsx
Top bar (h-14 bg-slate-900 border-b). Contains:
- Search input (dark style, magnifying glass icon via unicode )
- Total speed display (e.g. "12.4 MB/s")
- "New Download" button (blue, rounded)
- Server status dot (green=online, red=offline)
- Props: search, setSearch, totalSpeed, onAdd, serverOnline, connected

### 3. src/components/DownloadList.jsx
Main content area. Shows download items or empty state.
Each download item (bg-slate-800 rounded-xl p-4 mb-3):
- Filename (bold, truncate)
- Progress bar (gradient blue-purple, rounded-full, h-2)
- Stats row: progress%, speed, ETA, threads
- Action buttons: pause/resume/cancel/delete (icon buttons)
- Status-colored indicators (blue=downloading, green=completed, amber=paused, red=failed)
- Props: downloads array

Use api.pauseDownload, api.resumeDownload, api.cancelDownload, api.deleteDownload from ../api

### 4. src/components/AddDownload.jsx
Modal overlay (fixed inset-0 bg-black/60). Dark modal card (bg-slate-800 rounded-2xl p-6 w-[500px]):
- Title "New Download"
- URL input (large, auto-focus)
- Optional filename input
- "Download" button (blue, full width)
- Close button (X top-right)
- Props: onClose, onAdded
- On submit: call api.startDownload({url, filename}), then onAdded(), then onClose()

### 5. src/components/SpeedGraph.jsx
Bottom bar (h-20 bg-slate-900 border-t). Contains:
- Recharts AreaChart (responsive, data from props)
- X-axis hidden, Y-axis showing MB/s
- Area fill: gradient blue, stroke: blue-400
- Current speed text overlay
- Props: data array of {time, speed}

### 6. src/components/Settings.jsx
Modal overlay. Dark card with settings form:
- Default threads (number input, 1-64)
- Max concurrent downloads (number input)
- Save path (text input)
- Save button (calls api.updateSettings)
- Close button
- Props: onClose

## Important
- All components use Tailwind v4 classes (bg-slate-800, text-slate-100, rounded-xl, etc.)
- Import formatBytes, formatSpeed, formatETA from '../api'
- Dark theme: bg-slate-900 base, bg-slate-800 cards, blue-500 accent
- After creating files: cd D:\IDMM\electron\ui && npm install && npm run build
- Report: files created, build success/failure, any errors

