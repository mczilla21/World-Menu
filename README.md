# 🌍 World Menu

**Free, open-source restaurant ordering system that breaks language barriers.**

A customer in Japan who only speaks English can order from a Japanese menu in English. The kitchen sees it in Japanese. No miscommunication. No lost orders. No expensive POS systems.

## Features

### 🌐 Multi-Language Ordering
- Customers pick their language on the tablet — menu translates instantly
- Kitchen always sees orders in the restaurant's native language
- Supports 14+ languages: English, Spanish, Chinese, Japanese, Korean, Thai, Vietnamese, French, German, Portuguese, Arabic, Russian, Italian, Hindi

### 📱 Four Modes, One System
- **Customer Mode** — table tablets or phones. Browse menu, order, call waiter, request check
- **Server Mode** — take orders, view tables, manage bills, print receipts
- **Chef / Kitchen Mode** — live order queue with timers, station filtering, 86 items
- **Admin Mode** — full menu management, reports, settings, backup/restore

### 🍽️ Restaurant Features
- **Real-time** — orders appear on kitchen screens instantly via WebSocket
- **Table Overview** — visual grid showing all table statuses at a glance
- **Station Filtering** — kitchen helpers see only their assigned categories (apps, grill, etc.)
- **86 Button** — chef can 86 items from the kitchen screen, instantly hides from all menus
- **Order Timers** — color-coded progress bars (green → yellow → red)
- **Service Calls** — customers tap "Call Waiter" or "Request Check", server gets notified
- **Long-press Ingredients** — hold any item to see/modify ingredients (NO bean sprouts, EXTRA basil)
- **PIN-locked Customer Mode** — tablets can't exit customer mode without admin PIN
- **Daily Reports** — revenue, top items, busiest hours, historical charts
- **Backup & Restore** — one-button full database export/import
- **QR Codes** — generate and print QR codes for every table
- **Receipt Printing** — browser print + ESC/POS network thermal printer support
- **WiFi Resilience** — orders queue offline and sync when connection returns

### 🔧 Technical
- **PWA** — installable as an app on any tablet or phone
- **No special hardware** — runs on any device with a browser
- **SQLite database** — zero configuration, file-based
- **WebSocket** — real-time updates across all screens
- **PM2 ready** — auto-restart on crash, process management

## Quick Start

### Requirements
- Node.js 20+
- npm

### Install & Run

```bash
git clone https://github.com/your-repo/world-menu.git
cd world-menu
npm install

# Build the client
cd client && npx vite build && cd ..

# Start the server
cd server && npx tsx src/index.ts
```

Open **http://localhost:3000** — the setup wizard will walk you through configuration.

### Windows
Double-click `start-worldmenu.bat`

### Production (with auto-restart)
```bash
npm install -g pm2
bash start.sh
```

## Architecture

```
world-menu/
├── client/          # React 19 + Vite 6 + Tailwind CSS
│   └── src/
│       ├── pages/
│       │   ├── CustomerMode/   # Customer tablet interface
│       │   ├── ServerMode/     # Server/waiter interface
│       │   ├── KitchenMode/    # Kitchen display system
│       │   └── AdminMode/      # Admin panel
│       ├── stores/             # Zustand state management
│       ├── hooks/              # Shared hooks (useMenu, useSettings, etc.)
│       └── components/         # Shared components
├── server/          # Fastify 5 + SQLite
│   └── src/
│       ├── routes/             # API endpoints
│       ├── db/                 # Database + migrations
│       └── ws/                 # WebSocket handlers
└── start-worldmenu.bat         # Windows launcher
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/menu` | Full menu with variants & allergens |
| `POST /api/orders` | Create new order |
| `GET /api/orders/active` | Active orders for kitchen |
| `GET /api/reports/today` | Today's live stats |
| `GET /api/backup/full` | Download full backup |
| `POST /api/backup/restore` | Restore from backup |
| `POST /api/printer/scan` | Scan network for printers |

## Website Integration

Add online ordering to your existing website with one line:

```html
<script src="https://your-server.com/embed.js" data-url="https://your-server.com" data-mode="button"></script>
```

## Who Is This For?

- **Small family restaurants** that can't afford $200/month POS systems
- **International restaurants** in tourist areas, airports, college towns
- **Immigrant-owned restaurants** where the owner speaks limited English
- **Any restaurant** that wants a modern, tablet-based ordering system for free

## License

MIT — free for everyone, forever.

## Credits

Built with love for the restaurant community. If this helped your restaurant, tell another restaurant owner about it.
