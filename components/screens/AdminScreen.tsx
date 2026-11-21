"use client";

import * as act from "@/lib/actions";
import { isAuto } from "@/lib/actions";
import { NEXT } from "@/lib/data";
import { baht, reached, totals } from "@/lib/format";
import { ROLE_OF, roleName } from "@/lib/roles";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { useState } from "react";
import DocView from "../DocView";
import { Record, StageRail, Timeline } from "../record";
import { Auto, FileButton, Meter, Segments, StatusPill } from "../ui";
import Welcome from "../Welcome";
import { AgentChecks, AgentDecisionTask } from "../AgentReview";

/** Orders the back office must act on: a flagged field to fix. */
const needsAdmin = (o: Order) => ROLE_OF[o.status] === "admin" && NEXT[o.status] && !isAuto(o);

export default function AdminScreen() {
  const s = useStore();
  const o = s.orders.find((x) => x.id === s.selected) ?? s.orders.find(needsAdmin) ?? s.orders[0];

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <h1>Back office</h1>
          <p>Invoices arrive here. The AI reads and checks them, and you fix anything it flags.</p>
        </div>
        <div className="row">
          <FileButton onFile={(url) => act.scanPaper(url)}>Upload a scan</FileButton>
          <button className="btn btn-ghost" onClick={() => act.scanPaper()}>
            Scan sample invoice
          </button>
          <button className="btn btn-ghost" onClick={act.fetchEInvoices}>
            Fetch e-invoices
          </button>
        </div>
      </header>

      {s.orders.length === 0 ? (
        <Welcome />
      ) : (
        <div className="admin-body">
          <OrderList selected={o?.id} />
          {o && <Detail key={o.id} o={o} />}
        </div>
      )}
    </div>
  );
}

/** Left column: what needs the back office first, then everything else. */
function OrderList({ selected }: { selected?: string }) {
  const s = useStore();
  const mine = s.orders.filter(needsAdmin);
  const rest = s.orders.filter((o) => !needsAdmin(o));

  const row = (o: Order) => (
    <li key={o.id}>
      <button className={`olist-row ${o.id === selected ? "on" : ""}`} onClick={() => act.select(o.id)} aria-current={o.id === selected}>
        <span className="olist-top">
          <b className="mono">{o.id}</b>
          <span className="mono olist-amt">{baht(totals(o).total).replace(".00", "")}</span>
        </span>
        <span className="olist-cust">{o.customer}</span>
        <Segments o={o} />
        <span className="olist-foot">
          {s.busy[o.id] || s.running[o.id] ? (
            <span className="olist-auto">
              <span className="spinner sm" aria-hidden /> Automatic
            </span>
          ) : (
            <StatusPill status={o.status} />
          )}
          {NEXT[o.status] && ROLE_OF[o.status] !== "admin" && (
            <span className="olist-where">{roleName(ROLE_OF[o.status])}</span>
          )}
        </span>
      </button>
    </li>
  );

  return (
    <nav className="olist" aria-label="Orders">
      {mine.length > 0 && (
        <>
          <h2 className="olist-h olist-h-you">Needs you ({mine.length})</h2>
          <ul>{mine.map(row)}</ul>
        </>
      )}
      <h2 className="olist-h">{mine.length ? "Everything else" : `All orders (${rest.length})`}</h2>
      {rest.length ? <ul>{rest.map(row)}</ul> : <p className="muted small">Nothing else yet.</p>}
    </nav>
  );
}

/** Right column: the task on top, then the invoice next to its record. */
function Detail({ o }: { o: Order }) {
  const issued = reached(o, "invoiced");
  const reviewing = o.status === "stored" || o.status === "extracted";
  return (
    <section className="detail" aria-label={`Invoice ${o.id}`}>
      <div className="detail-h">
        <div>
          <h2>
            {o.id} <span>{o.customer}</span>
          </h2>
          <p className="muted">
            {o.channel === "paper" ? "Paper order, scanned" : "E-invoice"}. {o.address}
          </p>
        </div>
        <div className="detail-total mono">{baht(totals(o).total)}</div>
      </div>
      <StageRail o={o} />
      {/* While the invoice is being read, the review sits right beside the document (classic OCR review). */}
      {!reviewing && <Task o={o} />}

      <div className="split">
        <div className="split-doc">
          <DocView o={o} issued={issued} />
          {!reviewing && <Timeline o={o} />}
        </div>
        <div className="split-work">
          {reviewing ? (
            <>
              <Task o={o} />
              <Timeline o={o} />
            </>
          ) : (
            <Record o={o} />
          )}
        </div>
      </div>
    </section>
  );
}

/** The back office's job for this order, or where the order is now. */
function Task({ o }: { o: Order }) {
  const s = useStore();
  const paper = o.channel === "paper";
  const flagged = o.fields?.some((f) => f.flagged);

  if (o.status === "extracted" && flagged && !s.busy[o.id]) return <Review key={o.id} o={o} />;
  if (o.status === "decided") return <AgentDecisionTask o={o} />;

  switch (o.status) {
    case "stored":
    case "extracted":
      return (
        <div className="task task-auto">
          <h3>{o.status === "stored" ? "Reading the invoice" : "Saving the invoice"}</h3>
          <p>
            {paper
              ? "A local OCR model reads the scan, so the file never leaves our servers. An LLM then checks the fields. You only step in if something looks wrong."
              : "E-invoices are already structured. They are parsed directly and checked by an LLM."}
          </p>
          <Auto o={o} />
        </div>
      );
    case "ready":
    case "released":
      return (
        <div className="task task-auto">
          <h3>{o.status === "ready" ? "Agent is deciding" : "Creating the invoice"}</h3>
          <AgentChecks o={o} />
          <Auto o={o} />
        </div>
      );
    case "emailed":
      return (
        <div className="task task-done">
          <h3>Paid and closed</h3>
          <p>
            Delivered, paid and emailed to {o.customer}.{" "}
            <button className="link" onClick={() => act.openAs("inbox", o.id)}>
              See the customer&apos;s inbox
            </button>
          </p>
        </div>
      );
    default: {
      const r = ROLE_OF[o.status];
      const auto = isAuto(o) || !!s.busy[o.id];
      return (
        <div className="task task-away">
          <p>
            {auto ? (
              <>
                <b>{roleName(r)}</b> is handling this automatically: {NEXT[o.status]!.what.toLowerCase()}.
              </>
            ) : (
              <>
                Waiting for <b>{roleName(r)}</b>: {NEXT[o.status]!.what.toLowerCase()}.
              </>
            )}
          </p>
          <button className="btn btn-ghost" onClick={() => act.openAs(r, o.id)}>
            Open {roleName(r)}
          </button>
        </div>
      );
    }
  }
}

/** Side-by-side review of what the OCR read. */
function Review({ o }: { o: Order }) {
  const [taxId, setTaxId] = useState(o.ocrTaxId);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="task task-human">
      <div className="needs-you">Needs you</div>
      <h3>Check the flagged field</h3>
      <p>The AI read everything else with confidence. Fix the Tax ID, then the order carries on by itself.</p>
      <table className="fields review">
        <tbody>
          {o.fields!.map((f) => {
            const pct = Math.round(f.confidence * 100);
            return (
              <tr key={f.label} className={f.flagged ? "flag" : ""}>
                <th>{f.label}</th>
                <td>
                  {f.flagged ? (
                    <input
                      className="mono cell-input"
                      value={taxId}
                      onChange={(e) => {
                        setTaxId(e.target.value);
                        setError(null);
                      }}
                      aria-label="Tax ID"
                      aria-invalid={!!error}
                      inputMode="numeric"
                    />
                  ) : (
                    <span className={f.key === "taxId" ? "mono" : ""}>{f.value}</span>
                  )}
                </td>
                <td className="conf">
                  <Meter value={pct} low={f.confidence < 0.8} />
                  <span>{pct}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="checks">
        {o.checks!.map((c) => (
          <li key={c.text} className={c.ok ? "ok" : "warn"}>
            {c.text}
          </li>
        ))}
      </ul>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn btn-human" onClick={async () => setError(await act.approve(o.id, taxId))}>
          Approve and save
        </button>
        <button className="btn btn-ghost" onClick={() => setTaxId(o.taxId)}>
          Use AI suggestion
        </button>
      </div>
    </div>
  );
}
