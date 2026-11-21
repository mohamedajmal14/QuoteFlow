# QuoteFlow architecture

## Runtime view

```text
Browser
  React + TypeScript dashboard
          |
          | /api and /health
          v
Nginx reverse proxy
          |
          v
Express API -> Zod request validation -> QuoteStore contract -> PostgreSQL
                                                |
                                                `-> Memory adapter (unit tests)
```

The repository also publishes a deliberately separate static portfolio runtime:

```text
Browser -> React dashboard -> Demo API adapter -> localStorage
                         (fictional sample data only)
```

`VITE_DEMO_MODE=true` selects this adapter at build time. The interface labels that runtime as an interactive browser demo and explains that no production backend is connected.

## Boundaries

### Web client

`apps/web` owns presentation and user interaction. In the full-stack runtime it does not calculate pipeline truth; the API returns validated quote state and analytics. Development uses the Vite proxy, while the container runtime uses Nginx to retain the same relative URLs.

The static demo swaps the remote HTTP adapter for `demo-api.ts`. That adapter reproduces the UI-facing quote operations and analytics locally, persists only in browser storage and exposes a reset operation. It is intentionally not reused by the Express application and does not represent durable or multi-user storage.

### HTTP API

The routes translate HTTP input into typed domain commands. They validate write payloads with Zod, await the injected store and return a consistent JSON contract:

- Collections: `{ data, meta }`
- Details and mutations: `{ data }`
- Validation errors: HTTP `422` with `{ error, details }`
- Missing records: HTTP `404` with `{ error }`
- Unexpected errors: HTTP `500` without internal details

### Store contract

`QuoteStore` is the boundary between application behavior and persistence. Both `MemoryQuoteStore` and `PostgresQuoteStore` implement list, detail, mutations, follow-ups, analytics, leads and health checking. Routes therefore remain unchanged when tests inject deterministic memory state.

### PostgreSQL adapter

`PostgresQuoteStore` uses a bounded connection pool and parameterized SQL. Important write paths are transactional:

- Quote numbers use a database sequence, avoiding duplicate numbers under concurrent creation.
- Updates lock the quote row before calculating stage probability and health.
- Adding a follow-up inserts the activity and updates the quote's next action atomically.
- Deleting a quote cascades its follow-ups through the foreign key.

Database constraints protect stage, probability, currency, amount, health and follow-up type even if a future caller bypasses HTTP validation. Indexes support stage, owner, recent activity and incomplete follow-up queries.

Analytics and lead summaries currently reuse the shared domain calculations after loading the workspace. That keeps the two adapters behaviorally identical and is appropriate for a small-team pipeline. At larger volumes these aggregates can move to SQL views without changing the HTTP contract.

## Schema lifecycle

SQL migrations are stored in `apps/api/db/migrations`. The migration runner:

1. Ensures the `schema_migrations` ledger exists.
2. Sorts migration filenames deterministically.
3. Skips versions already recorded.
4. Applies each new version and records it in one transaction.

The seed command uses stable identifiers and conflict-safe inserts. It can run on every container start without duplicating demo records.

## Runtime selection

- With `DATABASE_URL`, the server constructs `PostgresQuoteStore`.
- Without it, the server uses `MemoryQuoteStore` for a zero-dependency preview.
- `/health` checks the active adapter and reports `postgresql` or `in-memory-demo`.

This behavior is observable and documented; deployments do not report durable storage unless the database is actually reachable.

## Test strategy

### Frontend component and adapter tests

Six Vitest and React Testing Library scenarios cover initial loading, search, quote creation, demo restoration, pipeline analytics and browser-storage persistence. The API module is mocked in component tests, while the demo adapter is exercised directly with an isolated storage implementation.

### Browser journey

Playwright starts the application with `VITE_DEMO_MODE=true` and Chromium. It creates a quote through the real form, reloads the page to verify browser persistence, restores the sample workspace and confirms the new quote disappears.

### API contract tests

Five fast tests inject a new memory store for every case. They cover health metadata, filters, creation, analytics, validation, stage transitions and follow-ups.

### PostgreSQL integration test

CI starts PostgreSQL 16, applies the same migration and seed commands used by the application, then runs a persistence test that:

1. Creates a quote through HTTP.
2. Adds a related follow-up.
3. Builds a second API instance over the same pool.
4. Reloads the quote and checks its analytics.

This verifies the repository rather than merely checking that configuration files exist.

The verification workflow runs lint, both builds, frontend tests, API contract tests, the Playwright journey and the PostgreSQL integration test. The Pages workflow independently builds the static demo and uploads only `apps/web/dist`.

## Deliberate scope

The repository does not include fake credentials or hard-coded authorization. A public multi-user deployment should add OIDC/OAuth authentication, organization-scoped queries, role checks, rate limiting and an immutable audit log. The current boundary makes that next step explicit: identity context belongs in the HTTP/service layer and organization identifiers belong in the database keys and indexes.
