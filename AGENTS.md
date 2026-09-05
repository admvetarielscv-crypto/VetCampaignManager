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

## Git hooks (Husky)
Local quality gates run automatically via Husky 9 — they catch issues before
they reach GitHub, saving CI cycles and preventing accidental bad commits:
- **pre-commit** (`.husky/pre-commit`): runs `lint-staged` (eslint --fix on
  staged `.ts/.tsx` files) + `tsc --noEmit` (full typecheck)
- **commit-msg** (`.husky/commit-msg`): runs `commitlint` with
  `@commitlint/config-conventional` — enforces Conventional Commits format
  (`fix:`, `feat:`, `chore:`, `refactor:`, etc.). Your commit message **must**
  start with a type.
- **pre-push** (`.husky/pre-push`): runs the full test suite (`npm test`) as a
  safety net before code leaves your machine.

Hooks are installed automatically via the `prepare` script in `package.json`
on every `npm install`. Config lives in `.husky/` and `commitlint.config.js`.

## Environment configuration
- `.env.example` documents all `VITE_*` variables. Copy to `.env` for local dev.
- `src/app/env.ts` holds static code-level fallbacks (`APP.productName`,
  `APP.clinicName`, `APP.schema`, `APP.source`).
- `src/app/runtime.ts` validates `import.meta.env` at boot via zod and exports a
  typed `RUNTIME` object. Fail-fast: a missing required var throws with a clear
  message instead of a silent runtime error later.
- Optional vars: `VITE_N8N_WEBHOOK_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`.
- **Backend selection:** when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  are set, `HAS_SUPABASE` is true and the app switches from localStorage to
  Supabase for categories, templates, settings, campaigns, and audit log.
  Without them, the app runs in single-user localStorage mode (MVP).

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
  integrations/   n8n webhook client + Supabase client (optional SaaS mode)
  features/    one folder per feature (auth, home, excel-import,
               campaign-preview, send-campaign, settings, history) — each lazy-loaded
  shared/      ui/ primitives, layout/ (AppShell, Sidebar, TopBar), hooks/, stores/
  styles/      tailwind.css (tokens)
supabase/      SQL migrations + README for SaaS mode (optional, not used by MVP)
vendor/        vendored xlsx tarball (supply-chain safety)
docs/          GUIA-SEDES.md — Spanish deployment guide for multi-site
deploy/        docker-compose.prod.yml + Caddyfile for the VPS backend stack
.github/workflows/   CI pipeline
Dockerfile     multi-stage build → nginx static serve (single-container option)
docker-compose.yml   frontend + (optional) n8n for local all-in-one development
vercel.json    Vercel deployment config (SPA rewrites + asset caching)
```

## Deployment

This project is **frontend-only** — everything ships as a static SPA. The only
runtime dependencies are `n8n` + `Evolution API` for WhatsApp delivery, which
run separately (in Docker).

### Distribution model — single-clinic, multiple branches (sedes)

Current setup uses 3 deployments:

1. **Frontend** (static SPA) → deploy to Vercel/Netlify/Cloudflare Pages.
   - `vercel.json` configures SPA rewrites + asset caching.
   - Each `git push` to the default branch triggers an auto-deploy.
2. **Backend stack** (n8n + Evolution API + Postgres + Caddy) → one VPS per
   clinic (or shared VPS for multi-tenant SaaS in the future).
   - `deploy/docker-compose.prod.yml` runs the full stack in Docker.
   - `deploy/Caddyfile` provides automatic HTTPS via Let's Encrypt (works
     with real domains or free sslip.io subdomains).
3. **Recepcionistas** (end users) → open the frontend link in any modern
   browser, paste their webhook URL in Settings, start sending campaigns.

See `docs/GUIA-SEDES.md` for the full step-by-step (in Spanish) covering
VPS purchase, Evolution instance creation per sede, n8n workflow setup,
Vercel deploy, and per-receptionist onboarding.

### Alternative deployments (not recommended for 3-sede distribution)

- **Single Docker container** (`docker build -t vetcampaign .`): useful for
  self-hosting in a LAN, but doesn't work for distributed multi-site
  access — the frontend would only be reachable inside the LAN.
- **Static-only** (`npm run build` → `dist/`): serve from any static
  host with SPA fallback to `index.html`.

## Phase status (MVP features)
- [x] Phase 0 — Foundations (scaffold, tokens, UI kit, shell, placeholder pages)
- [x] Phase 1 — Excel Import (parse → validate → summary screen)
- [x] Phase 2 — Settings: Categories & Templates (+ seed defaults, webhook tab)
- [x] Phase 3 — Campaign Preview & Message Preview
- [x] Phase 4 — Send Campaign & n8n (payload, mock client, dispatch UI)
- [x] Phase 5 — Distribution: VPS backend stack (n8n + Evolution + Caddy),
      `vercel.json`, `docs/GUIA-SEDES.md` for multi-sede rollout.
- [ ] Phase 6 — Polish (empty/error states, keyboard, focus, reduced-motion, mobile)

## Professionalization roadmap (SaaS readiness)
- [x] P0 — Bug fixes: phone.ts casing typo, brand name centralized in `APP`,
      dead `defaultCountryCode` setting wired / honest Peru-only UI, dead
      exports removed (`hasCampaign`, `SCHEMA`).
- [x] P1 — Infra: env validation (zod), GitHub Actions CI, Dockerfile +
      docker-compose, xlsx vendored, Husky hooks (pre-commit + commit-msg +
      pre-push), all majors upgraded (React 19, Vite 8, router 7, table 9,
      ESLint 10, types/react-19).
- [x] P2 — Supabase + Auth + multi-tenancy (the SaaS blocker block): full
      schema with RLS (tenants, tenant_members, categories, message_templates,
      clinic_settings, campaigns, audit_log), Supabase Auth + Login page +
      RequireAuth route guard, tenant store, storage seam with Supabase
      backend, audit log writes, History UI.
- [x] P3 — Multi-sede deployment (active, MVP-only config): VPS backend stack
      (deploy/docker-compose.prod.yml + Caddyfile), Vercel config (vercel.json),
      full Spanish deployment guide (docs/GUIA-SEDES.md). Supabase stays as
      optional future activation when external clinics join.
- [ ] P4 — i18n (message catalog) + phone rules per country (when expanding).
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
