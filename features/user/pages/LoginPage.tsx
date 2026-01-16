import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearUserName,
  getStoredUserName,
  saveUserName,
} from "../public";

export default function LoginPage() {
  const [input, setInput] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const canSave = useMemo(() => input.trim().length > 0, [input]);

  useEffect(() => {
    const stored = getStoredUserName();
    setSavedName(stored);
    if (stored) {
      setInput(stored);
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      clearUserName();
      setSavedName(null);
      return;
    }
    saveUserName(trimmed);
    setSavedName(trimmed);
  }

  function handleReset() {
    clearUserName();
    setInput("");
    setSavedName(null);
  }

  return (
    <section className="min-h-screen bg-slate-950 text-slate-100 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/60 p-10 shadow-2xl shadow-slate-900/50">
        <header className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
            Identity
          </p>
          <h1 className="text-3xl font-semibold text-white">Login Stub</h1>
          <p className="text-sm text-slate-400">
            Type a name, save it to local storage, and reuse it inside the todo
            feature.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6"
          aria-live="polite"
        >
          <label className="block text-sm font-semibold text-slate-300">
            Display name
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              placeholder="e.g. Ada Lovelace"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className="flex-1 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white disabled:opacity-40"
            >
              Save name
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-2xl border border-slate-700/60 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-slate-200 hover:border-slate-500"
            >
              Clear saved name
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4 text-sm text-slate-300">
          <p>
            Current status:{" "}
            <strong className="text-slate-100">
              {savedName ? `stored as ${savedName}` : "no name stored"}
            </strong>
          </p>
          <p className="mt-2">
            Jump to the <Link className="text-blue-300" to="/todo">todo board</Link>{" "}
            to test the shared exports.
          </p>
        </div>
      </div>
    </section>
  );
}
