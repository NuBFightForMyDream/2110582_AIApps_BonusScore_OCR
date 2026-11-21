"use client";

import { isAuto, redo, reset, setRole, undo } from "@/lib/actions";
import { NEXT } from "@/lib/data";
import { startGuide } from "@/lib/guide";
import { ROLE_OF, ROLES, type Role } from "@/lib/roles";
import { useStore } from "@/lib/store";

export default function TopBar() {
  const s = useStore();
  const busy = Object.keys(s.busy).length > 0 || Object.keys(s.running).length > 0;

  /** Orders waiting for a person on each screen (unread mail for the inbox). */
  const waiting = (r: Role) =>
    r === "inbox"
      ? s.orders.filter((o) => o.mail && !o.mailRead).length
      : s.orders.filter((o) => NEXT[o.status] && !isAuto(o) && ROLE_OF[o.status] === r).length;

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="logo" viewBox="0 0 32 32" aria-hidden>
          <rect x="7" y="2" width="18" height="28" rx="3" />
          <path d="M7 12h18M11 6v3M11 16v5" />
        </svg>
        <div>
          <div className="brand-name">FlowLedger</div>
          <div className="brand-sub">AI and LS class project</div>
        </div>
      </div>

      <nav className="roles" aria-label="Screens">
        {ROLES.map((r) => {
          const n = waiting(r.id);
          return (
            <button
              key={r.id}
              className={s.role === r.id ? "on" : ""}
              aria-current={s.role === r.id ? "page" : undefined}
              onClick={() => setRole(r.id)}
            >
              {r.name}
              {n > 0 && <span className="role-n">{n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="top-actions">
        <div className="undo-redo" role="group" aria-label="Undo and redo">
          <button
            className="btn btn-ghost"
            onClick={undo}
            disabled={busy || s.past.length === 0}
            title={s.past.length ? `Undo: ${s.past.at(-1)!.label} (Ctrl+Z)` : "Nothing to undo"}
          >
            Undo
          </button>
          <button
            className="btn btn-ghost"
            onClick={redo}
            disabled={busy || s.future.length === 0}
            title={s.future.length ? `Redo: ${s.future.at(-1)!.label} (Ctrl+Shift+Z)` : "Nothing to redo"}
          >
            Redo
          </button>
        </div>
        <button className="btn btn-primary" onClick={startGuide} disabled={!!s.guide}>
          Guided demo
        </button>
        <button className="btn btn-ghost" onClick={reset} disabled={busy} title="Start over with no invoices">
          Reset
        </button>
      </div>
    </header>
  );
}
