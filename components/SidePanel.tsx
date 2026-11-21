"use client";

import { select } from "@/lib/actions";
import { ACTOR_LABEL, CATALOG, STOCK_FULL } from "@/lib/data";
import { baht } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Sku } from "@/lib/types";
import { useState } from "react";
import { Meter } from "./ui";

type Tab = "activity" | "stock" | "bank";

export default function SidePanel() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("activity");
  const openTx = s.bank.filter((t) => !t.matched).length;

  return (
    <aside className="side">
      <div className="tabs" role="tablist">
        {(
          [
            ["activity", "Activity"],
            ["stock", "Inventory"],
            ["bank", `Bank${openTx ? ` (${openTx})` : ""}`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "activity" &&
        (s.log.length ? (
          <ol className="activity">
            {s.log.map((e, i) => (
              <li key={s.log.length - i}>
                <span className={`dot dot-${e.actor}`} aria-hidden />
                <div>
                  <div className="act-meta">
                    <span>{ACTOR_LABEL[e.actor]}</span>
                    {e.orderId && (
                      <button className="link" onClick={() => select(e.orderId!)}>
                        {e.orderId}
                      </button>
                    )}
                    <span className="act-t">{e.t}</span>
                  </div>
                  <div>{e.msg}</div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted pad">No activity yet.</p>
        ))}

      {tab === "stock" && (
        <div className="pad">
          <p className="muted small">Units in the warehouse. Stage 4 checks this table and stage 7 takes delivered fridges out.</p>
          <ul className="inv">
            {(Object.keys(CATALOG) as Sku[]).map((k) => (
              <li key={k}>
                <div className="inv-top">
                  <b>{k}</b>
                  <span className="mono">{s.stock[k]}</span>
                </div>
                <div className="muted small">{CATALOG[k].name}</div>
                <Meter value={(s.stock[k] / STOCK_FULL) * 100} low={s.stock[k] < 10} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "bank" && (
        <div className="pad">
          <p className="muted small">Today&apos;s transactions from the bank. Highlighted ones are waiting to be matched.</p>
          <ul className="bank">
            {s.bank
              .slice()
              .reverse()
              .map((t) => (
                <li key={t.ref} className={t.matched ? "" : "open"}>
                  <div className="inv-top">
                    <b className="mono">{t.ref}</b>
                    <span className={`mono ${t.amount < 0 ? "neg" : ""}`}>{baht(t.amount)}</span>
                  </div>
                  <div className="small">{t.from}</div>
                  <div className="small muted">
                    {t.desc}, {t.time}. {t.matched ? "Matched" : "Waiting to be matched"}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
