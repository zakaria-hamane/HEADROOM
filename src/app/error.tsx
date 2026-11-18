"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-16 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red/12 text-red">
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-[40px] leading-none font-bold uppercase">Something went wrong</h1>
        <p className="mt-3 text-[15px] text-muted">An unexpected error stopped this page. Your saved plans are safe. Try again, or go back home.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Home
          </Link>
          <Button variant="primary" size="lg" onClick={() => retry()}>
            <RotateCcw /> Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
