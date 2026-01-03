import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const cacheBase = path.resolve(".cache", "savage");
const defaultsFile = path.join(cacheBase, "defaults.json");

const baseDefaults = {
  featureTemplate: "default"
};

async function ensureCacheDir() {
  await mkdir(cacheBase, { recursive: true });
}

async function loadDefaults() {
  try {
    const raw = await readFile(defaultsFile, "utf8");
    return { ...baseDefaults, ...JSON.parse(raw) };
  } catch {
    await ensureCacheDir();
    await writeFile(defaultsFile, JSON.stringify(baseDefaults, null, 2), "utf8");
    return { ...baseDefaults };
  }
}

async function writeDefaults(defaults) {
  await ensureCacheDir();
  await writeFile(defaultsFile, JSON.stringify(defaults, null, 2), "utf8");
}

export { loadDefaults, writeDefaults, baseDefaults };
