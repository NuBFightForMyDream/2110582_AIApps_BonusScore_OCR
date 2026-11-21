"use client";

import { canTravel, openAs, setRole, undo } from "@/lib/actions";
import { STAGES } from "@/lib/data";
import { exitGuide, GUIDE_TOTAL, guideOrder, guideStep, runGuideStep } from "@/lib/guide";
import { roleName } from "@/lib/roles";
import { getState, useStore } from "@/lib/store";
import { useEffect } from "react";

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

/** Step-by-step guide. Human steps wait for Next; automatic steps are narrated while they run. */
export function GuideBar() {
  const s = useStore();
  // On the Driver screen the guide sits beside the phone instead (see DriverScreen).
  return s.guide && s.role !== "driver" ? <Guide /> : null;
}

/** The guide panel. `inline` places it in the page flow instead of fixed at the bottom. */
export function Guide({ inline = false }: { inline?: boolean }) {
  const s = useStore();
  const step = guideStep(s);
  const o = guideOrder(s);
  const settled = canTravel();
  const stage = STAGES[step.stage - 1];
  const here = s.role === step.role;

  // Each time the guide moves to a new step, show the screen where it happens.
  // Remembered on the guide itself, so remounting (e.g. switching tabs) doesn't pull you back.
  useEffect(() => {
    const g = getState().guide;
    const key = `${step.n}:${step.role}`;
    if (!g || g.shown === key) return;
    g.shown = key;
    if (o) openAs(step.role, o.id);
    else setRole(step.role);
  }, [step.n, step.role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className={`guide guide-${step.actor} ${inline ? "guide-inline" : ""}`} aria-label="Guided demo" aria-live="polite">
      <div className="guide-progress" aria-hidden>
        <i style={{ width: `${(step.n / GUIDE_TOTAL) * 100}%` }} />
      </div>
      <div className="guide-body">
        <div className="guide-text">
          <div className="guide-meta">
            Step {step.n} of {GUIDE_TOTAL}. Stage {stage.n}, {stage.name.toLowerCase()}, on the{" "}
            {here ? (
              <b>{roleName(step.role)}</b>
            ) : (
              <button className="link" onClick={() => setRole(step.role)}>
                {roleName(step.role)}
              </button>
            )}{" "}
            screen.
          </div>
          <h2>
            {step.auto ? <span className="auto-tag">Automatic</span> : step.actor === "human" && <span className="needs-you">Needs you</span>}
            {step.title}
          </h2>
          <p>{step.text}</p>
        </div>
        <div className="guide-actions">
          <button className="btn btn-ghost" onClick={undo} disabled={!settled || s.past.length === 0}>
            Back
          </button>
          {step.auto ? (
            <span className="guide-running">
              <span className="spinner sm" aria-hidden /> Running
            </span>
          ) : (
            step.next && (
              <button className="btn btn-primary" onClick={runGuideStep} disabled={!settled}>
                {settled ? step.next : "Working…"}
              </button>
            )
          )}
        </div>
        {step.actor !== "done" && (
          <button className="guide-exit" onClick={exitGuide} aria-label="Exit guide">
            ×
          </button>
        )}
      </div>
    </section>
  );
}
