"use client";

import * as act from "@/lib/actions";
import { CATALOG } from "@/lib/data";
import { reached } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePad, { type SignaturePadHandle } from "../SignaturePad";
import { Guide } from "../Overlays";
import { FileButton } from "../ui";

const ACTIVE = ["invoiced", "out", "signed"];

export default function DriverScreen() {
  const s = useStore();
  const stops = s.orders.filter((o) => reached(o, "invoiced"));
  const [openId, setOpenId] = useState<string | null>(null);

  // Follow the selected order (for example when the guided demo moves on).
  useEffect(() => {
    if (s.selected && stops.some((o) => o.id === s.selected)) setOpenId(s.selected);
  }, [s.selected]);

  const open = stops.find((o) => o.id === openId);

  return (
    <div className="driver">
      <div className="driver-copy">
        <h1>Driver app</h1>
        <p>This is the delivery driver&apos;s phone. The customer signs on the same phone when the fridges arrive.</p>
        {s.guide ? <Guide inline /> : <p className="muted">Tap a stop to open it.</p>}
      </div>

      <div className="phone" aria-label="Driver's phone">
        <div className="phone-screen">
          <div className="phone-status" aria-hidden>
            <span>9:41</span>
            <span className="phone-notch" />
            <span>5G 82%</span>
          </div>
          {open ? (
            <Stop
              key={open.id}
              o={open}
              onBack={() => {
                setOpenId(null);
              }}
            />
          ) : (
            <StopList stops={stops} onOpen={(id) => { setOpenId(id); act.select(id); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function StopList({ stops, onOpen }: { stops: Order[]; onOpen: (id: string) => void }) {
  const active = stops.filter((o) => ACTIVE.includes(o.status));
  const done = stops.filter((o) => !ACTIVE.includes(o.status));
  return (
    <div className="app-body">
      <header className="app-bar">
        <div>
          <div className="app-title">Today&apos;s deliveries</div>
          <div className="app-sub">Truck 3, Bangkok DC</div>
        </div>
      </header>
      {stops.length === 0 && (
        <p className="app-empty">No stops yet. Jobs appear here once the back office creates the invoice.</p>
      )}
      {active.length > 0 && <div className="app-group">To deliver</div>}
      {active.map((o, i) => (
        <button key={o.id} className="stop-card" onClick={() => onOpen(o.id)}>
          <span className="stop-n">{i + 1}</span>
          <span className="stop-main">
            <b>{o.customer}</b>
            <span>{o.address}</span>
            <span className="stop-items">{o.items.map((x) => `${x.qty}× ${x.sku}`).join(", ")}</span>
          </span>
          <span className={`stop-chip chip-${o.status}`}>
            {o.status === "invoiced" ? "Ready" : o.status === "out" ? "On the way" : "Photo"}
          </span>
        </button>
      ))}
      {done.length > 0 && <div className="app-group">Delivered</div>}
      {done.map((o) => (
        <button key={o.id} className="stop-card stop-done" onClick={() => onOpen(o.id)}>
          <span className="stop-n">✓</span>
          <span className="stop-main">
            <b>{o.customer}</b>
            <span>{o.id}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Stop({ o, onBack }: { o: Order; onBack: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [inked, setInked] = useState(false);
  const onInk = useCallback((v: boolean) => setInked(v), []);

  let body;
  if (o.status === "invoiced") {
    body = (
      <>
        <div className="app-card">
          <div className="app-label">Deliver to</div>
          <b>{o.customer}</b>
          <div>{o.address}</div>
        </div>
        <div className="app-card">
          <div className="app-label">Load</div>
          <ul className="load">
            {o.items.map((i) => (
              <li key={i.sku}>
                <b>{i.qty}×</b> {CATALOG[i.sku].name}
              </li>
            ))}
          </ul>
          <div className="app-note">Paper invoice {o.id} is in the cab.</div>
        </div>
        <button className="app-btn" onClick={() => act.dispatch(o.id)}>
          Start delivery
        </button>
      </>
    );
  } else if (o.status === "out") {
    body = (
      <>
        <div className="app-card">
          <b>Arrived at {o.customer}</b>
          <div>Hand the phone to the customer to sign for the fridges.</div>
        </div>
        <div className="app-sign">
          <SignaturePad ref={pad} onInk={onInk} />
        </div>
        <button
          className="app-btn"
          disabled={!inked}
          onClick={() => {
            const v = pad.current?.value();
            if (v) act.sign(o.id, v);
          }}
        >
          Confirm signature
        </button>
        <button className="app-btn-text" disabled={!inked} onClick={() => pad.current?.clear()}>
          Clear
        </button>
      </>
    );
  } else if (o.status === "signed" && !o.photo) {
    body = (
      <>
        <div className="viewfinder" aria-label="Camera">
          {/* Live preview: the sample photo if it exists, otherwise the plain dark viewfinder. */}
          <img
            className="vf-live"
            src="/delivery-photo.jpg"
            alt=""
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <span className="vf-corner tl" />
          <span className="vf-corner tr" />
          <span className="vf-corner bl" />
          <span className="vf-corner br" />
          <span className="vf-hint">Frame the fridge where it was installed</span>
        </div>
        <div className="camera-bar">
          <FileButton className="app-btn-text" onFile={(url) => act.attachPhoto(o.id, url)}>
            Gallery
          </FileButton>
          <button className="shutter" aria-label="Take photo" onClick={() => act.attachPhoto(o.id)} />
          <span style={{ width: 56 }} />
        </div>
      </>
    );
  } else if (o.status === "signed") {
    body = (
      <>
        <img className="app-photo" src={o.photo} alt={`Delivery photo for ${o.id}`} />
        <div className="app-card">
          <div className="app-label">Sent. AI is checking the photo</div>
          <ul className="checks">
            {o.proofChecks?.map((c) => (
              <li key={c} className="ok">
                {c}
              </li>
            ))}
          </ul>
          <div className="app-wait">
            <span className="spinner sm" aria-hidden /> Checking…
          </div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="delivered">
          <span className="delivered-mark" aria-hidden>
            ✓
          </span>
          <b>Delivered</b>
          <span>Proof checked by AI and sent to Accounts.</span>
        </div>
        <div className="app-card">
          {o.signature && <img className="app-sig" src={o.signature} alt="Customer signature" />}
          {o.photo && <img className="app-photo sm" src={o.photo} alt={`Delivery photo for ${o.id}`} />}
          <ul className="checks">
            {o.proofChecks?.map((c) => (
              <li key={c} className="ok">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  return (
    <div className="app-body">
      <header className="app-bar">
        <button className="app-back" onClick={onBack} aria-label="Back to deliveries">
          ‹
        </button>
        <div>
          <div className="app-title">{o.customer}</div>
          <div className="app-sub mono">{o.id}</div>
        </div>
      </header>
      {body}
    </div>
  );
}
