import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-slate-200">
      <p className="text-xs uppercase tracking-[0.5em] text-slate-500">404</p>
      <h1 className="text-4xl font-semibold text-white">Page not found</h1>
      <p className="max-w-sm text-center text-sm text-slate-400">
        Looks like the route you requested does not exist yet. Check the URL or
        head back to the dashboard to keep hacking.
      </p>
      <Link
        to="/"
        className="rounded-xl border border-slate-800 px-5 py-3 text-xs uppercase tracking-[0.5em] text-white transition hover:bg-slate-800"
      >
        Go home
      </Link>
    </div>
  );
}
