"use client";

import * as act from "@/lib/actions";
import { CATALOG, NEXT, STATUS } from "@/lib/data";
import { baht, totals } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BusyKind, Order } from "@/lib/types";
import { useCallback, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import { ActorTag, Working } from "./ui";

const BUSY_LABEL: Record<BusyKind, string> = {
  ocr: "Local OCR model reading the scan…",
  llm: "LLM checking the extracted fields…",
  api: "Saving via POST /api/invoices…",
  stock: "Querying the stock table…",
  restock: "Raising the order and restocking…",
  agent: "Agent calling tools…",
  invoice: "Creating e-invoice + paper copy…",
  proof: "AI checking the delivery photo…",
  bank: "Querying the Bank API…",
  db: "Writing stock and invoice status to Postgres…",
  send: "Sending via Gmail API…",
};

const WHO: Record<string, string> = {
  ai: "AI step",
  human: "Your turn",
  sys: "System step",
  mail: "Gmail",
};

export default function ActionCard({ o }: { o: Order }) {
  // Remount per status so local inputs reset between steps.
  return <Card key={`${o.id}:${o.status}`} o={o} />;
}

function Card({ o }: { o: Order }) {
  const s = useStore();
  const busy = s.busy[o.id];
  const next = NEXT[o.status];
  const paper = o.channel === "paper";
  const { total } = totals(o);

  const [taxId, setTaxId] = useState(o.ocrTaxId);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("Bank transfer");
  const [inked, setInked] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const onInk = useCallback((v: boolean) => setInked(v), []);

  let title = "";
  let body: ReactNode = null;

  switch (o.status) {
    case "stored":
      title = paper ? "Read the scan" : "Parse the e-invoice";
      body = (
        <>
          <p>
            {paper
              ? "OCR runs on a local model, so raw invoices never leave our servers. An LLM then checks the extracted fields."
              : "E-invoices are already structured, so they are parsed directly, then checked by the LLM."}
          </p>
          <button className="btn btn-ai" onClick={() => act.extract(o.id)}>
            {paper ? "Read invoice" : "Read invoice"}
          </button>
        </>
      );
      break;

    case "extracted": {
      const flagged = o.fields?.some((f) => f.flagged);
      title = flagged ? "Review the flagged field" : "Confirm the extracted fields";
      body = (
        <>
          {flagged ? (
            <>
              <p>
                The LLM flagged the Tax ID: <code>{o.ocrTaxId}</code> is not 13 digits. Fix it, then save.
              </p>
              <div className="row end">
                <label className="field grow">
                  <span>Tax ID</span>
                  <input
                    className="mono"
                    value={taxId}
                    onChange={(e) => {
                      setTaxId(e.target.value);
                      setError(null);
                    }}
                    aria-invalid={!!error}
                    inputMode="numeric"
                  />
                </label>
                <button className="btn btn-ghost" onClick={() => setTaxId(o.taxId)}>
                  Use AI suggestion
                </button>
              </div>
              {error && <p className="err">{error}</p>}
            </>
          ) : (
            <p>No fields were flagged. A quick confirm is enough.</p>
          )}
          <button
            className="btn btn-human"
            onClick={async () => setError(await act.approve(o.id, taxId))}
          >
            Approve and save
          </button>
        </>
      );
      break;
    }

    case "saved":
      title = "Check stock";
      body = (
        <>
          <p>Compare each line against the stock table before the order goes any further.</p>
          <button className="btn btn-sys" onClick={() => act.checkStock(o.id)}>
            Check stock in database
          </button>
        </>
      );
      break;

    case "short":
      title = "Not enough stock — decide how to restock";
      body = (
        <>
          <ul className="shortlist">
            {o.shortList!.map((x) => (
              <li key={x.sku}>
                <b>{x.sku}</b> {CATALOG[x.sku].name}: need <b>{x.need}</b>, have <b>{x.have}</b>
              </li>
            ))}
          </ul>
          <p>Purchasing has been notified. A person picks the fix.</p>
          <div className="row">
            <button className="btn btn-human" onClick={() => act.restock(o.id, "buy")}>
              Buy from supplier
            </button>
            <button className="btn btn-ghost" onClick={() => act.restock(o.id, "build")}>
              Order a production run
            </button>
          </div>
        </>
      );
      break;

    case "ready":
      title = "Let the agent validate the order";
      body = (
        <>
          {o.agentTrace?.length ? (
            <AgentTrace o={o} />
          ) : (
            <p>The agent calls tools to check the customer, credit, prices and stock, then decides.</p>
          )}
          {!busy && (
            <button className="btn btn-ai" onClick={() => act.runAgent(o.id)}>
              Run agent
            </button>
          )}
        </>
      );
      break;

    case "released":
      title = "Create the invoice and notify delivery";
      body = (
        <>
          <p>One event creates the e-invoice and the paper copy, and sends the job to the delivery team.</p>
          <button className="btn btn-sys" onClick={() => act.createInvoice(o.id)}>
            Create invoice
          </button>
        </>
      );
      break;

    case "invoiced":
      title = "Dispatch";
      body = (
        <>
          <p>Delivery team notified. Load the truck and send it out.</p>
          <button className="btn btn-sys" onClick={() => act.dispatch(o.id)}>
            Dispatch
          </button>
        </>
      );
      break;

    case "out":
      title = "Customer accepts and signs";
      body = (
        <>
          <p>Hand the device to the customer. They sign with a mouse or finger.</p>
          <SignaturePad ref={pad} onInk={onInk} />
          <div className="row">
            <button
              className="btn btn-human"
              disabled={!inked}
              onClick={() => {
                const v = pad.current?.value();
                if (v) act.sign(o.id, v);
              }}
            >
              Confirm signature
            </button>
            <button className="btn btn-ghost" onClick={() => pad.current?.clear()} disabled={!inked}>
              Clear
            </button>
          </div>
        </>
      );
      break;

    case "signed":
      title = o.photo ? "Verify the delivery photo" : "Photograph the signed delivery note";
      body = (
        <>
          {o.photo ? (
            <img className="proof-img" src={o.photo} alt={`Delivery photo for ${o.id}`} />
          ) : (
            <>
              <p>The delivery team takes a photo of the signed note as proof.</p>
              <div className="row">
                <label className="btn btn-soft">
                  Upload a photo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const rd = new FileReader();
                      rd.onload = () => act.attachPhoto(o.id, String(rd.result));
                      rd.readAsDataURL(f);
                    }}
                  />
                </label>
                <button className="btn btn-ghost" onClick={() => act.attachPhoto(o.id)}>
                  Use sample photo
                </button>
              </div>
            </>
          )}
          {o.proofChecks && o.proofChecks.length > 0 && (
            <ul className="checks">
              {o.proofChecks.map((c) => (
                <li key={c} className="ok">
                  {c}
                </li>
              ))}
            </ul>
          )}
          {o.photo && !busy && (
            <button className="btn btn-ai" onClick={() => act.validateProof(o.id)}>
              Verify photo
            </button>
          )}
        </>
      );
      break;

    case "proof_ok":
      title = "Accept the payment";
      body = (
        <>
          <p>Delivery is proven. Record the customer&apos;s payment and hand the invoice to the AI for matching.</p>
          <div className="row end">
            <label className="field">
              <span>Amount</span>
              <input className="mono" value={baht(total)} readOnly />
            </label>
            <label className="field">
              <span>Method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Bank transfer</option>
                <option>PromptPay</option>
                <option>Cheque</option>
              </select>
            </label>
            <button className="btn btn-human" onClick={() => act.acceptPayment(o.id, method)}>
              Accept payment
            </button>
          </div>
        </>
      );
      break;

    case "paid": {
      const tx = s.bank.find((t) => t.orderId === o.id);
      title = "Match the payment with the bank";
      body = (
        <>
          <p>
            Incoming transfer <b className="mono">{tx?.ref}</b> for {baht(total)} is open in the bank feed. The AI
            confirms it belongs to this invoice.
          </p>
          <button className="btn btn-ai" onClick={() => act.matchBank(o.id)}>
            Match payment
          </button>
        </>
      );
      break;
    }

    case "matched":
      title = "Update stock and database";
      body = (
        <>
          <p>Deduct the delivered items from stock and mark the invoice paid in Postgres.</p>
          <button className="btn btn-sys" onClick={() => act.updateStock(o.id)}>
            Update stock and database
          </button>
        </>
      );
      break;

    case "closed":
      title = "Email the paid invoice";
      body = (
        <>
          <p>Send the customer their paid invoice and a receipt note.</p>
          <button className="btn btn-mail" onClick={() => act.compose(o.id)}>
            Draft email in Gmail
          </button>
        </>
      );
      break;

    case "emailed":
      return (
        <div className="action action-done">
          <div className="action-h">
            <span className="tag tag-done">Complete</span>
            <span className="action-stage">Stage 8 of 8</span>
          </div>
          <h2>{o.id} is paid and closed</h2>
          <p>The fridges were delivered and signed for, the payment matched the bank, stock was updated and {o.customer} has the paid invoice.</p>
        </div>
      );
  }

  return (
    <div className={`action action-${next!.actor}`}>
      <div className="action-h">
        <ActorTag actor={next!.actor}>{WHO[next!.actor]}</ActorTag>
        <span className="action-stage">Stage {STATUS[o.status].stage} of 8</span>
      </div>
      <h2>{title}</h2>
      {busy ? (
        <>
          {busy === "agent" && <AgentTrace o={o} />}
          {busy === "proof" && o.photo && <img className="proof-img" src={o.photo} alt="" />}
          {busy === "proof" && (
            <ul className="checks">
              {o.proofChecks?.map((c) => (
                <li key={c} className="ok">
                  {c}
                </li>
              ))}
            </ul>
          )}
          <Working label={BUSY_LABEL[busy]} />
        </>
      ) : (
        <div className="action-body">{body}</div>
      )}
    </div>
  );
}

export function AgentTrace({ o }: { o: Order }) {
  return (
    <ol className="trace">
      {o.agentTrace?.map((st, i) => (
        <li key={i}>
          <code>
            {st.tool}({st.args ?? ""})
          </code>
          <span>→ {st.tool === "decide" ? <b>{st.result}</b> : st.result}</span>
        </li>
      ))}
    </ol>
  );
}
