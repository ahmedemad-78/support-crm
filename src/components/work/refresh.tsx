"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markWorkNoticesRead } from "@/app/(app)/work/actions";
export function WorkRefresh() {
  const router = useRouter();
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [router]);
  return null;
}
export function WorkReadMarker({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !ids.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !entries.some((e) => e.isIntersecting) ||
          document.visibilityState !== "visible"
        )
          return;
        observer.disconnect();
        const run = async () => {
          const result = await markWorkNoticesRead(ids);
          if (!result.ok && !cancelled) timer = setTimeout(run, 5000);
        };
        void run();
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ids]);
  return <div ref={ref} aria-hidden="true" style={{ height: 2 }} />;
}
