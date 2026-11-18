"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/**
 * Renders `fallback` on the server and during hydration, then `children` right after hydration.
 * Unlike next/dynamic({ ssr: false }), nothing throws during prerendering, so there is no client-render
 * Suspense boundary for React to retry later.
 */
export function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return <>{mounted ? children : fallback}</>;
}
