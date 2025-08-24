# ⚽ eFootball Tournament Dashboard

This repository contains a full-stack **gaming-inspired** eFootball Tournament Dashboard with a modern, dark-themed UI that brings the excitement of esports to football tournament management.

## 🎮 Features

### 🌟 Gaming-Inspired UI
- **Dark Theme**: Sleek charcoal and black gradient backgrounds
- **Neon Accents**: Electric blue and cyan highlights throughout the interface
- **Smooth Animations**: Card hover effects, winner celebrations, and smooth transitions
- **Gaming Typography**: Bold Orbitron fonts for headers with glowing text effects
- **Interactive Elements**: Hover animations, scale effects, and neon glow on buttons

### 🏆 Tournament Management
- **Real-time Updates**: Live tournament status, player standings, and match results
- **Winner Celebrations**: Animated trophy icons and glowing winner chips
- **Match Status Indicators**: Color-coded system (Green=Completed, Orange=Ongoing, Gray=Scheduled)
- **Responsive Design**: Optimized for both desktop and mobile gaming experiences

### 📊 Advanced Analytics
- **Interactive Standings**: Top players highlighted with gold accents and trophy icons
- **Match Tracking**: Complete score history with player name resolution
- **Tournament Progress**: Visual indicators for tournament phases (Group → Semi → Final)

It includes:

- `backend/` — Node + Express API with MySQL/SQLite persistence and comprehensive tournament logic
- `frontend/` — React + TypeScript + Vite app with Material UI and custom gaming aesthetics

## 🚀 Quick start (Windows PowerShell)

**Note: This application now connects to a deployed backend server, so you only need to run the frontend locally.**

1. **Start the frontend dev server**

```powershell
cd d:/Learning/Efootball/frontend
npm install
npm run dev
```

The frontend dev server runs on http://localhost:5173 and connects to the remote backend at https://efootball-backend-lsv5.onrender.com

2. **Backend API (Already Deployed)**

The backend is deployed and running at: https://efootball-backend-lsv5.onrender.com
- No need to run it locally
- All API calls are automatically routed to the remote server

## 🎯 Build publishable frontend files

To produce publishable static files with the gaming-themed UI:

```powershell
cd d:/Learning/Efootball/frontend
npm run build
```

## 🔌 Backend endpoints

The backend is deployed at https://efootball-backend-lsv5.onrender.com and implements the following REST endpoints with MySQL/SQLite persistence:

- POST `/api/players` — create a new player
- POST `/api/tournaments` — create a new tournament  
- GET `/api/tournaments` — list tournaments with players and matches
- POST `/api/tournaments/:id/players` — add player to tournament
- POST `/api/tournaments/:id/generate-matches` — generate round-robin + knockout matches
- PUT `/api/matches/:id/score` — input match result (returns winner for finals)
- GET `/api/tournaments/:id/standings` — computed standings with goal stats
- GET `/api/tournaments/:id/winner` — tournament winner if completed

All data persists in SQLite by default (with MySQL fallback support).

## 🎮 Gaming UI Features

### Visual Enhancements
- **Gradient Cards**: Each tournament card features dark blue-to-black gradients
- **Neon Borders**: Electric blue borders that glow on hover
- **Winner Animations**: Pulsing trophy icons and glowing winner chips
- **Status Indicators**: Color-coded match status (🟢 Completed, 🟠 Ongoing, ⚫ Scheduled)

### Interactive Elements  
- **Hover Effects**: Cards scale up with enhanced shadows and border glow
- **Smooth Transitions**: 300ms cubic-bezier animations throughout
- **Expand/Collapse**: Tournament details with animated icon rotation
- **Button Glow**: Interactive buttons with neon accent hover states

### Typography & Icons
- **Orbitron Font**: Futuristic headers with text shadows
- **Gaming Icons**: Soccer balls, trophies, and sports icons throughout
- **Emoji Headers**: Visual section headers (🏆 Winner, 📊 Standings, ⚽ Matches)
