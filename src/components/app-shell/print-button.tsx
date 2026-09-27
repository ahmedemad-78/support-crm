"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-semibold"
    >
      Export PDF
    </button>
  );
}
