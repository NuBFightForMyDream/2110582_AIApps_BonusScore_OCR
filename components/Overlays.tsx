"use client";

import { compose, sendEmail } from "@/lib/actions";
import { STAGES } from "@/lib/data";
import { draftEmail } from "@/lib/format";
import { exitGuide, GUIDE_TOTAL, guideOrder, guideStep, runGuideStep } from "@/lib/guide";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { useEffect, useState } from "react";

function Compose({ o }: { o: Order }) {
  const s = useStore();
  const [d, setD] = useState(() => draftEmail(o));
  const sending = s.busy[o.id] === "send";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && compose(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sending]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !sending && compose(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
        <div className="modal-h">
          <h2 id="compose-title">New email in Gmail</h2>
          <span className="mock-chip">Not really sent</span>
        </div>
        <div className="modal-b">
          <label className="mrow">
            <span>To</span>
            <input value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} />
          </label>
          <label className="mrow">
            <span>Subject</span>
            <input value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          </label>
          <textarea rows={8} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} aria-label="Message" />
          <span className="attach">
            <span className="attach-ic" aria-hidden>
              PDF
            </span>
            {o.id}.pdf, 84 KB
          </span>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={() => compose(null)} disabled={sending}>
            Cancel
          </button>
          <button className="btn btn-mail" onClick={() => sendEmail(o.id, d)} disabled={sending || !d.to.trim()}>
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GmailModal() {
  const s = useStore();
  const o = s.composeFor ? s.orders.find((x) => x.id === s.composeFor) : undefined;
  return o ? <Compose key={o.id} o={o} /> : null;
}

export function Toasts() {
  const s = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.actor && <span className={`dot dot-${t.actor}`} aria-hidden />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/** Step-by-step guide. Advances only when the user presses Next (or does the step themselves). */
export function GuideBar() {
  const s = useStore();
  if (!s.guide) return null;
  const step = guideStep(s);
  const o = guideOrder(s);
  const working = !!(o && s.busy[o.id]);
  const stage = STAGES[step.stage - 1];

  return (
    <section className={`guide guide-${step.actor}`} aria-label="Guided demo" aria-live="polite">
      <div className="guide-progress" aria-hidden>
        <i style={{ width: `${(step.n / GUIDE_TOTAL) * 100}%` }} />
      </div>
      <div className="guide-body">
        <div className="guide-text">
          <div className="guide-meta">
            Step {step.n} of {GUIDE_TOTAL}, in stage {stage.n}: {stage.name}
          </div>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </div>
        <div className="guide-actions">
          {step.next && (
            <button className="btn btn-primary" onClick={runGuideStep} disabled={working}>
              {working ? "Working…" : step.next}
            </button>
          )}
          {step.actor !== "done" && (
            <button className="btn btn-ghost" onClick={exitGuide}>
              Exit guide
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
