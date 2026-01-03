Goals for Feature-Org README and overall framework:

1. Capture the vision of a Django-inspired, feature-first file management system for React apps.
2. Highlight the core concepts: insulated feature folders, explicit public contracts, and folder-driven routing with strict boundaries.
3. Document foundational tooling: CLI scaffolds, public declaration files, routing/lazy-loading helpers, middleware guard wiring, and diagnostics.
4. Outline target use cases emphasizing scalability, ownership, and React/Django parallels.
5. Keep README language concise, actionable, and ready for prototyping or tooling discussions.
6. Ensure feature discovery/onboarding helpers surface every feature’s public API, dependencies, owners, routes, policies, and versions.
7. Describe lifecycle hooks (init/cleanup/guards) and show how bootstrap/routing wires them automatically.
8. Explain config-driven policies (auth guards, cache hints, chunk preferences, telemetry context) so runtime expectations stay near each feature.
9. Showcase feature-aware testing that boots just the feature plus its declared dependencies for fast isolation.
10. Outline observability integrations that tag telemetry with feature names/routes so ownership stays visible.
11. Illustrate versioned contracts; changes bump versions and notify dependent features before release.
12. Plan React Router v6 routing that respects feature folders, allows custom route names, and generates a global route map with metadata.
13. Capture how defaults, guard wrappers, and targetable helpers form enforced boundary routing, and explain how absolute paths escape each feature prefix without an external override map.

Planning notes:

- **Feature discovery helpers**: Build CLI/dashboard commands (`savage info <feature>`, `savage graph`) that parse every `feature.config`, emit public exports, owners, routes, policies, versions, and dependency graphs for onboarding and audits.
- **Diagnostics output**: Ensure `savage info` reports owners, dependencies, and versions plus an optional `--graph` that prints dependency/consumer maps for architectural oversight.
- **CLI workflow**: Implement `npm run savage -- generate/info/test` (using `js-yaml` to read configs) so contributors can scaffold features, inspect contracts, and run targeted tests through the same tooling bundle.
- **Contract enforcement**: Add `savage check [--auto-bump] [--auto-describe]` so the CLI verifies imports only use declared public exports, warns about contract drift, optionally bumps patch versions, and can refresh `public.exports`.
- **Public export descriptions**: Automate filling `feature.config`’s `public.exports` metadata (name/type/shape) so feature authors don’t have to manually keep it in sync, reducing human error and version friction.
- **Routing strategy (React Router v6)**: Each feature owns a `routes.tsx` that exports both a `routePrefix` string and a `RouteObject[]`; routes stay relative to that prefix (or opt out) while the registry wraps them with middleware/policies, supports lazy loading, and exposes helpers like `<FeatureRoute name="support.index" />`. Define absolute paths directly (`path: "/info"`) when a route should escape the feature prefix, eliminating the need for a separate overrides file.
- **Route/contract generator**: Build a registry that reads every `feature.config`, loads its `routes.tsx`, and wraps elements with lifecycle hooks/policies (FeatureRuntimeWrapper) so the React Router map is derived directly from metadata.
- **Absolute path routing**: Document how escaping prefix routes via absolute `path` values keeps control inside each feature and removes the need for an app-level remapping file.
- **Template customization**: Allow users to register their own feature templates (Tailwind-ready, minimalist, etc.) by adding folders under `templates/feature`. Document how to drop in alternative `styles.css`, layouts, or scaffolding, and how to invoke them via `--template=<name>` or `savage set-default-template feature <name>`.
- **Default template config**: Store the preferred `featureTemplate` in `.cache/savage/defaults.json` and expose `savage set-default-template feature <name>` so `savage generate` can persist your chosen starter.
- **Tailwind templates**: Ship the Tailwind-flavored `templates/feature/default` starter so Tailwind projects boot quickly, and describe how to add variants by adding new folders under `templates/feature`.
- **Lifecycle hooks**: Declare `init`, `cleanup`, and route guards in `feature.config`; wiring these through bootstrap and React Router ensures middleware runs when features load and resources clean up when they unload.
- **Config-driven policies**: Keep `auth`, `cache`, `chunkHint`, and `telemetryContext` adjacent to each feature. Build/dev tooling should honor those hints by injecting guards, headers, chunk boundaries, and telemetry tags automatically.
- **Feature-aware testing**: Testing harness reads declared dependencies from `feature.config`, loads only the necessary providers/modules, and verifies contracts before tests run. `savage test <feature>` mocks private internals, keeping tests focused and fast.
- **Contract-aware testing**: `savage test <feature>` also gathers dependency-aware `tests/` folders and runs `vitest run --runInBand` only for the relevant feature surface, keeping test suites fast and scoped to the declared contracts.
- **Observability wrappers**: Provide helpers that annotate logs/metrics/traces with the current feature name, route, and version so dashboards can filter by owner and track runtime impact per feature (see `TelemetryGuard`, `useFeatureTelemetry`, and `TelemetryLoggerProvider`).
- **Versioned contracts**: `public` declarations include `version`; CLI/CI compares the previous contract with the current exports, prompts for a semantic bump (or auto increments) when breaking changes occur, and warns dependent features whose expected version no longer matches.
- **Public contract enforcement**: Lint/build rules only allow importing a feature’s `public` exports; CLI checks (like `savage info`) fail when private internals leak or declared exports diverge, ensuring the workflow stays enforced.
- **Hidden tooling/cache**: Move automation into `tooling/savage/` and cache snapshots under `.cache/savage/contracts` so the repository’s working tree stays focused on `src/` and `features/` without extra noise.
- **Open source considerations**: Document that Feature-Org is open source, free to take/use/modify, and welcome to contributions. Encourage contributors to respect contracts, add tests, and keep documentation aligned.
- **Feature configuration doc**: Keep `FEATURE_CONFIG.md` synced with README/plan so contributors always know the exact schema, examples, and CLI commands that govern contracts, policies, and routes.
