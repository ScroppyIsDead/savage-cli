import { RouteLink } from "@savage-cli/routing";

interface NotFoundProps {
  fallbackPath?: string;
  fallbackName?: string;
  title?: string;
  message?: string;
  linkLabel?: string;
}

export default function NotFound({
  fallbackPath = "/",
  fallbackName,
  title = "Page not found",
  message = "The route you tried to visit does not exist.",
  linkLabel = "home",
}: NotFoundProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl bg-slate-900/80 p-8 text-center shadow-2xl shadow-slate-900/80">
      <h1 className="text-4xl font-semibold text-slate-50">{title}</h1>
      <p className="text-lg text-slate-300">
        {message}{" "}
        {fallbackName ? (
          <RouteLink
            name={fallbackName}
            className="text-cyan-400 underline hover:text-cyan-300"
          >
            {linkLabel}
          </RouteLink>
        ) : (
          <RouteLink
            toPath={fallbackPath}
            className="text-cyan-400 underline hover:text-cyan-300"
          >
            {linkLabel}
          </RouteLink>
        )}
        .
      </p>
    </div>
  );
}
