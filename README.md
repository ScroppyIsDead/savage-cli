# Savage CLI

Savage is a feature-first React framework inspired by Django’s file-backed conventions. It keeps every feature isolated, discoverable, and explicit about what it shares so distributed teams can ship big apps without entangling ownership, middleware, routing, or observability.

## Overview

- **Feature-first directories**: Place UI, hooks, routes, public exports, tests, and metadata inside `features/<featureName>` so everything the feature owns is in one place.
- **Contract-first sharing**: Each feature publishes a `feature.config` containing versioned public exports, lifecycle hooks, policies, routes, and dependencies. Imports across features are validated against those contracts.
- **File-driven routing**: A single `featureRegistry` aggregates every feature’s `routes.tsx`, wraps each route with `FeatureRuntimeWrapper`, and produces a React Router tree augmented with policy metadata so there are no implicit routes.
- **CLI automation**: `tooling/savage` contains the CLI entrypoint plus scaffolding helpers that let you generate apps, features, run diagnostics, and verify contracts from the terminal.
- **Observability hooks**: Routes still capture policy metadata so you can hook your own logging or instrumentation around `FeatureRuntimeWrapper`, but the framework does not ship with a default telemetry pipeline.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Layout](#project-layout)
3. [Feature Contracts](#feature-contracts)
4. [Routing](#routing)
5. [Templates & Scaffolding](#templates--scaffolding)
6. [CLI Reference](#cli-reference)
7. [Observability](#observability)
8. [Diagnostics & Testing](#diagnostics--testing)
9. [Contributing](#contributing)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Generate a feature (optionally picking a template):

```bash
npm run savage -- generate payments --template=tailwind
```

3. Start the Vite dev server:

```bash
npm run dev
```

4. Navigate the app via the routes declared inside `features/`; wrap `FeatureRuntimeWrapper` yourself if you want to emit lifecycle or telemetry-related console output.

## Project Layout

- `features/`: Each folder contains:
  - `feature.config`: metadata for exports, dependencies, policies, hooks, and routes.
- `routes.tsx`: The feature-specific router. Export a `routePrefix` string plus your `RouteObject[]`; the registry mounts that array under the prefix (a Django-like namespace) while still letting you declare relative child paths.
  - `public/`: Re-exported APIs other features can consume.
  - `tests/`: Feature-local test suite (picked up by `savage test`).
- `src/core/routing`: Runtime helpers that build the route map, wrap routes with lifecycle/policy guards, and provide providers for instrumentation/middleware.
- `src/routes/featureRoutes.tsx`: The central route map that loads dynamic feature routes, handles redirects, and renders the custom 404 page.
- `src/core/routing/routeHelpers.ts`: Provides `defineFeatureRoutes(featureName, definitions)` so a feature file only lists each path/lazy import, and the helper wires names, handles, and metadata defaults automatically. Declare absolute child paths (like `/info`) when you need to escape the feature prefix instead of managing a separate override map.
- `tooling/savage/`: CLI scripts for generating apps/features, running diagnostics, and keeping templates/defaults in sync.
- `.cache/savage`: Stores defaults and contract snapshots.

## Feature Contracts

Every `feature.config` includes:

- `name`, `version`, `description`, `owners`.
- `dependencies`: list of features + version range.
- `public.exports`: shareable exports (components, hooks, utilities).
- `public.hooks`: `init`, `cleanup`, guard hooks invoked by `FeatureRuntimeWrapper`.
- `routes`: optional overrides for `path`, `layout`, `policies`, `guards`.
- `policies`: runtime hints (`auth`, `cache`, `chunkHint`, `rateLimit`).

The CLI enforces these contracts:

- `savage check` simply ensures the requested feature configs exist before delegating export/import contract enforcement to the ESLint plugins (`npm run lint`).
- `savage info` prints owners, dependencies, exports, routes, policies, and warns when contracts change.
- `savage graph` renders dependency/reverse maps for architecture reviews.

## Routing

- `featureRegistry` imports every `feature.config` + `routes.tsx`, wraps their routes with `FeatureRuntimeWrapper`, and groups them by prefix. Routes should be declared through `defineFeatureRoutes(featureName, definitions)` (see `src/core/routing/routeHelpers.ts`), so you describe the path name, `lazyImport`, and optional policies once and the helper wires handles plus the associated metadata defaults.
- Each feature's `routes.tsx` exports a `routePrefix` string; the registry mounts the wrapped routes under that namespace (e.g., `routePrefix: "notification"` → `/notification/*`). Define absolute child paths (`path: "/info"`) to escape the prefix, or set `routePrefix: false` if the feature owns its entire set of paths.
- The system auto-inserts a NotFound index route for any prefix that lacks an explicit index or empty path so visiting `/demo/` without a defined landing still renders the 404 view instead of a blank page. The same `NotFound` component is the global `*` fallback inside `src/routes/featureRoutes.tsx`.
- Lazy loading is opt-out by default via `handle.lazyImport`. The default template sets `lazyImport: "./pages/{{featureName}}Page.tsx"`, so `featureRegistry` wraps that path with `React.lazy`/`Suspense`. You can opt out by setting `handle.skipLazy = true` or provide a static `element`.
- Use `RouteLink`, `useRouteByName`, or `resolveRoutePath` (all exported through `@savage-cli/routing`) whenever navigation should reference the canonical route name; they all hit the registry's `routeNameMap` so the names stay correct even when the underlying `path` changes.
- To inspect every route ahead of time, run `npm run list-routes`; it prints the name/path table and fails when any duplicate path or route name exists so you can fix the conflict before the app runs.
- `route-paths/no-duplicate-route-paths` reuses the same analysis during `npm run lint`, so the lint run fails if two routes resolve to the same path or if two features publish the same name.

## Templates & Scaffolding

- Place feature templates under `templates/feature/<name>`; `savage generate` copies them verbatim.
- The shipped template (`templates/feature/default`) is styled with Tailwind classes and includes README guidance so contributors can align with the layout. Drop additional folders under `templates/feature` to teach the CLI new stacks, then reference them via `--template=<name>` or `savage set-default-template feature <name>`.
- Feature templates now import `defineFeatureRoutes` from `src/core/routing/routeHelpers.ts`, so a generated `routes.tsx` simply calls `defineFeatureRoutes(featureName, [{ path: "", lazyImport: "./pages/<featureName>Page.tsx" }])` and leaves the boilerplate to the helper.

## CLI Reference

All CLI commands live under the `savage` script (`tooling/savage/savage.mjs`). They rely on `js-yaml` for parsing `feature.config` and `semver` for contract bumps.

- `npm run savage -- generate <featureName> [--template=<name>]`: scaffolds a new feature from `templates/feature/<name>` with `{{featureName}}` substitution.
- `npm run savage -- info [<feature>] [--graph]`: prints feature contracts; `--graph` reuses `printDependencyGraph`.
- `npm run savage -- graph`: standalone dependency graph for the entire feature tree.
- `npm run savage -- test [<feature>]`: executes `vitest run --runInBand` for each feature plus its declared dependencies.
- `npm run savage -- check [--auto-bump] [--auto-describe]`: enforces public exports, optionally auto-populates them, snapshots contracts, and verifies imports.
- `npm run savage -- set-default-template feature <name>`: updates `.cache/savage/defaults.json` to point future generators at your favorite template.

## Observability

- The runtime no longer ships with a built-in telemetry guard; wrap your own logging, metrics, or tracing helpers around `FeatureRuntimeWrapper` when you need to capture feature lifecycle data.
- `FeatureRuntimeWrapper` still propagates the `policies` metadata declared in `feature.config`, so components can read hints such as `auth` or `cache` to keep middleware consistent.
- Export/import contracts are enforced via the ESLint rule `route-paths/no-cross-feature-imports` (run `npm run lint`). `npm run savage -- check` now just verifies that the requested feature configs exist before you run the lint rules.

## Diagnostics & Testing

- `savage check` enforces public exports, snapshots contract files under `.cache/savage/contracts`, and blocks private imports.
- `savage test` boots each feature plus dependencies, locates `tests/` folders, and runs them via `vitest run --runInBand`.
- `savage info` and `graph` provide insights into owners, exports, routes, policies, dependency maps, and version diffs, so you can onboard contributors quickly.
- `npm run list-routes` iterates the route registry, prints every feature path/name pair, and exits with an error message when duplicates are detected so you can fix conflicts before deployment.
- `npm run lint` includes `route-paths/no-duplicate-route-paths`, which reuses the same route inspection logic and fails the lint run if two routes resolve to the same absolute path (and now also duplicate route names) so you can fix conflicts before the app even starts.

## Contributing

1. Fork the repo, create a feature branch, and follow the feature folder conventions.
2. Run `npm run savage -- info`, `npm run savage -- check`, `npm run savage -- test`, and `npm run savage -- graph` before submitting.
3. Add documentation to `README.md` or `PLAN_README.md` whenever you add new commands, templates, or runtime helpers.
4. Submit the PR with a description of what changed, why, and any necessary version bumps for public contracts.

## Why Savage?

This framework helps teams ship large React applications with isolated features, explicit contracts, and runtime helpers for routing, instrumentation, testing, and dependency management. Let me know if you’d like a CLI spec or template walkthrough next.
