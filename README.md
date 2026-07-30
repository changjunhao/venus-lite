# Venus Lite

A lightweight [Nuxt 4](https://nuxt.com) application skeleton, built architecture-first: the directory layout, rendering strategy, state management, styling system, and API conventions are established before feature code is added.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3, Nitro server)
- **Language**: TypeScript
- **Styling**: Native CSS with Design Tokens (no CSS framework) — `app/assets/css/tokens.css` loads before `main.css`
- **State**: Nuxt `useState` wrapped in composables (e.g. `useTheme`)
- **Package manager**: pnpm

## Project Structure

```
app/
├── assets/css/        # tokens.css (Design Tokens) + main.css (base styles)
├── components/
│   ├── layout/        # Layout-level components (ThemeToggle)
│   └── ui/            # Reusable UI primitives (BaseButton)
├── composables/       # useState-based shared state (useTheme)
├── layouts/           # default.vue
├── pages/             # File-based routing
├── app.vue            # Root component
└── error.vue          # Error page
server/
├── api/               # Nitro API routes (health, notes)
├── middleware/        # Server middleware (request logging)
└── utils/             # Server-side helpers (in-memory notes store)
shared/
├── types/             # API type contracts shared by app & server
└── utils/             # Isomorphic helpers
docs/                  # Design & planning documents
```

Types under `shared/types/` are auto-imported on both the app and server sides, and can also be imported explicitly via `#shared/types/api`.

## Setup

Install dependencies:

```bash
pnpm install
```

Copy the environment file (loaded automatically by `nuxt dev`):

```bash
cp .env.example .env
```

### Environment Variables

Runtime config is overridden via `NUXT_`-prefixed variables:

| Variable                | Maps to                          | Visibility  |
| ----------------------- | -------------------------------- | ----------- |
| `NUXT_APP_VERSION`      | `runtimeConfig.appVersion`       | Server only |
| `NUXT_PUBLIC_SITE_NAME` | `runtimeConfig.public.siteName`  | Client      |

In production, inject them as process environment variables (e.g. PM2 or `node --env-file`).

## Development

Start the dev server on `http://localhost:3000`:

```bash
pnpm dev
```

## API Routes

| Method | Path         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| GET    | `/api/health` | Health check (status, version, time)    |
| GET    | `/api/notes`  | List notes (in-memory demo store)       |
| POST   | `/api/notes`  | Create a note                           |

Errors follow a unified shape (`ApiError`: `code` + `message`) returned via `createError({ data })`.

## Rendering Strategy

Route-level rendering rules are defined in `nuxt.config.ts` (`routeRules`). All skeleton pages currently use SSR; add `prerender` / `swr` rules per route as needed.

## Production

Build for production:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

See the [Nuxt deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
