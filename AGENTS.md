# VetCampaignManager — Agent Notes

## Project
Internal tool for veterinary clinic receptionists. Imports an Excel report
exported from VetPraxis, previews recipients + WhatsApp messages, and dispatches
the campaign to an n8n webhook (which sends via Evolution API).

**Current stage:** single-clinic MVP running locally with Docker (n8n +
Evolution API as the send backend). Roadmap targets offering the product as a
multi-tenant SaaS to other veterinary clinics in Peru within 1–3 months.

## Tech stack
- Vite + React 18 + TypeScript (strict)
- Tailwind CSS v4 (CSS-first config via `@theme` in `src/styles/tailwind.css`)
- react-router-dom, zustand, TanStack Table, sonner, lucide-react
- xlsx (SheetJS — vendored tarball in `vendor/`, NOT npm, due to npm vuln)
- react-dropzone, clsx + tailwind-merge, nanoid, zod (env validation)
- Vitest + jsdom (unit tests)

## Lint / typecheck / build / test
Run these after every change. They must stay green:
```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run build       # tsc --noEmit && vite build
npm run dev         # local dev server on http://localhost:5173
```
CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build on every
push and pull request.

## Environment configuration
- `.env.example` documents all `VITE_*` variables. Copy to `.env` for local dev.
- `src/app/env.ts` holds static code-level fallbacks (`APP.productName`,
  `APP.clinicName`, `APP.schema`, `APP.source`).
- `src/app/runtime.ts` validates `import.meta.env` at boot via zod and exports a
  typed `RUNTIME` object. Fail-fast: a missing required var throws with a clear
  message instead of a silent runtime error later.
- Currently optional vars: `VITE_N8N_WEBHOOK_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`. All empty by default (MVP uses
  localStorage + settings-store webhook). These establish the pattern for the
  Supabase migration.

## Architecture conventions (read before editing)
- **UI is in Spanish.** Code, identifiers, file names, and comments in English.
- **Readability over architecture.** No enterprise patterns (DI, repository
  interfaces with multiple impls, use-case classes) unless there's a clear
  long-term benefit. Pure helper functions + zustand stores is the ceiling.
- **`lib/` is pure.** No React, no storage, no network. Excel parse, phone
  normalize, template render, payload builder — all pure & testable.
- **`storage/` is the persistence seam.** Files export async functions
  (`listCategories`, `saveCategory`, …). To migrate to Supabase later, write
  `storage/supabase/*` with the same signatures and swap imports — feature
  code unchanged.
- **Components: single responsibility.** Don't grow a file past ~250 lines.
- **JSDoc is welcome in `lib/` and `storage/`** (public helper signatures).
  No inline noise comments inside function bodies unless requested.
- **IDs**: nanoids everywhere (Supabase-row-compatible), never array indices.
- **Durable data** (categories, templates, settings) → localStorage via
  versioned envelopes in `storage/`. **Session data** (current campaign) is
  in-memory in `campaignStore` only — never persisted.
- **n8n send**: `lib/campaign.ts` builds the payload (pure); `integrations/n8n.ts`
  does the single `POST`. Mock mode when webhook URL unset. No retry — a
  campaign must never be duplicated silently.
- **Phone normalization is Peru-only** for the MVP (`lib/phone.ts` hardcodes
  9-digit mobiles starting with 9, prefix +51). The `countryCode` parameter on
  `normalizePhone` is forward-compatible but validation stays Peru-shaped.
  When expanding to other countries, introduce `lib/phoneRules.ts` per-country
  rulesets without changing the function signature.

## Design tokens (do not deviate without reason)
Defined in `src/styles/tailwind.css` `@theme`. Short version:
- `cream` surfaces, `paper` cards, `ink` text (warm near-black, not pure zinc)
- `vegetal` (deep teal/pine) = primary UI
- `clay` (terracotta) = **action accent only** — reserved for the Send / CTA
- `mist` hairlines/borders
- Single UI grotesk (Inter Tight) + JetBrains Mono for phones/counts
- Radius: `--radius-sm` 8px (inputs/chips), `--radius-md` 10px (cards/modal),
  `--radius-lg` 14px. Tailwind v4 maps `rounded-sm/md/lg` → these tokens.
- Single subtle shadow (`--shadow-card`)

## Library policy
Do not add a dependency without stating the concrete problem it solves.
Current additions beyond the original MVP list:
- **zod** — runtime validation of `import.meta.env` at app boot. Fails fast
  with a clear message when a required env var is missing or malformed,
  preventing silent production errors.

## Folder map (quick ref)
```
src/
  app/         env (static fallbacks), runtime (validated env), providers, routes
  lib/         pure helpers (excel, phone, template, campaign, id, cn)
  storage/     localStorage-backed async functions + keyed JSON envelopes
  integrations/n8n.ts   webhook client
  features/    one folder per feature (home, excel-import, campaign-preview,
               send-campaign, settings) — each lazy-loaded
  shared/      ui/ primitives, layout/ (AppShell, Sidebar, TopBar), hooks/
  styles/      tailwind.css (tokens)
vendor/        vendored xlsx tarball (supply-chain safety)
.github/workflows/   CI pipeline
Dockerfile    multi-stage build → nginx static serve
docker-compose.yml   frontend + (optional) n8n + Evolution orchestration
```

## Deployment
- **Docker** (recommended): `docker build -t vetcampaign .` then `docker run -p 8080:80 vetcampaign`.
  Serves the static build via nginx (SPA fallback configured).
- **Manual**: `npm run build` and serve `dist/` from any static host
  (Vercel, Netlify, nginx, Caddy). Ensure SPA fallback to `index.html`.
- The n8n + Evolution API stack runs separately (the clinic's own Docker
  compose). `docker-compose.yml` at repo root references it optionally for
  local all-in-one development.

## Phase status (MVP features)
- [x] Phase 0 — Foundations (scaffold, tokens, UI kit, shell, placeholder pages)
- [x] Phase 1 — Excel Import (parse → validate → summary screen)
- [x] Phase 2 — Settings: Categories & Templates (+ seed defaults, webhook tab)
- [x] Phase 3 — Campaign Preview & Message Preview
- [x] Phase 4 — Send Campaign & n8n (payload, mock client, dispatch UI)
- [ ] Phase 5 — Polish (empty/error states, keyboard, focus, reduced-motion, mobile)

## Professionalization roadmap (SaaS readiness)
- [x] P0 — Bug fixes: phone.ts casing typo, brand name centralized in `APP`,
      dead `defaultCountryCode` setting wired / honest Peru-only UI, dead
      exports removed (`hasCampaign`, `SCHEMA`).
- [x] P1 — Infra: env validation (zod), GitHub Actions CI, Dockerfile +
      docker-compose, xlsx vendored.
- [ ] P2 — Supabase + Auth + multi-tenancy (the SaaS blocker block).
- [ ] P3 — i18n (message catalog) + phone rules per country (when expanding).
- [ ] P4 — Audit log, send idempotency, HMAC payload signing, error tracking.
- [ ] P5 — UX/a11y polish (focus trap, ARIA tabs/sort, mobile drawer, fonts,
      dark mode, microinteractions).
- [ ] P6 — Testing + cleanup (excel.ts unit tests, component tests, e2e,
      dead UI primitives, split >250-line files, consolidate duplicates).

## VetPraxis Excel format (real, observed)
- Sheet name: `Worksheet` (single)
- Columns: `CLIENTE | MASCOTA | TELÉFONOS | MOTIVO | TIPO DE EVENTO | ESTADO`
- MVP uses:   CLIENTE→owner, MASCOTA→pet (strip trailing `#`), TELÉFONOS→phone, TIPO DE EVENTO→category
- Ignored in MVP: MOTIVO (sub-reason), ESTADO (always PENDIENTE)
- TELÉFONOS can contain several numbers separated by ` - ` with optional
  annotations like `(DUEÑA)` or `(FIJO)`. Algorithm: pick the FIRST valid
  Peru mobile (9 digits, starts with 9), prefix `+51`. Fixed lines (8 digits)
  and other formats are skipped. The `(DUEÑA)` tag is NOT preferred.

## Verification scripts (optional, dev-only)
`scripts/verify-phase*.mts` run ad-hoc assertions against the real sample
Excel and synthetic edge-case workbooks. Run via esbuild:
```bash
node_modules/.bin/esbuild scripts/verify-phase1.mts --bundle --platform=node \
  --format=esm --outfile=node_modules/.cache/verify-phase1.mjs \
  && node node_modules/.cache/verify-phase1.mjs
```
`samples/` holds real `.xlsx` files and is gitignored (may contain PII).
