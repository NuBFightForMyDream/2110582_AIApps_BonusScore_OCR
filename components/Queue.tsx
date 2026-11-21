"use client";

import { fetchEInvoices, scanPaper, select } from "@/lib/actions";
import { NEXT, STATUS } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import type { ChangeEvent } from "react";
import { StatusPill } from "./ui";

function readFile(e: ChangeEvent<HTMLInputElement>, done: (dataUrl: string) => void) {
  const f = e.target.files?.[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => done(String(rd.result));
  rd.readAsDataURL(f);
  e.target.value = "";
}

function Row({ o, selected }: { o: Order; selected: boolean }) {
  const s = useStore();
  const stage = STATUS[o.status].stage;
  const next = NEXT[o.status];
  return (
    <li>
      <button className={`qrow ${selected ? "on" : ""}`} onClick={() => select(o.id)} aria-current={selected}>
        <div className="qrow-top">
          <b>{o.id}</b>
          <span className="qrow-ch">{o.channel === "paper" ? "Paper" : "E-invoice"}</span>
          {s.busy[o.id] && <span className="spinner sm" aria-label="working" />}
        </div>
        <div className="qrow-cust">{o.customer}</div>
        <div className="segs" aria-label={`Stage ${stage} of 8`}>
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} className={i + 1 < stage || !next ? "done" : i + 1 === stage ? "cur" : ""} />
          ))}
        </div>
        <div className="qrow-foot">
          <StatusPill status={o.status} />
          {next && <span className="qrow-next">{next.what}</span>}
        </div>
      </button>
    </li>
  );
}

export default function Queue() {
  const s = useStore();
  const groups: [string, Order[]][] = [
    ["Needs a person", s.orders.filter((o) => NEXT[o.status]?.actor === "human")],
    ["In progress", s.orders.filter((o) => NEXT[o.status] && NEXT[o.status]!.actor !== "human")],
    ["Completed", s.orders.filter((o) => !NEXT[o.status])],
  ];

  return (
    <aside className="queue">
      <div className="intake">
        <h2 className="panel-h">Add invoices</h2>
        <div className="intake-btns">
          <label className="btn btn-soft">
            Upload a scan
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => readFile(e, (url) => scanPaper(url))}
            />
          </label>
          <button className="btn btn-soft" onClick={() => scanPaper()}>
            Sample scan
          </button>
          <button className="btn btn-soft" onClick={fetchEInvoices}>
            Fetch e-invoices
          </button>
        </div>
        <p className="hint">The file is saved to S3 and the invoice to Postgres.</p>
      </div>

      {s.orders.length === 0 ? (
        <p className="queue-empty">Your invoices will show up here.</p>
      ) : (
        groups.map(
          ([title, list]) =>
            list.length > 0 && (
              <div key={title} className="qgroup">
                <div className="qgroup-h">
                  {title} <span>{list.length}</span>
                </div>
                <ul>
                  {list.map((o) => (
                    <Row key={o.id} o={o} selected={o.id === s.selected} />
                  ))}
                </ul>
              </div>
            ),
        )
      )}
    </aside>
  );
}
