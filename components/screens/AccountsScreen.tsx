"use client";

import * as act from "@/lib/actions";
import { baht, reached, totals } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BankTx, Order } from "@/lib/types";
import { Fragment, useState } from "react";

const money = (n: number) => baht(n).replace("฿", "");
const count = (n: number) => `${n} invoice${n === 1 ? "" : "s"}`;

/**
 * Accounts receivable, laid out like a real accounting tool:
 * a one-line summary, the invoice table (the only button is "Record payment"),
 * and bank reconciliation pairing each bank line with its invoice.
 */
export default function AccountsScreen() {
  const s = useStore();
  const invoices = s.orders.filter((o) => reached(o, "invoiced")).slice().reverse();
  const unpaid = invoices.filter((o) => !reached(o, "paid"));
  const collected = invoices.filter((o) => reached(o, "matched"));
  const unmatched = s.bank.filter((t) => !t.matched);
  const sum = (list: Order[]) => list.reduce((a, o) => a + totals(o).total, 0);

  return (
    <div className="ar">
      <header className="ar-head">
        <h1>Accounts</h1>
        <p>Delivered orders get paid here. The bank match, closing and email happen by themselves.</p>
      </header>

      <dl className="ar-summary">
        <div>
          <dt>Outstanding</dt>
          <dd>
            <span className="mono">฿{money(sum(unpaid))}</span> <span className="muted">{count(unpaid.length)}</span>
          </dd>
        </div>
        <div>
          <dt>Collected today</dt>
          <dd>
            <span className="mono">฿{money(sum(collected))}</span> <span className="muted">{count(collected.length)}</span>
          </dd>
        </div>
        <div>
          <dt>Unmatched bank lines</dt>
          <dd>
            <span className="mono">{unmatched.length}</span>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="ar-inv">
        <h2 id="ar-inv" className="ar-h">
          Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="ar-empty">No invoices yet. They appear here once the back office creates one for an approved order.</p>
        ) : (
          <InvoiceTable invoices={invoices} />
        )}
      </section>

      <section aria-labelledby="ar-bank">
        <h2 id="ar-bank" className="ar-h">
          Bank reconciliation
        </h2>
        <p className="muted small ar-sub">Business current account, today. Each bank line is paired with the invoice it pays.</p>
        <Reconciliation />
      </section>
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: Order[] }) {
  const s = useStore();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <table className="ar-table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Customer</th>
          <th>Due</th>
          <th className="num">Amount (฿)</th>
          <th>Status</th>
          <th>
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((o) => {
          const payable = o.status === "proof_ok";
          const open = payable && openId === o.id;
          return (
            <Fragment key={o.id}>
              <tr className={`${o.id === s.selected ? "on" : ""}`} onClick={() => act.select(o.id)}>
                <td className="mono">{o.id}</td>
                <td>{o.customer}</td>
                <td>{o.due}</td>
                <td className="num mono">{money(totals(o).total)}</td>
                <td>
                  <InvoiceStatus o={o} />
                </td>
                <td className="ar-act">
                  {payable && !open && (
                    <button
                      className="btn btn-human"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(o.id);
                      }}
                    >
                      Record payment
                    </button>
                  )}
                </td>
              </tr>
              {open && (
                <tr className="ar-form-row">
                  <td colSpan={6}>
                    <PaymentForm o={o} onCancel={() => setOpenId(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

const AUTO_STATUS: Partial<Record<Order["status"], string>> = {
  paid: "Matching with the bank",
  matched: "Closing the invoice",
  closed: "Emailing the paid invoice",
};

const STATUS_TEXT: Partial<Record<Order["status"], string>> = {
  invoiced: "Waiting for delivery",
  out: "Out for delivery",
  signed: "Delivery being checked",
  proof_ok: "Delivered, not paid",
  emailed: "Paid",
};

/** Plain-language status; automatic steps show a spinner and what is happening. */
function InvoiceStatus({ o }: { o: Order }) {
  const s = useStore();
  const auto = AUTO_STATUS[o.status];
  if (auto) {
    return (
      <span className="ar-auto">
        {(s.busy[o.id] || s.running[o.id]) && <span className="spinner sm" aria-hidden />}
        {auto}
      </span>
    );
  }
  return <span className={`ar-status ar-${o.status}`}>{STATUS_TEXT[o.status]}</span>;
}

function PaymentForm({ o, onCancel }: { o: Order; onCancel: () => void }) {
  const [method, setMethod] = useState("Bank transfer");
  return (
    <form
      className="ar-form"
      onSubmit={(e) => {
        e.preventDefault();
        act.acceptPayment(o.id, method);
      }}
    >
      <span className="needs-you">Needs you</span>
      <span>
        Confirm that {o.customer} paid <b className="mono">฿{money(totals(o).total)}</b>
      </span>
      <label className="ar-method">
        <span className="sr-only">Payment method</span>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Bank transfer</option>
          <option>PromptPay</option>
          <option>Cheque</option>
        </select>
      </label>
      <button type="submit" className="btn btn-human">
        Confirm payment
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function Reconciliation() {
  const s = useStore();
  return (
    <ul className="recon">
      {s.bank
        .slice()
        .reverse()
        .map((t) => (
          <li key={t.ref} className={t.orderId && t.orderId === s.selected ? "on" : ""}>
            <div className="recon-bank">
              <span className="mono recon-ref">{t.ref}</span>
              <span>{t.from}</span>
              <span className="muted small">{t.time}</span>
              <span className={`mono recon-amt ${t.amount < 0 ? "neg" : ""}`}>
                {t.amount < 0 ? "−" : "+"}
                {money(Math.abs(t.amount))}
              </span>
            </div>
            <span className="recon-arrow" aria-hidden>
              ⇄
            </span>
            <Match t={t} />
          </li>
        ))}
    </ul>
  );
}

/** What a bank line was matched to, or the AI matching it right now. */
function Match({ t }: { t: BankTx }) {
  const s = useStore();
  const o = t.orderId ? s.orders.find((x) => x.id === t.orderId) : undefined;

  if (!o) {
    return (
      <div className="recon-match">
        <span>{t.amount < 0 ? "Supplier payment, no invoice" : t.desc}</span>
        {t.matched && <span className="muted small">Reconciled earlier</span>}
      </div>
    );
  }
  return (
    <div className="recon-match">
      <span>
        <b className="mono">{o.id}</b> {o.customer}
      </span>
      <span className="recon-checks">
        {t.matched ? (
          ["Amount", "Payer", "Reference"].map((c) => (
            <span key={c} className="recon-ok">
              ✓ {c}
            </span>
          ))
        ) : (
          <span className="ar-auto">
            <span className="spinner sm" aria-hidden /> AI is checking amount, payer and reference
          </span>
        )}
      </span>
    </div>
  );
}
