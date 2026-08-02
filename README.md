# Venus Lite

[中文文档](./README.zh-CN.md)

AI-powered photography aesthetics evaluation system built on multi-agent adversarial review. Upload a photo, and Venus delivers scores, dimensional analysis, improvement suggestions, and verifiable reasoning through an adversarial pipeline of Proposer → Critic → Arbiter.

## Evaluation Modes

| Mode | Route | Description |
| --- | --- | --- |
| Single Image | `/single` | One photo → EXIF extraction → streaming evaluation → score report → share poster |
| Group Joint | `/group-joint` | Multiple photos as a series → overall score + contact sheet + per-image details |
| Group Compare | `/group-compare` | Multiple photos side-by-side → ranking list + immersive focus comparison |

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 + Nitro Server)
- **Language**: TypeScript (full-stack)
- **Evaluation Engine**: [@theogony/venus-core](https://github.com/changjunhao/venus-core) — multi-agent adversarial evaluation with SSE streaming
- **Styling**: Native CSS Design Tokens (Paper / Darkroom dual theme, no CSS framework)
- **i18n**: @nuxtjs/i18n (zh / en, no_prefix strategy, cookie persistence)
- **Markdown**: markstream-vue (streaming rendering)
- **Image Upload**: Alibaba Cloud OSS direct upload (STS credentials + multipart + SHA-256 dedup)
- **EXIF**: exifreader (client-side extraction)
- **Testing**: Vitest + @nuxt/test-utils + happy-dom
- **Package Manager**: pnpm

## Project Structure

```
app/
├── assets/css/           # tokens.css (Design Tokens) + main.css (base styles)
├── components/
│   ├── ui/               # Base components (BaseButton, BaseCard, BaseModal…)
│   ├── evaluation/       # Evaluation result components (ScorePanel, ProcessTimeline…)
│   ├── business/         # Business orchestration (SingleEvaluationFlow, JointEvaluationFlow…)
│   ├── home/             # Homepage sections (HomeHero, ModeCardGrid…)
│   ├── layout/           # Layout components (SiteNav, ThemeToggle, LocaleToggle…)
│   ├── share/            # Share poster (ShareAction, SharePreviewModal)
│   └── upload/           # Upload interactions (UploadZone, PreviewGrid, ExifTagList…)
├── composables/          # Shared state & side effects
│   ├── useEvaluationStream.ts  # SSE streaming evaluation (single/group shared)
│   ├── useOssUpload.ts         # OSS direct upload (STS + multipart + dedup)
│   ├── useExif.ts              # EXIF metadata extraction
│   ├── useShareImage.ts        # Canvas share poster generation
│   ├── useImageSelection.ts    # Multi-image selection state
│   ├── useEvalMetadata.ts      # Evaluation metadata
│   └── useTheme.ts             # Theme toggle
├── layouts/              # default.vue
├── pages/                # File-based routing (index, single, group-joint, group-compare)
├── utils/                # Evaluation result mapping utilities
├── app.vue               # Root component
└── error.vue             # Error page
server/
├── api/
│   ├── evaluate/         # venus-core evaluation proxy (SSE streaming + sync)
│   ├── oss/              # STS credential issuance
│   ├── notes/            # Notes (architecture demo)
│   ├── health.get.ts     # Health check
│   └── metadata.get.ts   # Engine metadata
├── middleware/            # Request logging
└── utils/
    └── venus-engine.ts   # Venus engine singleton + Nitro adapter
shared/
├── types/                # Shared types between app & server (api.ts, evaluation.ts)
├── utils/                # Isomorphic helpers (format.ts)
└── theme.ts              # Theme initialization script
i18n/locales/             # i18n resources (zh.json, en.json)
tests/nuxt/               # Component & composable unit tests
docs/                     # Design documents (component-plan.md)
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start dev server (http://localhost:3000)
pnpm dev
```

## Environment Variables

Runtime config is overridden via `NUXT_`-prefixed environment variables (Nuxt runtimeConfig convention):

### Base Config

| Variable | Maps to | Visibility |
| --- | --- | --- |
| `NUXT_APP_VERSION` | `runtimeConfig.appVersion` | Server only |
| `NUXT_PUBLIC_SITE_NAME` | `runtimeConfig.public.siteName` | Client |

### OSS / STS (Image Upload)

| Variable | Description |
| --- | --- |
| `NUXT_OSS_REGION` | OSS region (e.g. `oss-cn-beijing`) |
| `NUXT_OSS_BUCKET` | Bucket name |
| `NUXT_OSS_STS_ROLE_ARN` | STS AssumeRole ARN |
| `NUXT_OSS_STS_ACCESS_KEY_ID` | AccessKey ID |
| `NUXT_OSS_STS_ACCESS_KEY_SECRET` | AccessKey Secret |

### Venus Evaluation Engine

Global config (`NUXT_VENUS_*`):

| Variable | Description | Default |
| --- | --- | --- |
| `NUXT_VENUS_PROVIDER_TYPE` | Provider type | `openai-chat` |
| `NUXT_VENUS_PROVIDER_BASE_URL` | API endpoint | — |
| `NUXT_VENUS_PROVIDER_API_KEY` | API key | — |
| `NUXT_VENUS_PROVIDER_MODEL` | Model name | — |
| `NUXT_VENUS_PROVIDER_TIMEOUT` | Timeout (ms) | `60000` |
| `NUXT_VENUS_MAX_RETRIES` | Max retries | `3` |
| `NUXT_VENUS_REASONING_ENABLED` | Enable reasoning | `true` |
| `NUXT_VENUS_REASONING_EFFORT` | Reasoning effort | empty (disabled) |

Supported provider types: `openai-chat` | `openai-responses` | `anthropic` | `gemini`

Each agent (Genre Detector / Proposer / Critic / Arbiter / Revision) can be independently configured via `NUXT_VENUS_<AGENT>_*` variables for provider, model, and reasoning parameters. Falls back to global config when unset.

> When any of `BASE_URL` + `API_KEY` + `MODEL` is missing, `/api/evaluate*` and `/api/metadata` return 503 `VENUS_DISABLED`.

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/metadata` | Engine metadata (model, agent config) |
| POST | `/api/evaluate` | Single image evaluation (sync) |
| POST | `/api/evaluate/stream` | Single image evaluation (SSE streaming) |
| POST | `/api/evaluate/group` | Group evaluation (sync) |
| POST | `/api/evaluate/group/stream` | Group evaluation (SSE streaming) |
| GET | `/api/oss/sts` | Issue OSS STS temporary credentials |

Errors follow a unified `ApiError` shape (`code` + `message`).

## Architecture

### Evaluation Pipeline

```
Upload photo → OSS direct upload → POST /api/evaluate/stream
                                          ↓
                          ┌── Genre Detector (genre classification)
                          ├── Proposer (initial proposal)
                          ├── Critic (adversarial critique)
                          ├── Proposer-Revision (conditional revision)
                          └── Arbiter (final verdict)
                                          ↓
                          SSE event stream → step track + reasoning blocks (real-time)
                                          ↓
                          evaluation_complete → score report
```

### Component Layering

Three-tier unidirectional dependency — no reverse imports:

1. **Base components** (`ui/`): Zero business logic, pure props/emits driven
2. **Domain components** (`evaluation/` / `upload/` / `share/`): Evaluation-domain rendering, consume composable state
3. **Business orchestration** (`business/`): Page-level flow orchestration, compose domain components + composables

### State Management

Nuxt `useState` + composables — no Pinia. All side effects (SSE, OSS, EXIF, Canvas) are encapsulated in composables; components handle rendering and interaction only.

## Development

```bash
# Lint
pnpm lint

# Run tests
pnpm test

# Tests (watch mode)
pnpm test:watch
```

## Production Build

```bash
pnpm build        # Build
pnpm preview      # Preview production build locally
```

In production, inject config via process environment variables (PM2 / `node --env-file`). See [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment) for details.
