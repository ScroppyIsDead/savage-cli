# Feature Configuration

Every Feature-Org feature exports a `feature.config` (YAML/JSON) alongside its folder. This file is the single source of truth for contracts, routing, policies, lifecycle hooks, and versioning. Tooling (CLI, routing registry, tests, linters) reads it to enforce boundaries and generate wiring code.

## Top-level fields

- `name` *(optional)*: a readable identifier (defaults to the folder name).  
- `version` *(required)*: semantic version of the public contract. Bump this whenever `public` or `hooks` change in a breaking way.
- `description` *(optional)*: short summary for discovery dashboards.
- `owners` *(optional)*: contact/teams for the feature (emails, Slack channels, etc.).
- `dependencies` *(optional)*: other features this one consumes, e.g. `[{ feature: "auth", version: "^2.0.0" }]`.
- `metadata` *(optional)*: tags, release channels, feature flags, etc.

## Public contract

Defining the public surface keeps imports predictable.

```yaml
public:
  exports:
    - name: PromptLogin
      type: component
      path: ./public/PromptLogin.tsx
    - name: userState
      type: state
      path: ./public/user.ts
      shape: [id, email, fullname]
  hooks:
    init: ./hooks/setup.ts
    cleanup: ./hooks/teardown.ts
    guards:
      onRouteEnter: ./guards/authGuard.ts
      onRouteLeave: ./guards/flushCache.ts
```

- `exports`: list of shareable modules/components/hooks/states. The CLI enforces that other features only import these.
- `hooks`: lifecycle callbacks loaded when the feature activates; declared guards can be wired into routing automatically.

## Routes

Routes live near their features but are declared here for synthesis.

```yaml
routes:
  - name: support.help
    path: /support
    component: ./pages/Help.tsx
    layout: shared/Layout.tsx
    lazy: true
    guards: [auth, telemetry]
    policies:
      auth: strong
  - name: support.contact
    path: /support/contact
    component: ./pages/Contact.tsx
```

- Each route can override `path`, `name`, layout/component paths, lazy-loading hints, guard names, and nested policies. When omitted, defaults are derived from folder names, so `features/support/pages/Help.tsx` would default to `/support/help`.
- The routing registry merges every route into a React Router v6 structure, adds middleware/policies, and exports helpers like `<FeatureRoute name="..." />`.
- Run `npm run list-routes` to see every feature route name/path pair plus any duplicate warnings, and rely on the `route-paths/no-duplicate-route-paths` ESLint rule to block duplicates during `npm run lint`.

## Policies

```
policies:
  auth: strong          # guard wrappers (strong, optional, public-only, etc.)
  cache: no-store       # service worker or header hints
  chunkHint: feature    # bundler chunking preference (feature | shared | inline)
  telemetryContext: auth#login
  rateLimit: soft       # optional descriptor passed to observability/logging
```

- Policies stay next to the feature so tooling can inject guards, headers, and telemetry tags automatically.
- Treat those values as lightweight middleware hints: `auth: strong` can drive guard logic, `cache: no-store` can flip headers, and `telemetryContext` tags what gets emitted to your observability stack. Attach per-route `policies` through `defineFeatureRoutes` when you need overrides, and guards/`useFeatureTelemetry()` will still see the current values.
- Define absolute paths (e.g. `path: "/info"`) directly in your routes to escape the feature prefix; the registry handles them without a shared overrides file.

## Versions & checks

- When `public.exports` or hooks change, run `savage version <feature> --level=[patch|minor|major]` or let the CLI infer the bump from contract diffs.
- `savage info <feature>` compares the current exports against the last published contract and warns if breaking changes occurred.
- Downstream features declare expected versions in their `dependencies`; the CLI adds warnings when those versions no longer match.

## CLI helpers

- `savage generate <name>` scaffolds a folder with `feature.config`, `routes.tsx` (exporting `routePrefix` plus the DSL-friendly `defineFeatureRoutes` call), `pages/`, `public/`, and the standard helpers.
- `savage info <name>` prints the contract, owners, routes, policies, and version history.
- `savage test <name>` loads only the feature plus its declared dependencies, mocking private internals and validating the contract before tests run.
