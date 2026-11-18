"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Next.js keeps recently visited pages mounted and restores them on Back/Forward. Wrapping a subtree in this
 * remounts it on a fresh visit (link click, push, replace) so it picks up new server data, while Back still
 * restores it exactly as it was.
 */
export function FreshOnPush({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter();
  return <React.Fragment key={bfcacheId}>{children}</React.Fragment>;
}
