# Feature Template

This Tailwind-focused starter is the template shipped with the CLI. It shows the directories and files created when you run `savage generate <featureName>` and illustrates the current org conventions (feature-scoped Redux, API helpers, and contract exports).

## Once Done

Please remember to change this readme.md file into whatever it is your feature does, the public exports, how to use certain features etc.

## Structure

- `feature.config`: update metadata, versions, owners, public exports, hooks, policies, and routes so the feature registers correctly with the registry and CLI checks.
- `routes.tsx`: keep the `routePrefix` (or `false` for no prefix) and describe every route through `defineFeatureRoutes`. Each definition should specify `path`, `name`, optional `lazyImport`, and any `policies`. Absolute paths (`/foo`) escape the prefix, otherwise the helper mounts them under the prefix automatically.
  - Prefer referencing routes by name inside pages/navigation (use `RouteLink`, `useRouteByName`, or `resolveRoutePath` from `@savage-cli/routing`) so route renames stay synchronized. `FeatureRuntimeWrapper` also looks at the `handle.prefetch` array on each definition, which you can use to warm up related pages during idle time (e.g., the auth login route prefetches register + dashboard modules) without leaking implementation details.
- `api/`: place every HTTP helper here (e.g., `authApi.ts`, `googleAuthApi.ts`). Re-use `@savage-cli/core` utilities like `apiWrapperForRefreshToken` so features don't duplicate Axios logic.
- `redux/` (or similar): host slices, thunks, selectors, and tests. Aim to keep Redux logic confined to this folder so the feature owns its own slice, just like `features/auth` exposes `authSlice.ts`/`authThunks.ts` and keeps `AppDispatch`/`RootState` wired through `src/features/store.ts`.
- `pages/`: define route UI components, import the thunks/selectors from your `state` folder, and dispatch actions from there. Keep forms, validation, and side effects inside the page, but reuse `state` exports for the business logic.
- `public/`: re-export selectors, thunks, or other APIs you want shared. Use `feature.config` to expose only what other features should see; the CLI verifies these contracts.
- `hooks/`: implement `init`, `cleanup`, and any guard helpers that run when the feature mounts. Reference them in `feature.config.public.hooks`.
- `components/` (optional): keep shared pieces that belong only to this feature.
- `tests/`: co-locate feature-specific tests if needed; the CLI picks them up from the feature folder.

## Behavior

- Shared utilities (`apiWrapper`, `appConfig`, routing helpers) live in `src/core/*` and are exported through `@savage-cli/core`, so feature code can marshal requests and instrumentation without rewriting plumbing.
- Central Redux lives in `src/features/store.ts`, which imports reducers from each feature so `AppDispatch` and `RootState` are globally available.
- Features should gate API calls and state updates through public thunks/selectors (e.g., `loginThunk`, `selectIsAuthenticated`), even if only local pages consume them now; the contract stays stable and lets other features import them later without tight coupling.

## Templates & tooling

- When the CLI builds the global route map, it reads `feature.config` plus the `routes.tsx` file and injects every feature under `/features/<prefix>`.
- Run `npm run savage -- check`, `test`, and `list-routes` to verify contracts, route uniqueness, and application behavior before committing.
