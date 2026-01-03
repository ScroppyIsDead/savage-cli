# Feature Template

This Tailwind-focused starter is the template shipped with the CLI. It shows the directories and files created when you run `savage generate <name>`.

## Customize

- `feature.config`: Update the `name`, `version`, `description`, `owners`, `public`, `routes`, `policies`, and `routePrefix` sections so the runtime can mount your feature at the desired URL.
- `routes.tsx`: Export a `routePrefix` string plus a React Router v6 `RouteObject[]`. The registry wraps the array inside a parent route using `routePrefix`, so define children relative to that segment. Use the `RouteLink` helper (from `src/core/routing/RouteLink.tsx`) when you prefer linking by route name instead of path.
- `pages/`: Drop in your UI components.
- `public/`: Re-export only what you want other features to import.
- `hooks/`: Implement `init`/`cleanup` or other lifecycle helpers. Connect them via `feature.config`.
- To add a new template variant, create another folder under `templates/feature/<your-template>`, mirror the structure, and invoke it via `savage generate --template=<your-template>` or `savage set-default-template feature <your-template>`.

When the CLI builds the global route map, it reads this config plus any route files so the app knows which paths belong to your feature.
