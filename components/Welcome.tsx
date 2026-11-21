"use client";

import { scanPaper } from "@/lib/actions";
import { ACTOR_LABEL, STAGES } from "@/lib/data";
import { startGuide } from "@/lib/guide";
import { ROLES } from "@/lib/roles";
import { useStore } from "@/lib/store";

/** First-run screen inside the back office. */
export default function Welcome() {
  const s = useStore();
  return (
    <div className="welcome">
      <h1>Follow a fridge order from invoice to payment.</h1>
      <p className="lede">
        A retailer orders nine side-by-side fridges on paper. The order passes through five people&apos;s screens:{" "}
        {ROLES.map((r) => r.name.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}. AI does the reading,
        checking and matching. People step in where a decision is needed.
      </p>
      <div className="row">
        <button className="btn btn-primary btn-lg" onClick={startGuide} disabled={!!s.guide}>
          Start guided demo
        </button>
        <button className="btn btn-ghost btn-lg" onClick={() => scanPaper()}>
          Scan a sample invoice
        </button>
      </div>

      <h2 className="route-h">The eight stages</h2>
      <ol className="route">
        {STAGES.map((st) => (
          <li key={st.n}>
            <span className="route-n">{st.n}</span>
            <div>
              <b>{st.name}</b>
              <p>
                {st.detail}.{" "}
                <span className="route-who">
                  {st.actors.map((a) => (
                    <span key={a} className={`who who-${a}`}>
                      {ACTOR_LABEL[a]}
                    </span>
                  ))}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="hint">Stage 7 takes the delivered fridges out of the same stock table that stage 4 checks.</p>

      <footer className="credits">
        <p>
          A class project for <b>AI and LS</b>, by Chatrphol (6730084521) and Thanabodee (6733092021).
        </p>
        <p>
          Every service is simulated in your browser. No real invoices, bank accounts or emails are used.{" "}
          <a href="https://github.com/NuBFightForMyDream/2110582_AIApps_BonusScore_OCRPlatform">Source on GitHub</a>
        </p>
      </footer>
    </div>
  );
}
