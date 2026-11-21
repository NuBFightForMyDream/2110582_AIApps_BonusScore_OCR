"use client";

import * as act from "@/lib/actions";
import { COMPANY } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";
import DocView from "../DocView";

/** The customer's own mail client, showing what they received. */
export default function InboxScreen() {
  const s = useStore();
  const mailed = s.orders.filter((o) => o.mail);
  const customers = Array.from(new Set(mailed.map((o) => o.email)));
  const sel = mailed.find((o) => o.id === s.selected);
  const [account, setAccount] = useState<string | undefined>(sel?.email ?? customers[0]);
  const box = account ?? customers[0];
  const messages = mailed.filter((o) => o.email === box).reverse();
  const [openId, setOpenId] = useState<string | undefined>(sel?.id);
  const open = messages.find((o) => o.id === openId) ?? messages[0];
  const [pdf, setPdf] = useState(!!s.guide);

  useEffect(() => {
    if (sel) {
      setAccount(sel.email);
      setOpenId(sel.id);
    }
  }, [sel?.id, sel?.email]);

  useEffect(() => {
    if (open) act.markRead(open.id);
    setPdf(!!s.guide); // during the guide, show the paid invoice right away
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mailed.length === 0) {
    return (
      <div className="mail">
        <div className="mail-empty">
          <h1>Customer inbox</h1>
          <p>No mail yet. The paid invoice lands here after Accounts sends it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mail">
      <div className="mail-top">
        <span className="mail-brand">Mail</span>
        <label className="mail-account">
          <span>Signed in as</span>
          <select value={box} onChange={(e) => setAccount(e.target.value)}>
            {customers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mail-grid">
        <nav className="mail-folders" aria-label="Folders">
          <span className="on">
            Inbox <b>{messages.filter((m) => !m.mailRead).length || ""}</b>
          </span>
        </nav>
        <ul className="mail-list" aria-label="Messages">
          {messages.map((m) => (
            <li key={m.id}>
              <button className={`${m.id === open?.id ? "on" : ""} ${m.mailRead ? "" : "unread"}`} onClick={() => setOpenId(m.id)}>
                <span className="ml-from">Accounts, FlowLedger</span>
                <span className="ml-subj">{m.mail!.subject}</span>
                <span className="ml-time">{m.mail!.time.slice(0, 5)}</span>
              </button>
            </li>
          ))}
        </ul>
        {open && (
          <article className="mail-read">
            <h1>{open.mail!.subject}</h1>
            <div className="mail-meta">
              <div>
                <b>Accounts Team</b> &lt;accounts@flowledger.example&gt;
                <div className="muted">to {open.mail!.to}</div>
              </div>
              <span className="muted">Today {open.mail!.time.slice(0, 5)}</span>
            </div>
            <div className="mail-body">{open.mail!.body}</div>
            <button className="mail-attach" onClick={() => setPdf(!pdf)} aria-expanded={pdf}>
              <span className="attach-ic" aria-hidden>
                PDF
              </span>
              <span>
                <b>{open.id}.pdf</b>
                <span className="muted">{pdf ? "Hide preview" : "Open preview"}</span>
              </span>
            </button>
            {pdf && (
              <div className="mail-pdf">
                <DocView o={open} issued />
              </div>
            )}
            <p className="mail-foot muted">Sent by {COMPANY} through the Gmail API (mock).</p>
          </article>
        )}
      </div>
    </div>
  );
}
