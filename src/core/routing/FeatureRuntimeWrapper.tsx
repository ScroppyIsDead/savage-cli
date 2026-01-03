import React, { ReactNode, useEffect } from "react";
import TelemetryGuard, { TelemetryMetadata } from "./TelemetryGuard";

type HookModule = Record<string, unknown>;
type ModuleMap = Record<string, HookModule>;

const initModules = import.meta.glob("../../../features/*/hooks/init.ts", { eager: true }) as ModuleMap;
const cleanupModules = import.meta.glob("../../../features/*/hooks/cleanup.ts", { eager: true }) as ModuleMap;

function resolveModule(modules: ModuleMap, featureName: string, suffix: string): HookModule | undefined {
  const entry = Object.entries(modules).find(([key]) => key.includes(`features/${featureName}/${suffix}`));
  return entry ? entry[1] : undefined;
}

function getHookFunction(module: HookModule | undefined, exportName: string): (() => unknown) | undefined {
  if (!module) return undefined;
  const candidate = module[exportName];
  if (typeof candidate === "function") return candidate as () => unknown;
  const defaultExport = module.default;
  if (typeof defaultExport === "function") return defaultExport as () => unknown;
  return undefined;
}

function PolicyGuard({
  featureName,
  policies,
  children
}: {
  featureName: string;
  policies?: Record<string, unknown>;
  children: ReactNode;
}) {
  useEffect(() => {
    if (policies) {
      console.log(`Feature ${featureName} policies:`, policies);
    }
  }, [featureName, policies]);

  return (
    <div data-feature={featureName} data-policies={policies ? JSON.stringify(policies) : undefined}>
      {children}
    </div>
  );
}

export default function FeatureRuntimeWrapper({
  featureName,
  policies,
  routeMetadata,
  children
}: {
  featureName: string;
  policies?: Record<string, unknown>;
  routeMetadata?: TelemetryMetadata;
  children: ReactNode;
}) {
  useEffect(() => {
    const initModule = resolveModule(initModules, featureName, "hooks/init.ts");
    const cleanupModule = resolveModule(cleanupModules, featureName, "hooks/cleanup.ts");
    const initFn = getHookFunction(initModule, "init");
    const cleanupFn = getHookFunction(cleanupModule, "cleanup");

    if (initFn) initFn();
    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [featureName]);

  return (
    <TelemetryGuard
      metadata={{
        featureName,
        routeName: routeMetadata?.routeName ?? `${featureName}.route`,
        routePath: routeMetadata?.routePath,
        featureVersion: routeMetadata?.featureVersion,
        policies,
        overrideKey: routeMetadata?.overrideKey
      }}
    >
      <PolicyGuard featureName={featureName} policies={policies}>
        {children}
      </PolicyGuard>
    </TelemetryGuard>
  );
}
