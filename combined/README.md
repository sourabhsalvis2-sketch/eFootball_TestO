# eFootball Tournament Manager - Next.js Edition

🎉 **COMPLETE FRONTEND + BACKEND COMBINED APPLICATION**

This is a single Next.js application that combines both your frontend React components and backend API routes into one deployable project.

## ✅ What's Included

### Frontend Pages (Next.js file-based routing):
- **Home Page**: `/` - Tournament dashboard with live standings and match results
- **Admin Login**: `/admin` - Authentication page
- **Admin Dashboard**: `/admin/dashboard` - Full tournament management interface

### Backend API Routes (Next.js App Router):
- **Players**: `GET/POST /api/players`
- **Tournaments**: `GET/POST /api/tournaments`
- **Tournament Management**:
  - `POST /api/tournaments/[id]/players` - Add players
  - `POST /api/tournaments/[id]/generate-matches` - Generate matches
  - `GET /api/tournaments/[id]/standings` - Get standings
  - `GET /api/tournaments/[id]/winner` - Get winner
  - `GET /api/tournaments/[id]/matches` - Get matches
- **Matches**: `PUT /api/matches/[id]` - Update scores

### Database:
- **Turso SQLite** - Cloud database with local development support
- **Complete schema** - Players, tournaments, matches, standings

## 🚀 Quick Start

### Development:
```bash
cd combined
npm install
npm run dev
```
Visit: `http://localhost:3000`

### Production Build:
```bash
npm run build
npm start
```

## ☁️ Deploy to Vercel

### Option 1: Vercel CLI
```bash
npm install -g vercel
cd combined
vercel
```

### Option 2: Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Connect your Git repository
3. Set the **Root Directory** to `combined/`
4. Add environment variables:
   - `TURSO_DB_URL`: Your Turso database URL
   - `TURSO_DB_TOKEN`: Your Turso auth token
5. Deploy!

### Option 3: GitHub Integration
1. Push the `/combined` folder to a GitHub repository
2. Connect to Vercel
3. Set build settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `combined/`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

## 🔧 Environment Variables

Create `.env.local` in the `combined/` directory:
```env
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_DB_TOKEN=your-auth-token
```

## 📁 Project Structure

```
combined/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page (tournament dashboard)
│   │   ├── admin/
│   │   │   ├── page.tsx          # Admin login
│   │   │   └── dashboard/
│   │   │       └── page.tsx      # Admin dashboard
│   │   ├── api/                  # All API routes
│   │   ├── layout.tsx            # App layout with Material-UI
│   │   └── globals.css           # Styling
│   └── lib/
│       ├── api.ts                # Axios client
│       └── db.ts                 # Database service
├── package.json
├── next.config.js
├── tsconfig.json
└── .env.local                    # Environment variables
```

## 🎯 Key Benefits

✅ **Single Application**: Frontend + Backend in one deployable unit
✅ **Consistent Behavior**: Same API routes work locally and on Vercel  
✅ **TypeScript**: Full type safety throughout
✅ **Material-UI**: Beautiful, responsive interface
✅ **Production Ready**: Built with Next.js 15 best practices

## 🔄 Migration Summary

- ✅ **React Router → Next.js Router**: File-based routing
- ✅ **Express API → Next.js API Routes**: App Router pattern
- ✅ **Vite → Next.js**: Unified build system
- ✅ **Development/Production Parity**: No environment differences
- ✅ **Database**: Same Turso SQLite with all tournament logic
