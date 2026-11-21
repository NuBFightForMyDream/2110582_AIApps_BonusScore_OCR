"use client";

import { openAs } from "@/lib/actions";
import { ACTOR_LABEL, NEXT, STATUS } from "@/lib/data";
import { ROLE_OF, roleName } from "@/lib/roles";
import { useStore } from "@/lib/store";
import type { Actor, BusyKind, Order, Status } from "@/lib/types";
import type { ChangeEvent, ReactNode } from "react";

export const BUSY_LABEL: Record<BusyKind, string> = {
  ocr: "Local OCR model reading the scan…",
  llm: "LLM checking the extracted fields…",
  api: "Saving to the database…",
  stock: "Scanning the bays…",
  restock: "Raising the order and restocking…",
  agent: "Agent calling tools…",
  invoice: "Creating the e-invoice and paper copy…",
  proof: "AI checking the photo…",
  bank: "Asking the bank…",
  db: "Updating stock and closing the invoice…",
  send: "Sending…",
};

/** What the automation will do next for an order in each automatic status. */
const UPCOMING: Partial<Record<Status, BusyKind>> = {
  stored: "ocr",
  extracted: "api",
  saved: "stock",
  ready: "agent",
  released: "invoice",
  signed: "proof",
  paid: "bank",
  matched: "db",
  closed: "send",
};

/** Shows a step that runs by itself: no button, just what is happening. */
export function Auto({ o, children }: { o: Order; children?: ReactNode }) {
  const s = useStore();
  const kind = s.busy[o.id] ?? UPCOMING[o.status];
  return (
    <div className="auto" role="status">
      <span className="auto-tag">Automatic</span>
      {children}
      <Working label={kind ? BUSY_LABEL[kind] : "Working…"} />
    </div>
  );
}

export function ActorTag({ actor, children }: { actor: Actor; children?: ReactNode }) {
  return <span className={`tag tag-${actor}`}>{children ?? ACTOR_LABEL[actor]}</span>;
}

/** Status with a dot coloured by who acts next (or "done"). */
export function StatusPill({ status }: { status: Status }) {
  const next = NEXT[status];
  return <span className={`pill pill-${next ? next.actor : "done"}`}>{STATUS[status].label}</span>;
}

export function Working({ label }: { label: string }) {
  return (
    <div className="working" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Meter({ value, low }: { value: number; low?: boolean }) {
  return (
    <span className={`meter ${low ? "low" : ""}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export function Section({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <h3>
        <span>{title}</span>
        {tag}
      </h3>
      {children}
    </section>
  );
}

/** Progress through the 8 stages as small segments. */
export function Segments({ o }: { o: Order }) {
  const stage = STATUS[o.status].stage;
  const done = o.status === "emailed";
  return (
    <span className="segs" aria-label={`Stage ${stage} of 8`}>
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} className={done || i + 1 < stage ? "done" : i + 1 === stage ? "cur" : ""} />
      ))}
    </span>
  );
}

/** "Now with Warehouse" link that jumps to the screen handling the order. */
export function WithRole({ o }: { o: Order }) {
  const r = ROLE_OF[o.status];
  return (
    <button className="link" onClick={() => openAs(r, o.id)}>
      {roleName(r)}
    </button>
  );
}

/** A button that opens the file picker and hands back the image as a data URL. */
export function FileButton({
  children,
  className = "btn btn-ghost",
  onFile,
}: {
  children: ReactNode;
  className?: string;
  onFile: (dataUrl: string) => void;
}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => onFile(String(rd.result));
    rd.readAsDataURL(f);
    e.target.value = "";
  };
  return (
    <label className={className} style={{ cursor: "pointer" }}>
      {children}
      <input type="file" accept="image/*" hidden onChange={onChange} />
    </label>
  );
}
