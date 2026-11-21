import { ACTOR_LABEL, NEXT, STATUS } from "@/lib/data";
import type { Actor, Status } from "@/lib/types";
import type { ReactNode } from "react";

export function ActorTag({ actor, children }: { actor: Actor; children?: ReactNode }) {
  return <span className={`tag tag-${actor}`}>{children ?? ACTOR_LABEL[actor]}</span>;
}

/** Status pill, coloured by who acts next (or "done"). */
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
