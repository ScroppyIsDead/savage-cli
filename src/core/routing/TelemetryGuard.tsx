import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";

export interface TelemetryMetadata {
  featureName: string;
  routeName: string;
  routePath?: string;
  featureVersion?: string;
  policies?: Record<string, unknown>;
  overrideKey?: string;
}

type TelemetryEvent = "mount" | "unmount" | "custom";

export interface TelemetryLogger {
  log(event: TelemetryEvent, metadata: TelemetryMetadata): void;
}

const telemetryEnabled = import.meta.env.VITE_SAVAGE_TELEMETRY !== "false";
const defaultLogger: TelemetryLogger = {
  log(event, metadata) {
    if (!telemetryEnabled) return;
    console.log(`[telemetry] ${event}`, metadata);
  },
};

const TelemetryContext = createContext<TelemetryMetadata | null>(null);
const TelemetryLoggerContext = createContext<TelemetryLogger>(defaultLogger);

export function useTelemetryLogger(): TelemetryLogger {
  return useContext(TelemetryLoggerContext);
}

export function TelemetryLoggerProvider({
  children,
  logger = defaultLogger,
}: {
  children: ReactNode;
  logger?: TelemetryLogger;
}) {
  return (
    <TelemetryLoggerContext.Provider value={logger}>
      {children}
    </TelemetryLoggerContext.Provider>
  );
}

export function useFeatureTelemetry(): TelemetryMetadata {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error(
      "`useFeatureTelemetry` must be called inside a <TelemetryGuard>.",
    );
  }
  return context;
}

export default function TelemetryGuard({
  metadata,
  children,
}: {
  metadata: TelemetryMetadata;
  children: ReactNode;
}) {
  const logger = useTelemetryLogger();
  const memoizedMetadata = useMemo(
    () => metadata,
    [
      metadata.featureName,
      metadata.routeName,
      metadata.routePath ?? "",
      metadata.featureVersion ?? "",
      metadata.overrideKey ?? "",
      JSON.stringify(metadata.policies ?? {}),
    ],
  );

  useEffect(() => {
    logger.log("mount", memoizedMetadata);
    return () => {
      logger.log("unmount", memoizedMetadata);
    };
  }, [logger, memoizedMetadata]);

  return (
    <TelemetryContext.Provider value={memoizedMetadata}>
      {children}
    </TelemetryContext.Provider>
  );
}
