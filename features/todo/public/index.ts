export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

const STORAGE_KEY = "savage:todos";

function readTodos(): TodoItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TodoItem[];
  } catch {
    return [];
  }
}

export function getStoredTodos(): TodoItem[] {
  return readTodos();
}

export function persistTodos(todos: TodoItem[]): TodoItem[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }
  return todos;
}

export function createTodoItem(text: string): TodoItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    done: false,
  };
}

export function clearTodos() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
