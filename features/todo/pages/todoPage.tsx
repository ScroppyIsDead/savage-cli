import { FormEvent, useEffect, useMemo, useState } from "react";
import { RouteLink } from "@savage-cli/routing";
import { getStoredUserName } from "../../user/public";
import {
  createTodoItem,
  getStoredTodos,
  persistTodos,
} from "../public";
import type { TodoItem } from "../public";

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setTodos(getStoredTodos());
  }, []);

  const total = todos.length;
  const completed = useMemo(
    () => todos.filter((item) => item.done).length,
    [todos],
  );
  const owner = getStoredUserName() ?? "dev";

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const updated = [...todos, createTodoItem(text)];
    persistTodos(updated);
    setTodos(updated);
    setDraft("");
  }

  function handleToggle(id: string) {
    const updated = todos.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    );
    persistTodos(updated);
    setTodos(updated);
  }

  function handleDelete(id: string) {
    const updated = todos.filter((item) => item.id !== id);
    persistTodos(updated);
    setTodos(updated);
  }

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-slate-900/60">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">
            Todos
          </p>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold text-white">
              Local storage board
            </h1>
            <RouteLink
              name="user.login"
              className="rounded-full border border-slate-700/80 px-3 py-1 text-xs uppercase tracking-[0.4em] text-blue-300"
            >
              Edit user
            </RouteLink>
          </div>
          <p className="text-sm text-slate-400">
            {owner} · {completed}/{total} done
          </p>
        </header>

        <form
          onSubmit={handleAdd}
          className="flex gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-3"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="flex-1 bg-transparent text-sm text-white outline-none"
            placeholder="Describe the next task..."
          />
          <button
            type="submit"
            className="rounded-2xl bg-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
          >
            Add
          </button>
        </form>

        <div className="space-y-3">
          {todos.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing lined up yet.</p>
          ) : (
            todos.map((todo) => (
              <article
                key={todo.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900 to-slate-800/40 p-4"
              >
                <div>
                  <p
                    className={`text-sm ${
                      todo.done ? "text-slate-500 line-through" : "text-white"
                    }`}
                  >
                    {todo.text}
                  </p>
                  <p className="text-xs text-slate-500">
                    {todo.done ? "Completed" : "In progress"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(todo.id)}
                    className="rounded-full border border-blue-500/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-blue-200"
                  >
                    {todo.done ? "Undo" : "Done"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(todo.id)}
                    className="rounded-full border border-red-500/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-200"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
