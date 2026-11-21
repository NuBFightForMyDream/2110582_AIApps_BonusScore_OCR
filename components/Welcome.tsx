"use client";

import { fetchEInvoices, scanPaper } from "@/lib/actions";
import { ACTOR_LABEL, STAGES } from "@/lib/data";
import { startGuide } from "@/lib/guide";
import { useStore } from "@/lib/store";

export default function Welcome() {
  const s = useStore();
  return (
    <div className="welcome">
      <h1>Follow a fridge order from invoice to payment.</h1>
      <p className="lede">
        A retailer orders nine side-by-side fridges on paper. Watch AI read the invoice, check stock and match the
        payment, and step in yourself where a person has to decide.
      </p>
      <div className="row">
        <button className="btn btn-primary btn-lg" onClick={startGuide} disabled={!!s.guide}>
          Start guided demo
        </button>
        <button className="btn btn-ghost" onClick={() => scanPaper()}>
          Scan a sample invoice
        </button>
        <button className="btn btn-ghost" onClick={fetchEInvoices}>
          Fetch e-invoices
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
    </div>
  );
}
