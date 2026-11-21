"use client";

import { reset } from "@/lib/actions";
import { NEXT } from "@/lib/data";
import { baht, totals } from "@/lib/format";
import { startGuide } from "@/lib/guide";
import { useStore } from "@/lib/store";

export default function TopBar() {
  const s = useStore();
  const done = s.orders.filter((o) => o.status === "emailed");
  const waiting = s.orders.filter((o) => NEXT[o.status]?.actor === "human").length;
  const open = s.orders.length - done.length;
  const collected = done.reduce((a, o) => a + totals(o).total, 0);
  const busy = Object.keys(s.busy).length > 0;

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="logo" viewBox="0 0 32 32" aria-hidden>
          <rect x="7" y="2" width="18" height="28" rx="3" />
          <path d="M7 12h18M11 6v3M11 16v5" />
        </svg>
        <div>
          <div className="brand-name">FlowLedger</div>
          <div className="brand-sub">Fridge order-to-cash demo</div>
        </div>
      </div>

      <p className="summary" aria-live="polite">
        {s.orders.length === 0 ? (
          "No invoices yet"
        ) : (
          <>
            <span>
              <b>{open}</b> open
            </span>
            <span className={waiting ? "summary-human" : ""}>
              <b>{waiting}</b> waiting on you
            </span>
            <span>
              <b>{done.length}</b> paid
            </span>
            <span>
              <b className="mono">{baht(collected).replace(".00", "")}</b> collected
            </span>
          </>
        )}
      </p>

      <div className="top-actions">
        <span className="mock-chip" title="No AWS, bank or Gmail services are connected. All data is made up.">
          Mock data
        </span>
        <button className="btn btn-primary" onClick={startGuide} disabled={!!s.guide}>
          Guided demo
        </button>
        <button className="btn btn-ghost" onClick={reset} disabled={busy}>
          Reset
        </button>
      </div>
    </header>
  );
}
