# Tracko (WorkTrack)

Multi-tenant SaaS platform for workforce management — time tracking, DTR, live location, leave scheduling, payroll, and employee records. Built for small to mid-sized companies in the Philippines.

**Repository:** https://github.com/zkript-apps/tracko

## Stack

| Layer | Technology |
| --- | --- |
| Web Admin | Next.js 16, React 19, Tailwind CSS |
| API | NestJS 11 |
| Database | MongoDB |
| Auth | [Better Auth](https://www.better-auth.com/) with organization plugin (multi-tenant) |

## Monorepo structure

```
tracko/
├── apps/
│   ├── api/          # NestJS backend + Better Auth
│   └── web/          # Next.js admin panel
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local MongoDB)

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/zkript-apps/tracko.git
cd tracko
npm install
```

### 2. Environment

Copy the example env file and update secrets:

```bash
cp .env.example .env
```

Generate a secure `AUTH_SECRET` (32+ characters). The defaults work with the included Docker MongoDB setup.

### 3. Start MongoDB

```bash
docker compose up -d
```

### 4. Run development servers

From the repo root:

```bash
npm run dev
```

Or run individually:

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

### 5. Try it out

1. Open http://localhost:3000
2. Click **Get started** to create an admin account
3. Sign in and open the dashboard

Auth endpoints live at `http://localhost:3001/api/auth/*`.

## Product roadmap

- **Mobile app** — employee clock in/out, leave requests, shift reminders
- **Web admin** — live location, DTR reports, payroll, employee records
- **Multi-tenancy** — each company is a Better Auth organization with isolated data
- **Subscription tiers** — Small (≤20), Medium (21–100), Enterprise (100+)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + web via Turborepo |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |

## License

Private — zkript-apps
