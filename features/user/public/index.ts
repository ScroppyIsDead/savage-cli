const STORAGE_KEY = "savage:user-name";

export type UserProfile = {
  name: string;
};

function readProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function getStoredUserName(): string | null {
  return readProfile()?.name ?? null;
}

export function saveUserName(name: string) {
  if (typeof window === "undefined") return;
  const profile = { name };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearUserName() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
