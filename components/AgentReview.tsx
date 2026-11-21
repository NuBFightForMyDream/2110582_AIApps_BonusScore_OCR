"use client";

import { confirmAgent } from "@/lib/actions";
import { CREDIT_LIMIT, OUTSTANDING } from "@/lib/data";
import { baht, totals } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgentTrace } from "./record";

const short = (n: number) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : `฿${Math.round(n / 1000)}k`;

/**
 * The agent's checks as a plain checklist: what was checked, what it found,
 * and whether it passed. Rows fill in one by one while the agent works.
 */
export function AgentChecks({ o }: { o: Order }) {
  const s = useStore();
  const done = o.agentTrace?.length ?? 0;
  const working = s.busy[o.id] === "agent";
  const { total } = totals(o);
  const used = OUTSTANDING + total;
  const pct = Math.round((used / CREDIT_LIMIT) * 100);

  const rows: { label: string; result: ReactNode }[] = [
    { label: "Customer account", result: `${o.customer} is active and in good standing` },
    {
      label: "Credit",
      result: (
        <span className="credit">
          <span>
            {short(used)} of {short(CREDIT_LIMIT)} limit used after this order ({pct}%)
          </span>
          <span className="credit-bar" aria-hidden>
            <i style={{ width: `${(OUTSTANDING / CREDIT_LIMIT) * 100}%` }} />
            <i className="credit-new" style={{ width: `${(total / CREDIT_LIMIT) * 100}%` }} />
          </span>
        </span>
      ),
    },
    { label: "Prices", result: `${o.items.length} of ${o.items.length} lines match the price list` },
    { label: "Stock", result: `${o.items.map((i) => `${i.qty} × ${i.sku}`).join(", ")} reserved` },
  ];

  return (
    <table className="agent-checks">
      <tbody>
        {rows.map((r, i) => {
          const state = i < done ? "ok" : working && i === done ? "run" : "wait";
          return (
            <tr key={r.label} className={`ac-${state}`}>
              <th scope="row">{r.label}</th>
              <td>{state === "ok" ? r.result : state === "run" ? "Checking…" : "Waiting"}</td>
              <td className="ac-mark" aria-label={state === "ok" ? "Passed" : state === "run" ? "Checking" : "Not checked yet"}>
                {state === "ok" ? "✓" : state === "run" ? <span className="spinner sm" aria-hidden /> : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The recommendation, the checks behind it, and the raw log for anyone curious. */
function Decision({ o }: { o: Order }) {
  return (
    <>
      <div className="agent-rec">
        <span className="agent-rec-label">Agent recommends</span>
        <b>Approve and send to fulfilment</b>
      </div>
      <AgentChecks o={o} />
      <details className="agent-log">
        <summary>Show agent log</summary>
        <AgentTrace o={o} />
      </details>
    </>
  );
}

/** Back-office task version, shown in the invoice detail. */
export function AgentDecisionTask({ o }: { o: Order }) {
  return (
    <div className="task task-human">
      <div className="needs-you">Needs you</div>
      <h3>Approve this order?</h3>
      <Decision o={o} />
      <div className="row">
        <button className="btn btn-human" onClick={() => confirmAgent(o.id)}>
          Approve order
        </button>
      </div>
    </div>
  );
}

/** Pop-up on the back office as soon as the agent has a recommendation. */
export function AgentConfirm() {
  const s = useStore();
  const [later, setLater] = useState<string[]>([]);
  const o = s.role === "admin" ? s.orders.find((x) => x.status === "decided" && !later.includes(x.id)) : undefined;
  const approveRef = useRef<HTMLButtonElement>(null);
  const dismiss = () => o && setLater((l) => [...l, o.id]);

  useEffect(() => {
    if (!o) return;
    approveRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLater((l) => [...l, o.id]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [o]);

  if (!o) return null;
  const { total } = totals(o);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="modal approve-modal" role="dialog" aria-modal="true" aria-labelledby="approve-title">
        <header className="approve-h">
          <div>
            <h2 id="approve-title">
              Approve order <span className="mono">{o.id}</span>?
            </h2>
            <p>
              {o.customer}, <span className="mono">{baht(total)}</span>
            </p>
          </div>
          <button className="approve-x" onClick={dismiss} aria-label="Close, review later">
            ×
          </button>
        </header>
        <div className="approve-b">
          <Decision o={o} />
          <p className="approve-note">Nothing ships until a person approves. You can also do this later from the order.</p>
        </div>
        <footer className="approve-f">
          <button className="btn btn-ghost" onClick={dismiss}>
            Review later
          </button>
          <button ref={approveRef} className="btn btn-human" onClick={() => confirmAgent(o.id)}>
            Approve order
          </button>
        </footer>
      </div>
    </div>
  );
}
