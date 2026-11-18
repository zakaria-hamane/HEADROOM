import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-16 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue/12 text-blue">
            <Compass className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-[40px] leading-none font-bold uppercase">Page not found</h1>
          <p className="mt-3 text-[15px] text-muted">This page doesn&apos;t exist, or the plan was deleted or is no longer shared.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              <ArrowLeft /> Home
            </Link>
            <Link href="/planner" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Open the planner
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
