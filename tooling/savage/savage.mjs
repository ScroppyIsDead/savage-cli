import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import ts from "typescript";
import semver from "semver";
import { loadDefaults, writeDefaults } from "./defaults.mjs";

const args = process.argv.slice(2);
const [command, ...rest] = args;

const flagValue = (flag) => {
  const index = rest.findIndex(
    (arg) => arg === flag || arg.startsWith(`${flag}=`)
  );
  if (index === -1) return undefined;
  const raw = rest[index];
  if (raw === flag) {
    return rest[index + 1];
  }
  return raw.split("=")[1];
};

const positional = rest.filter(
  (arg) => !arg.startsWith("--") && !arg.includes("=")
);

const featureDir = path.resolve("features");
const templateBase = path.resolve("templates", "feature");
const cacheBase = path.resolve(".cache", "savage");
const contractsDir = path.join(cacheBase, "contracts");

function describeNameType(name, kind) {
  if (kind === "hook" || /^use[A-Z]/.test(name)) {
    return "hook";
  }
  if (kind === "function") {
    return "function";
  }
  if (kind === "class") {
    return "class";
  }
  if (kind === "const") {
    return "const";
  }
  return "export";
}

function collectExportsFromSource(sourceFile) {
  const exports = [];
  for (const statement of sourceFile.statements) {
    const modifiers = ts.getCombinedModifierFlags(statement);
    const isExported = (modifiers & ts.ModifierFlags.Export) !== 0;
    if (ts.isFunctionDeclaration(statement) && isExported && statement.name) {
      exports.push({
        name: statement.name.text,
        type: describeNameType(statement.name.text, "function"),
      });
    }
    if (ts.isClassDeclaration(statement) && isExported && statement.name) {
      exports.push({
        name: statement.name.text,
        type: describeNameType(statement.name.text, "class"),
      });
    }
    if (ts.isVariableStatement(statement) && isExported) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            name: decl.name.text,
            type: describeNameType(decl.name.text, "const"),
          });
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const specifier of statement.exportClause.elements) {
        exports.push({
          name: specifier.name.text,
          type: describeNameType(specifier.name.text, "export"),
        });
      }
    }
  }
  return exports;
}

async function describePublicExports(feature, _config) {
  const publicEntry = path.join(featureDir, feature, "public", "index.ts");
  try {
    const source = await readFile(publicEntry, "utf8");
    const sourceFile = ts.createSourceFile(
      publicEntry,
      source,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS
    );
    const usable = collectExportsFromSource(sourceFile);
    if (!usable.length) {
      return [];
    }
    return usable.map((entry) => ({
      name: entry.name,
      type: entry.type,
      path: "./public/index.ts",
    }));
  } catch {
    return [];
  }
}

async function scramblePaths(src, dest, replacements) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    let destName = entry.name.replace(
      /\{\{featureName\}\}/g,
      replacements.featureName || ""
    );
    if (destName.endsWith(".template")) {
      destName = destName.slice(0, -".template".length);
    }
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      await scramblePaths(srcPath, destPath, replacements);
      continue;
    }
    let content = await readFile(srcPath, "utf8");
    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(`{{${key}}}`).join(value);
    }
    await writeFile(destPath, content);
  }
}

async function ensureContractsDir() {
  await mkdir(contractsDir, { recursive: true });
}

async function copyTemplate(name, templateOverride) {
  const templateDir = path.resolve(templateBase, templateOverride);
  try {
    await stat(templateDir);
  } catch {
    throw new Error(
      `Template not found: ${templateOverride || "default"} (${templateDir})`
    );
  }
  const target = path.join(featureDir, name);
  try {
    await stat(target);
    throw new Error(`Feature already exists: ${name}`);
  } catch (_error) {
    if (_error.code !== "ENOENT") throw _error;
  }
  await scramblePaths(templateDir, target, { featureName: name });
  return target;
}

async function loadConfig(feature) {
  const configPath = path.join(featureDir, feature, "feature.config");
  const raw = await readFile(configPath, "utf8");
  return yaml.load(raw);
}

async function listFeatures() {
  const entries = await readdir(featureDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function buildConfigCache() {
  const features = await listFeatures();
  const cache = new Map();
  for (const feature of features) {
    const config = await loadConfig(feature);
    cache.set(feature, config);
  }
  return cache;
}

function printDependencyGraph(configCache) {
  const graph = buildDependencyGraph(configCache);
  const reverse = new Map();
  for (const [feature, deps] of graph) {
    for (const dep of deps) {
      const list = reverse.get(dep) ?? [];
      list.push(feature);
      reverse.set(dep, list);
    }
  }
  console.log("\nDependency graph (feature -> dependencies):");
  for (const feature of Array.from(configCache.keys()).sort()) {
    const deps = graph.get(feature) ?? [];
    console.log(`  ${feature} -> ${deps.length ? deps.join(", ") : "(none)"}`);
  }
  console.log("\nReverse dependencies (feature -> dependents):");
  for (const feature of Array.from(configCache.keys()).sort()) {
    const dependents = reverse.get(feature) ?? [];
    console.log(
      `  ${feature} <- ${dependents.length ? dependents.join(", ") : "(none)"}`
    );
  }
}

function buildDependencyGraph(configs) {
  const graph = new Map();
  for (const [feature, config] of configs) {
    const deps = (config.dependencies ?? [])
      .map((dep) => dep?.feature)
      .filter(Boolean);
    graph.set(feature, deps);
  }
  return graph;
}

function expandDependencyClosure(feature, graph, visited = new Set()) {
  if (visited.has(feature)) return visited;
  visited.add(feature);
  const deps = graph.get(feature) ?? [];
  for (const dep of deps) {
    expandDependencyClosure(dep, graph, visited);
  }
  return visited;
}

async function dirExists(dir) {
  try {
    const info = await stat(dir);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function spawnCommand(commandName, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(commandName, args, { stdio: "inherit", shell: false });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`Command failed: ${commandName} ${args.join(" ")}`));
    });
  });
}

async function readSnapshot(feature) {
  try {
    const data = await readFile(
      path.join(contractsDir, `${feature}.json`),
      "utf8"
    );
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeSnapshot(feature, exportsList, version) {
  await ensureContractsDir();
  await writeFile(
    path.join(contractsDir, `${feature}.json`),
    JSON.stringify({ exports: exportsList, version }, null, 2),
    "utf8"
  );
}

function gatherExports(config) {
  return (config.public?.exports ?? [])
    .map((entry) => entry.name)
    .filter(Boolean);
}

async function collectFeatureFiles(feature) {
  const root = path.join(featureDir, feature);
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      ) {
        files.push(entryPath);
      }
    }
  }
  await walk(root);
  return files;
}

function isPublicImport(pathName) {
  const normalized = pathName.split(path.sep).join(path.sep);
  return (
    normalized.includes(`${path.sep}public${path.sep}`) ||
    normalized.endsWith(`${path.sep}public`)
  );
}

async function analyzeImports(allowed) {
  const errors = [];
  const features = await listFeatures();
  for (const feature of features) {
    const files = await collectFeatureFiles(feature);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.ESNext,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      for (const statement of sourceFile.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier)
        )
          continue;
        const specifier = statement.moduleSpecifier.text;
        if (!specifier.includes("features/")) continue;
        const resolved = path.resolve(path.dirname(file), specifier);
        const token = `${path.sep}features${path.sep}`;
        const idx = resolved.indexOf(token);
        if (idx === -1) continue;
        const remainder = resolved.slice(idx + token.length);
        const segments = remainder.split(path.sep).filter(Boolean);
        const targetFeature = segments[0];
        if (!targetFeature) continue;
        const restPath = segments.slice(1).join(path.sep);
        if (!isPublicImport(restPath)) {
          errors.push(
            `[${file}] imports '${specifier}' but feature '${targetFeature}' must be accessed through public exports (include /public/ in the path)`
          );
          continue;
        }
        const allowedSet = allowed.get(targetFeature) ?? new Set();
        const clause = statement.importClause;
        if (!clause) continue;
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            const importedName =
              element.propertyName?.text ?? element.name.text;
            if (!allowedSet.has(importedName)) {
              errors.push(
                `[${file}] imports '${importedName}' from ${targetFeature} but it is not declared in its public exports`
              );
            }
          }
        }
        if (clause.name) {
          if (!allowedSet.has("default")) {
            errors.push(
              `[${file}] imports default from ${targetFeature} but no 'default' export is declared in public exports`
            );
          }
        }
        if (
          clause.namedBindings &&
          ts.isNamespaceImport(clause.namedBindings)
        ) {
          errors.push(
            `[${file}] namespace imports (import * as X) are disallowed for public contracts; import only declared exports`
          );
        }
      }
    }
  }
  return errors;
}

async function writeConfig(feature, config) {
  const configPath = path.join(featureDir, feature, "feature.config");
  await writeFile(
    configPath,
    yaml.dump(config, { lineWidth: -1, noRefs: true }),
    "utf8"
  );
}

async function run() {
  switch (command) {
    case "generate": {
      const featureName = positional[0];
      if (!featureName)
        throw new Error(
          "Usage: savage generate <feature-name> [--template=custom]"
        );
      const templateOverride = flagValue("--template");
      const defaults = await loadDefaults();
      const templateName = templateOverride ?? defaults.featureTemplate;
      const target = await copyTemplate(featureName, templateName);
      console.log(`Feature scaffolded at ${target}`);
      console.log(
        "Update feature.config, wire routes, and add tests as needed."
      );
      break;
    }
    case "info": {
      const requested = positional[0];
      const configCache = await buildConfigCache();
      const features = requested ? [requested] : Array.from(configCache.keys());
      if (features.length === 0) {
        console.log("No features found.");
        break;
      }
      for (const feature of features) {
        const config = configCache.get(feature);
        if (!config) {
          console.warn(`Feature ${feature} is missing or failed to load.`);
          continue;
        }
        const owners =
          (config.owners ?? [])
            .map((owner) =>
              `${owner.team ?? ""}${
                owner.contact ? ` (${owner.contact})` : ""
              }`.trim()
            )
            .filter(Boolean)
            .join(", ") || "-";
        const dependencies =
          (config.dependencies ?? [])
            .map(
              (dep) => `${dep.feature}${dep.version ? `@${dep.version}` : ""}`
            )
            .join(", ") || "-";
        const exports =
          config.public?.exports?.map((exp) => exp.name).join(", ") || "-";
        const routes =
          config.routes?.map((route) => route.name).join(", ") || "-";
        const policies = config.policies
          ? JSON.stringify(config.policies)
          : "-";
        console.log(
          `\nFeature: ${config.name ?? feature} (v${config.version ?? "0.0.0"})`
        );
        console.log(`  Owners: ${owners}`);
        console.log(`  Dependencies: ${dependencies}`);
        console.log(`  Exports: ${exports}`);
        console.log(`  Routes: ${routes}`);
        console.log(`  Policies: ${policies}`);
      }
      if (rest.includes("--graph")) {
        printDependencyGraph(configCache);
      }
      break;
    }
    case "test": {
      const featureName = positional[0];
      if (!featureName) {
        await spawnCommand("npm", ["run", "test"]);
        break;
      }
      const configCache = await buildConfigCache();
      if (!configCache.has(featureName)) {
        throw new Error(`Feature not found: ${featureName}`);
      }
      const graph = buildDependencyGraph(configCache);
      const targets = Array.from(expandDependencyClosure(featureName, graph));
      const testDirs = [];
      for (const target of targets) {
        const testsDir = path.join(featureDir, target, "tests");
        if (await dirExists(testsDir)) {
          testDirs.push(testsDir);
        }
      }
      const args = ["run", "test", "--", "--runInBand"];
      if (testDirs.length) {
        console.log(
          `Running contract-aware tests for ${targets.join(
            ", "
          )} (tests folders: ${testDirs.join(", ")})`
        );
        args.push(...testDirs);
      } else {
        console.log("No feature-specific tests found; running full suite.");
      }
      await spawnCommand("npm", args);
      break;
    }
    case "set-default-template": {
      const scope = positional[0];
      const templateName = positional[1];
      if (scope !== "feature" || !templateName) {
        throw new Error(
          "Usage: savage set-default-template feature <template-name>"
        );
      }
      const defaults = await loadDefaults();
      defaults.featureTemplate = templateName;
      await writeDefaults(defaults);
      console.log(`Default feature template set to "${templateName}"`);
      break;
    }
    case "check": {
      const autoBump = flagValue("--auto-bump") !== undefined;
      const autoDescribe = flagValue("--auto-describe") !== undefined;
      const configCache = await buildConfigCache();
      const features = Array.from(configCache.keys());
      if (features.length === 0) {
        console.log("No features to check.");
        break;
      }
      const targetFeatures = positional[0] ? [positional[0]] : features;
      for (const feature of targetFeatures) {
        const config = configCache.get(feature);
        if (!config) continue;
        let configDirty = false;
        if (autoDescribe) {
          const described = await describePublicExports(feature, config);
          if (described.length) {
            config.public = config.public ?? {};
            config.public.exports = described;
            console.log(
              `Updated public exports for ${feature} via auto-describe`
            );
            configDirty = true;
          }
        }
        const exportsList = gatherExports(config);
        const snapshot = await readSnapshot(feature);
        const exportsChanged =
          !snapshot ||
          JSON.stringify(exportsList) !== JSON.stringify(snapshot.exports);
        let currentVersion = config.version ?? "0.0.0";
        if (exportsChanged) {
          if (autoBump) {
            const bumped =
              semver.inc(currentVersion, "patch") ?? currentVersion;
            config.version = bumped;
            await writeConfig(feature, config);
            currentVersion = bumped;
            console.log(
              `Bumped ${feature} version to ${bumped} (public exports changed)`
            );
          } else {
            console.warn(
              `Feature ${feature} public exports changed; update feature.config version (current: ${currentVersion}) before publishing.`
            );
          }
        }
        await writeSnapshot(feature, exportsList, currentVersion);
        if (configDirty) {
          await writeConfig(feature, config);
        }
      }
      const allowed = new Map();
      for (const feature of features) {
        const config = configCache.get(feature);
        const exportsList = gatherExports(config);
        allowed.set(feature, new Set(exportsList));
      }
      const importErrors = await analyzeImports(allowed);
      if (importErrors.length) {
        importErrors.forEach((msg) => console.error(msg));
        throw new Error(
          "Contract enforcement failed. Fix import violations above."
        );
      }
      console.log("Contract enforcement passed.");
      break;
    }
    case "graph": {
      const configCache = await buildConfigCache();
      if (configCache.size === 0) {
        console.log("No features found.");
        break;
      }
      printDependencyGraph(configCache);
      break;
    }
    default:
      console.log("Available commands: generate, info, test, check, graph");
      console.log("Usage: npm run savage -- <command> [...args]");
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
