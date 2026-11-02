"use client";

export default function PrintButton({ label = "Skriv ut" }: { label?: string }) {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      🖨 {label}
    </button>
  );
}
