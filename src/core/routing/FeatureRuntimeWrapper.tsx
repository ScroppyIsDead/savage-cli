import { useEffect } from "react";
import type { ReactNode } from "react";
import TelemetryGuard from "./TelemetryGuard";
import type { TelemetryMetadata } from "./TelemetryGuard";
import { schedulePrefetch, type PrefetchEntry } from "./prefetchScheduler";

type HookModule = Record<string, unknown>;
type ModuleLoader = () => Promise<HookModule>;

const initModules = import.meta.glob(
  "../../../features/*/hooks/init.ts",
) as Record<string, ModuleLoader>;
const cleanupModules = import.meta.glob(
  "../../../features/*/hooks/cleanup.ts",
) as Record<string, ModuleLoader>;

function getHookFunction(
  module: HookModule | undefined,
  exportName: string,
): (() => unknown) | undefined {
  if (!module) return undefined;
  const candidate = module[exportName];
  if (typeof candidate === "function") return candidate as () => unknown;
  const defaultExport = module.default;
  if (typeof defaultExport === "function")
    return defaultExport as () => unknown;
  return undefined;
}

function PolicyGuard({
  featureName,
  policies,
  children,
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
    <div
      data-feature={featureName}
      data-policies={policies ? JSON.stringify(policies) : undefined}
    >
      {children}
    </div>
  );
}

export default function FeatureRuntimeWrapper({
  featureName,
  policies,
  routeMetadata,
  prefetchEntries,
  children,
}: {
  featureName: string;
  policies?: Record<string, unknown>;
  routeMetadata?: TelemetryMetadata;
  prefetchEntries?: PrefetchEntry[];
  children: ReactNode;
}) {
  useEffect(() => {
    schedulePrefetch(prefetchEntries);
  }, [prefetchEntries]);

  return (
    <TelemetryGuard
      metadata={{
        featureName,
        routeName: routeMetadata?.routeName ?? `${featureName}.route`,
        routePath: routeMetadata?.routePath,
        featureVersion: routeMetadata?.featureVersion,
        policies,
        overrideKey: routeMetadata?.overrideKey,
      }}
    >
      <PolicyGuard featureName={featureName} policies={policies}>
        {children}
      </PolicyGuard>
    </TelemetryGuard>
  );
}

function useFeatureLifecycle(featureName: string) {
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    const load = async () => {
      const initLoader =
        initModules[`../../../features/${featureName}/hooks/init.ts`];
      const cleanupLoader =
        cleanupModules[`../../../features/${featureName}/hooks/cleanup.ts`];

      if (initLoader) {
        const mod = await initLoader();
        const fn = getHookFunction(mod, "init");
        fn?.();
      }

      if (cleanupLoader) {
        const mod = await cleanupLoader();
        cleanupFn = getHookFunction(mod, "cleanup");
      }
    };

    load();

    return () => cleanupFn?.();
  }, [featureName]);
}

export function FeatureLifecycleScope({
  featureName,
  children,
}: {
  featureName: string;
  children: ReactNode;
}) {
  useFeatureLifecycle(featureName);
  return <>{children}</>;
}
