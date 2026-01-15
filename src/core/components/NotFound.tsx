import { useSelector } from "react-redux";
import type { RootState } from "../../../features/store";
import { Link } from "react-router-dom";

export default function NotFound() {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4 pb-12 pt-16">
      <div className="relative w-full max-w-4xl space-y-10 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#020617] p-10 shadow-[0_20px_120px_rgba(15,23,42,0.8)]">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.4em] text-blue-300">
          <span className="rounded-full border border-blue-400/60 px-3 py-1 text-xs font-semibold text-blue-300">
            404
          </span>
          Not Found
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            Nothing here but mistyped endpoints.
          </h1>
          <p className="max-w-2xl text-base text-slate-300">
            The router couldn't locate a matching route. Maybe the feature
            hasn't shipped yet, or the URL is a typo. You can swing back to the
            dashboard or revisit another workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/5 p-6 font-mono text-sm text-slate-300 shadow-inner shadow-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Debug snapshot
          </p>
          <div className="mt-2 space-y-1">
            <p>&gt; routeStatus = "idle"</p>
            <p>&gt; activeUser = {user ? `"${user.username}"` : "null"}</p>
            <p>&gt; visitedPaths = ["/", "/projects", "/api/docs"]</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            to={user ? "/dashboard" : "/"}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-blue-400/50 bg-blue-500/90 px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500"
          >
            Go to dashboard
          </Link>
          <Link
            to="/support"
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-700/80 px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-500/80 hover:text-white"
          >
            Open support docs
          </Link>
        </div>
      </div>
    </div>
  );
}
