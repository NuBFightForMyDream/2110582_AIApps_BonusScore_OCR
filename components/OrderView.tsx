"use client";

import { ACTOR_LABEL, CATALOG, STAGES, STATUS } from "@/lib/data";
import { baht, reached, totals } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import ActionCard, { AgentTrace } from "./ActionCard";
import DocView from "./DocView";
import { ActorTag, Meter, Section, StatusPill } from "./ui";

function StageRail({ o }: { o: Order }) {
  const cur = STATUS[o.status].stage;
  const done = o.status === "emailed";
  return (
    <ol className="rail" aria-label="Pipeline stages">
      {STAGES.map((st) => {
        const state = done || st.n < cur ? "done" : st.n === cur ? "cur" : "todo";
        return (
          <li key={st.n} className={state} aria-current={state === "cur" ? "step" : undefined}>
            <span className="rail-dot">{state === "done" ? "✓" : st.n}</span>
            <span className="rail-name">{st.name}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Everything the pipeline has produced for this invoice so far. */
function Record({ o }: { o: Order }) {
  const s = useStore();
  const paper = o.channel === "paper";
  const { total } = totals(o);
  const showStock = reached(o, "short") && o.status !== "saved";

  return (
    <div className="record">
      {o.fields && (
        <Section title="Extracted fields" tag={<ActorTag actor="ai">{paper ? "Local OCR" : "XML parser"}</ActorTag>}>
          <table className="fields">
            <tbody>
              {o.fields.map((f) => {
                const value = f.key === "taxId" && o.taxIdFinal ? o.taxIdFinal : f.value;
                const pct = Math.round(f.confidence * 100);
                return (
                  <tr key={f.label} className={f.flagged && o.status === "extracted" ? "flag" : ""}>
                    <th>{f.label}</th>
                    <td className={f.key === "taxId" ? "mono" : ""}>
                      {value}
                      {f.key === "taxId" && o.taxIdFinal && f.flagged && <span className="fixed">corrected</span>}
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
        </Section>
      )}

      {o.checks && (
        <Section title="LLM validation" tag={<ActorTag actor="ai" />}>
          <ul className="checks">
            {o.checks.map((c) => (
              <li key={c.text} className={c.ok ? "ok" : "warn"}>
                {c.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {reached(o, "saved") && (
        <Section title="Saved to database" tag={<span className="tag tag-done">201 Created</span>}>
          <pre className="code">{`POST /api/invoices
{
  "invoice_no": "${o.id}",
  "customer": "${o.customer}",
  "tax_id": "${o.taxIdFinal}",
  "total": ${total.toFixed(2)},
  "source": "${o.s3}",
  "validated_by": ["${paper ? "local-ocr" : "xml-parser"}", "llm", "human-review"]
}`}</pre>
        </Section>
      )}

      {(showStock || s.busy[o.id] === "stock") && (
        <Section title="Stock check" tag={<ActorTag actor="sys" />}>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Ordered</th>
                <th className="num">{o.stockDiff ? "Before" : "In stock"}</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i) => {
                const have = o.stockDiff?.find((d) => d.sku === i.sku)?.before ?? s.stock[i.sku];
                const wasShort = o.shortList?.some((x) => x.sku === i.sku);
                return (
                  <tr key={i.sku}>
                    <td>
                      <b>{i.sku}</b> <span className="muted small">{CATALOG[i.sku].name}</span>
                    </td>
                    <td className="num">{i.qty}</td>
                    <td className="num">{have}</td>
                    <td>
                      {o.status === "short" && wasShort ? (
                        <span className="pill pill-warn">Not enough</span>
                      ) : wasShort ? (
                        <span className="pill pill-done">Restocked</span>
                      ) : (
                        <span className="pill pill-done">Enough</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {reached(o, "released") && o.agentTrace && (
        <Section title="Agent decision" tag={<ActorTag actor="ai">AI agent</ActorTag>}>
          <AgentTrace o={o} />
        </Section>
      )}

      {reached(o, "signed") && (
        <Section title="Proof of delivery" tag={<ActorTag actor="human">Customer</ActorTag>}>
          <div className="proof">
            {o.signature && (
              <figure>
                <img className="sig-img" src={o.signature} alt="Customer signature" />
                <figcaption>Customer signature</figcaption>
              </figure>
            )}
            {o.photo && reached(o, "proof_ok") && (
              <figure>
                <img src={o.photo} alt={`Delivery photo for ${o.id}`} />
                <figcaption>Delivery photo, checked by AI</figcaption>
              </figure>
            )}
          </div>
          {reached(o, "proof_ok") && o.proofChecks && (
            <ul className="checks">
              {o.proofChecks.map((c) => (
                <li key={c} className="ok">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {o.payment && (
        <Section title="Settlement" tag={<ActorTag actor="human" />}>
          <dl className="kv">
            <dt>Payment</dt>
            <dd>
              {baht(o.payment.amount)} via {o.payment.method} at {o.payment.time}
            </dd>
            <dt>Bank match</dt>
            <dd>{o.bankRef ? <span className="mono">{o.bankRef}</span> : <span className="muted">Not matched yet</span>}</dd>
            {o.stockDiff && (
              <>
                <dt>Stock</dt>
                <dd>{o.stockDiff.map((d) => `${d.sku} ${d.before} to ${d.after}`).join(", ")}</dd>
              </>
            )}
          </dl>
        </Section>
      )}

      {o.mail && (
        <Section title="Email sent" tag={<ActorTag actor="mail">Gmail</ActorTag>}>
          <div className="mail-view">
            <div>
              <span className="muted">To</span> {o.mail.to}
            </div>
            <div>
              <span className="muted">Subject</span> <b>{o.mail.subject}</b>
            </div>
            <p>{o.mail.body}</p>
            <span className="attach"><span className="attach-ic" aria-hidden>PDF</span>{o.id}.pdf</span>
            <div className="muted small">
              Sent at {o.mail.time}, message ID {o.mail.id}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function Timeline({ o }: { o: Order }) {
  return (
    <Section title="Timeline">
      <ol className="timeline">
        {o.timeline
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={i} className={`tl-${e.actor}`}>
              <span className="tl-t mono">{e.t}</span>
              <span className="tl-who">{ACTOR_LABEL[e.actor]}</span>
              <span>{e.msg}</span>
            </li>
          ))}
      </ol>
    </Section>
  );
}

export default function OrderView({ o }: { o: Order }) {
  const { total } = totals(o);
  const issued = reached(o, "invoiced");
  return (
    <div className="order">
      <header className="order-h">
        <div>
          <div className="order-src">
            {o.channel === "paper" ? "Paper invoice, scanned" : "E-invoice"} <span className="mono">{o.s3}</span>
          </div>
          <h1>
            {o.id} <span className="order-cust">{o.customer}</span>
          </h1>
        </div>
        <div className="order-total">
          <span className="mono">{baht(total)}</span>
          <StatusPill status={o.status} />
        </div>
      </header>

      <StageRail o={o} />
      <ActionCard o={o} />

      <div className="order-grid">
        <Record o={o} />
        <div className="order-side">
          <DocView o={o} issued={issued} />
          <Timeline o={o} />
        </div>
      </div>
    </div>
  );
}
