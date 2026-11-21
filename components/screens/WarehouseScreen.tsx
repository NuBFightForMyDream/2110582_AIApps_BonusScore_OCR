"use client";

import * as act from "@/lib/actions";
import { CATALOG } from "@/lib/data";
import { reached } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Order, Sku } from "@/lib/types";
import { BUSY_LABEL, Working } from "../ui";

/** Where each model sits in the warehouse, and when to reorder it. */
const BIN: Record<Sku, string> = { "FR-MINI": "A-01", "FR-1D": "A-04", "FR-2D": "B-02", "FR-SBS": "C-04" };
const REORDER_AT: Record<Sku, number> = { "FR-MINI": 20, "FR-1D": 15, "FR-2D": 10, "FR-SBS": 10 };

/**
 * Warehouse, laid out like inventory software: shortages that need a person
 * at the top, then the stock table, then pick tickets with live status.
 */
export default function WarehouseScreen() {
  const s = useStore();
  const shortages = s.orders.filter((o) => o.status === "short");
  const tickets = s.orders.filter((o) => reached(o, "saved")).slice().reverse();
  const shortSkus = new Set(shortages.flatMap((o) => o.shortList?.map((x) => x.sku) ?? []));

  return (
    <div className="wh">
      <header className="wh-head">
        <h1>Warehouse</h1>
        <p>Bangkok distribution centre. Stock is checked automatically when the back office approves an invoice.</p>
      </header>

      {shortages.map((o) => (
        <Shortage key={o.id} o={o} />
      ))}

      <section aria-labelledby="wh-stock">
        <h2 id="wh-stock" className="wh-h">
          Stock
        </h2>
        <table className="wh-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Bin</th>
              <th className="num">On hand</th>
              <th className="num">Reorder at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(CATALOG) as Sku[]).map((k) => {
              const n = s.stock[k];
              const low = n < REORDER_AT[k];
              return (
                <tr key={k} className={shortSkus.has(k) ? "wh-hit" : ""}>
                  <td className="mono">{k}</td>
                  <td>{CATALOG[k].name}</td>
                  <td className="mono muted">{BIN[k]}</td>
                  <td className="num mono wh-qty">{n}</td>
                  <td className="num mono muted">{REORDER_AT[k]}</td>
                  <td className={low ? "wh-low" : "muted"}>{low ? "Below reorder point" : "OK"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="wh-picks">
        <h2 id="wh-picks" className="wh-h">
          Pick tickets
        </h2>
        {tickets.length === 0 ? (
          <p className="wh-empty">No pick tickets yet. One is created when the back office approves an invoice.</p>
        ) : (
          <table className="wh-table wh-click">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Lines</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((o) => (
                <tr key={o.id} className={o.id === s.selected ? "on" : ""} onClick={() => act.select(o.id)}>
                  <td className="mono">{o.id}</td>
                  <td>{o.customer}</td>
                  <td>{o.items.map((i) => `${i.qty} × ${i.sku}`).join(", ")}</td>
                  <td>
                    <TicketStatus o={o} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function TicketStatus({ o }: { o: Order }) {
  const s = useStore();
  if (o.status === "saved") {
    return (
      <span className="wh-auto">
        <span className="spinner sm" aria-hidden /> Checking stock
      </span>
    );
  }
  if (o.status === "short") {
    return s.busy[o.id] ? (
      <span className="wh-auto">
        <span className="spinner sm" aria-hidden /> Restocking
      </span>
    ) : (
      <span className="wh-low">Short, needs you</span>
    );
  }
  if (!reached(o, "invoiced")) return <span>Picked{o.restockMode ? " after restock" : ""}</span>;
  if (!reached(o, "out")) return <span>Loaded on truck 3</span>;
  if (!reached(o, "proof_ok")) return <span>Out for delivery</span>;
  return <span className="muted">Delivered</span>;
}

/** The one human decision in the warehouse: how to cover a shortage. */
function Shortage({ o }: { o: Order }) {
  const s = useStore();
  const busy = s.busy[o.id];
  return (
    <section className="wh-short" aria-label={`Shortage on ${o.id}`}>
      <div className="wh-short-h">
        <span className="needs-you">Needs you</span>
        <h2>
          Shortage on <span className="mono">{o.id}</span>, {o.customer}
        </h2>
      </div>
      <table className="wh-short-lines">
        <tbody>
          {o.shortList!.map((x) => (
            <tr key={x.sku}>
              <td className="mono">{x.sku}</td>
              <td>{CATALOG[x.sku].name}</td>
              <td className="num">
                need <b>{x.need}</b>
              </td>
              <td className="num">
                on hand <b>{x.have}</b>
              </td>
              <td className="num wh-low">
                short <b>{x.need - x.have}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {busy ? (
        <Working label={BUSY_LABEL[busy]} />
      ) : (
        <div className="wh-short-act">
          <p>Purchasing has been told. How should we cover it?</p>
          <div className="row">
            <button className="btn btn-human" onClick={() => act.restock(o.id, "buy")}>
              Buy from supplier
            </button>
            <button className="btn btn-ghost" onClick={() => act.restock(o.id, "build")}>
              Order a production run
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
