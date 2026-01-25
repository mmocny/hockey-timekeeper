# 🏒 Hockey Timekeeper

A streamlined web application for youth hockey coaches to track player ice time and manage shifts.

## Tech Stack

- **Framework:** Astro (Hybrid SSR)
- **Styling:** Tailwind CSS 4
- **State:** Nano Stores
- **Database:** Cloudflare D1
- **Deployment:** Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js (Latest LTS)
- Cloudflare Account (for deployment)

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### Database Setup (Cloudflare D1)

1. Create a D1 database:
   ```bash
   npx wrangler d1 create hockey_db
   ```

2. Update `wrangler.jsonc` with your new database ID.

3. Initialize the database schema:
   ```bash
   npx wrangler d1 execute hockey_db --local --file=./schema.sql
   ```
   (Remove `--local` to execute against the production database)

### Deployment

Deploy to Cloudflare Pages:
```bash
npm run build
npx wrangler pages deploy dist
```

## Features

- **Live Dashboard:** Tap players to toggle "On Ice" status.
- **Global Pause:** One-click pause for game whistles.
- **Line Swaps:** Bulk toggle forwards or defensemen.
- **Ice Time Stats:** Track shift duration and total game time per player.
- **Persistence:** Save game results to Cloudflare D1.