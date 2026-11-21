"use client";

/*
 * Mock services. Every "API call" below is a timed delay plus a state change
 * in the browser. Nothing talks to S3, Postgres, an OCR model, an LLM, a bank
 * or Gmail. Each function is named after the real step it stands in for.
 *
 * Two kinds of step:
 *  - Human steps (exported, called from buttons): scanning an invoice, fixing a
 *    flagged field, approving a restock, the driver's steps, accepting payment.
 *    Each saves an undo point, then hands over to the automation.
 *  - Automatic steps (AI or system): run one after another by `advance()` until
 *    the order needs a person again. They have no buttons.
 */

import { CATALOG, CREDIT_LIMIT, OUTSTANDING, TEMPLATES } from "./data";
import { baht, clock, draftEmail, totals } from "./format";
import type { Role } from "./roles";
import { getState, initialState, update, type Snapshot, type State } from "./store";
import type { Actor, BusyKind, Channel, Order, Status } from "./types";

/** Sample delivery photo, served from public/. */
const SAMPLE_PHOTO = "/delivery-photo.svg";
/** Pause between automatic steps so people can see each one happen. */
const GAP = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const find = (id: string) => getState().orders.find((o) => o.id === id);

/** Returns the order only if it is in one of the given statuses and not busy. */
function ready(id: string, ...statuses: Status[]): Order | undefined {
  const o = find(id);
  if (!o || !statuses.includes(o.status) || getState().busy[id]) return undefined;
  return o;
}

function log(s: State, msg: string, actor: Actor, o?: Order) {
  const t = clock();
  s.log.unshift({ t, msg, actor, orderId: o?.id });
  o?.timeline.push({ t, msg, actor });
}

let toastSeq = 0;
export function toast(msg: string, actor?: Actor) {
  const id = ++toastSeq;
  update((s) => void s.toasts.push({ id, msg, actor }));
  setTimeout(() => update((s) => void (s.toasts = s.toasts.filter((t) => t.id !== id))), 3600);
}

function setBusy(id: string, kind: BusyKind | null) {
  update((s) => {
    if (kind) s.busy[id] = kind;
    else delete s.busy[id];
  });
}

/* ---------- automation ---------- */

/** The automatic step for an order, or null if it is waiting for a person. */
function autoStep(o: Order): ((id: string) => Promise<unknown>) | null {
  switch (o.status) {
    case "stored":
      return extract;
    case "extracted":
      return o.fields?.some((f) => f.flagged) ? null : autoSave;
    case "saved":
      return checkStock;
    case "ready":
      return runAgent;
    case "released":
      return createInvoice;
    case "signed":
      return o.photo ? validateProof : null;
    case "paid":
      return matchBank;
    case "matched":
      return updateStock;
    case "closed":
      return emailInvoice;
    default:
      return null;
  }
}

/** True when the order's next step runs by itself (no person needed). */
export const isAuto = (o: Order) => autoStep(o) !== null;

/** Runs automatic steps one after another until the order needs a person. */
async function advance(id: string) {
  if (getState().running[id]) return;
  update((s) => void (s.running[id] = true));
  try {
    for (;;) {
      const o = find(id);
      const step = o && autoStep(o);
      if (!o || !step) break;
      await sleep(GAP);
      const before = o.status;
      await step(id);
      if (find(id)?.status === before) break; // no progress: stop rather than loop
    }
  } finally {
    update((s) => void delete s.running[id]);
  }
}

/** Restarts automation for any order left part-way (after undo or redo). */
function resumeAll() {
  getState().orders.forEach((o) => isAuto(o) && void advance(o.id));
}

/* ---------- undo / redo: between human decisions ---------- */

const MAX_HISTORY = 40;

function snapshot(): Snapshot {
  const s = getState();
  return structuredClone({
    orders: s.orders,
    selected: s.selected,
    log: s.log,
    stock: s.stock,
    bank: s.bank,
    nextNo: s.nextNo,
    paperIdx: s.paperIdx,
  });
}

/** Saves the state before a human step so it can be undone. A new step clears redo. */
function checkpoint(label: string) {
  const snap = snapshot();
  update((s) => {
    s.past.push({ label, snap });
    if (s.past.length > MAX_HISTORY) s.past.shift();
    s.future = [];
  });
}

function restore(s: State, snap: Snapshot) {
  const keep = s.selected;
  Object.assign(s, snap);
  if (keep && s.orders.some((o) => o.id === keep)) s.selected = keep;
}

/** Undo and redo wait until all automation has finished. */
export const canTravel = () => {
  const s = getState();
  return Object.keys(s.busy).length === 0 && Object.keys(s.running).length === 0;
};

export function undo() {
  const last = getState().past.at(-1);
  if (!last || !canTravel()) return;
  const now = snapshot();
  update((s) => {
    s.past.pop();
    s.future.push({ label: last.label, snap: now });
    restore(s, last.snap);
  });
  toast(`Undid: ${last.label}`);
  resumeAll();
}

export function redo() {
  const next = getState().future.at(-1);
  if (!next || !canTravel()) return;
  const now = snapshot();
  update((s) => {
    s.future.pop();
    s.past.push({ label: next.label, snap: now });
    restore(s, next.snap);
  });
  toast(`Redid: ${next.label}`);
  resumeAll();
}

/* ---------- navigation ---------- */

export function select(id: string | null) {
  update((s) => void (s.selected = id));
}

export function setRole(role: Role) {
  update((s) => void (s.role = role));
}

/** Opens a role's screen with an order selected. */
export function openAs(role: Role, id: string) {
  update((s) => {
    s.role = role;
    s.selected = id;
  });
}

export function markRead(id: string) {
  const o = find(id);
  if (o && !o.mailRead) update(() => void (o.mailRead = true));
}

/* ---------- stages 1–2: intake & storage (human) ---------- */

function makeOrder(s: State, channel: Channel, scan?: string): Order {
  const tpl = channel === "paper" ? TEMPLATES[s.paperIdx++ % 2 === 0 ? 2 : 3] : TEMPLATES[s.nextNo % 2];
  const id = `INV-${s.nextNo++}`;
  const o: Order = {
    id,
    channel,
    customer: tpl.customer,
    email: tpl.email,
    address: tpl.address,
    taxId: tpl.taxId,
    ocrTaxId: tpl.ocrTaxId ?? tpl.taxId,
    items: tpl.items.map(([sku, qty]) => ({ sku, qty })),
    date: "21 Nov 2026",
    due: "21 Dec 2026",
    status: "stored",
    s3: `s3://flowledger-demo/raw/${id}.${channel === "paper" ? "jpg" : "xml"}`,
    scan,
    timeline: [],
  };
  s.orders.push(o);
  return o;
}

export function fetchEInvoices(): string {
  checkpoint("Fetch e-invoices");
  let ids: string[] = [];
  update((s) => {
    const batch = [makeOrder(s, "e-invoice"), makeOrder(s, "e-invoice")];
    batch.forEach((o) => log(s, `${o.id} fetched from e-invoice system → stored at ${o.s3}`, "sys", o));
    ids = batch.map((o) => o.id);
    if (!s.selected) s.selected = ids[0];
  });
  toast("2 e-invoices fetched and stored in S3 + Postgres");
  ids.forEach((id) => void advance(id));
  return ids[0];
}

export function scanPaper(scan?: string): string {
  checkpoint("Scan invoice");
  let id = "";
  update((s) => {
    const o = makeOrder(s, "paper", scan);
    log(s, `${o.id} paper invoice scanned → stored at ${o.s3}`, "sys", o);
    s.selected = id = o.id;
    s.role = "admin";
  });
  void advance(id);
  return id;
}

/* ---------- stage 3: extract & validate ---------- */

async function extract(id: string) {
  const o = ready(id, "stored");
  if (!o) return;
  const paper = o.channel === "paper";
  update((s) => {
    s.busy[id] = "ocr";
    log(s, `${o.id} ${paper ? "OCR running on local ML model" : "parsing e-invoice XML"}`, "ai", o);
  });
  await sleep(1600);

  const { sub, vat, total } = totals(o);
  const c = (v: number) => (paper ? v : 1);
  update((s) => {
    o.fields = [
      { label: "Invoice no.", value: o.id, confidence: c(0.99) },
      { label: "Customer", value: o.customer, confidence: c(0.97) },
      {
        label: "Tax ID",
        value: o.ocrTaxId,
        confidence: paper ? 0.62 : 1,
        key: "taxId",
        flagged: o.ocrTaxId !== o.taxId,
      },
      { label: "Invoice date", value: o.date, confidence: c(0.96) },
      { label: "Due date", value: o.due, confidence: c(0.95) },
      { label: "Line items", value: `${o.items.length} items`, confidence: c(0.93) },
      { label: "Subtotal", value: baht(sub), confidence: c(0.98) },
      { label: "VAT 7%", value: baht(vat), confidence: c(0.98) },
      { label: "Total", value: baht(total), confidence: c(0.99) },
    ];
    s.busy[id] = "llm";
    log(s, `${o.id} LLM validating extracted fields`, "ai", o);
  });
  await sleep(1300);

  const flagged = o.fields!.some((f) => f.flagged);
  update((s) => {
    o.checks = [
      { ok: true, text: "Line items add up to the subtotal" },
      { ok: true, text: "VAT equals 7% of the subtotal" },
      { ok: true, text: `Customer “${o.customer}” found in customer table` },
      flagged
        ? {
            ok: false,
            text: `Tax ID “${o.ocrTaxId}” is not 13 digits — letter O likely misread. Suggested: ${o.taxId}`,
          }
        : { ok: true, text: "Tax ID is a valid 13-digit number" },
    ];
    delete s.busy[id];
    o.status = "extracted";
    log(
      s,
      `${o.id} validation ${flagged ? "flagged 1 field for human review" : "passed with no flags"}`,
      flagged ? "human" : "ai",
      o,
    );
  });
  if (flagged) toast(`${o.id}: 1 field needs a person to check`, "human");
}

async function save(o: Order, taxId: string, byPerson: boolean) {
  update((s) => {
    o.taxIdFinal = taxId;
    if (byPerson) log(s, `${o.id} reviewer corrected Tax ID → ${taxId}`, "human", o);
    s.busy[o.id] = "api";
  });
  await sleep(700);
  update((s) => {
    delete s.busy[o.id];
    o.status = "saved";
    log(s, `${o.id} saved via POST /api/invoices → Postgres`, "sys", o);
  });
}

/** Nothing was flagged, so the fields are saved without a person. */
async function autoSave(id: string) {
  const o = ready(id, "extracted");
  if (o) await save(o, o.taxId, false);
}

/** A person fixes the flagged field. Returns an error message if the input is invalid. */
export async function approve(id: string, taxIdInput: string): Promise<string | null> {
  const o = ready(id, "extracted");
  if (!o) return null;
  const value = taxIdInput.trim();
  if (!/^\d{13}$/.test(value)) return "Tax ID must be exactly 13 digits.";
  checkpoint(`Fix Tax ID (${id})`);
  await save(o, value, true);
  void advance(id);
  return null;
}

/* ---------- stages 4–5: stock & agentic decision ---------- */

async function checkStock(id: string) {
  const o = ready(id, "saved");
  if (!o) return;
  setBusy(id, "stock");
  await sleep(1000);
  const short = o.items.filter((i) => getState().stock[i.sku] < i.qty);
  update((s) => {
    delete s.busy[id];
    if (short.length) {
      o.status = "short";
      o.shortList = short.map((i) => ({ sku: i.sku, need: i.qty, have: s.stock[i.sku] }));
      log(s, `${o.id} not enough stock (${short.map((i) => i.sku).join(", ")}) → purchasing team notified`, "human", o);
    } else {
      o.status = "ready";
      log(s, `${o.id} stock check passed`, "sys", o);
    }
  });
  if (short.length) toast(`${o.id}: not enough stock, the warehouse needs to decide`, "human");
}

/** A person decides how to restock. */
export async function restock(id: string, mode: "buy" | "build") {
  const o = ready(id, "short");
  if (!o) return;
  checkpoint(`Approve restock (${id})`);
  update((s) => {
    s.busy[id] = "restock";
    o.restockMode = mode;
    log(s, `${o.id} human approved: ${mode === "buy" ? "supplier purchase order" : "production order"} raised`, "human", o);
  });
  await sleep(1400);
  update((s) => {
    o.shortList!.forEach((x) => (s.stock[x.sku] += x.need - x.have + 20));
    log(s, `${o.id} stock replenished (${o.shortList!.map((x) => x.sku).join(", ")})`, "sys", o);
    delete s.busy[id];
    o.status = "saved";
  });
  void advance(id);
}

async function runAgent(id: string) {
  const o = ready(id, "ready");
  if (!o) return;
  const { total } = totals(o);
  const steps = [
    { tool: "get_customer", args: `"${o.customer}"`, result: `account active, credit limit ${baht(CREDIT_LIMIT)}` },
    { tool: "check_credit", result: `outstanding ${baht(OUTSTANDING)} + this order ${baht(total)} is within limit` },
    { tool: "match_prices", result: `${o.items.length}/${o.items.length} line prices match the price list` },
    { tool: "reserve_stock", result: o.items.map((i) => `${i.qty}× ${i.sku}`).join(", ") + " reserved" },
    { tool: "recommend", result: "approve and send to fulfilment" },
  ];
  update((s) => {
    o.agentTrace = [];
    s.busy[id] = "agent";
    log(s, `${o.id} agentic AI validating order`, "ai", o);
  });
  for (const step of steps) {
    await sleep(1100); // slow enough to watch each tool call
    update(() => void o.agentTrace!.push(step));
  }
  await sleep(600);
  update((s) => {
    delete s.busy[id];
    o.status = "decided";
    log(s, `${o.id} agent recommends approval; waiting for a person to confirm`, "human", o);
  });
  toast(`${o.id}: the agent recommends approval. Please confirm.`, "human");
}

/** A person confirms the agent's recommendation, which releases the order. */
export function confirmAgent(id: string) {
  const o = ready(id, "decided");
  if (!o) return;
  checkpoint(`Confirm agent decision (${id})`);
  update((s) => {
    o.status = "released";
    log(s, `${o.id} approval confirmed by a person → released to fulfilment`, "human", o);
  });
  void advance(id);
}

/* ---------- stage 6: fulfilment ---------- */

async function createInvoice(id: string) {
  const o = ready(id, "released");
  if (!o) return;
  setBusy(id, "invoice");
  await sleep(900);
  update((s) => {
    delete s.busy[id];
    o.status = "invoiced";
    log(s, `${o.id} e-invoice + paper copy created; delivery job sent to driver`, "sys", o);
  });
  toast(`${o.id}: delivery job sent to the driver's phone`);
}

/** The driver starts the delivery. */
export function dispatch(id: string) {
  const o = ready(id, "invoiced");
  if (!o) return;
  checkpoint(`Start delivery (${id})`);
  update((s) => {
    o.status = "out";
    log(s, `${o.id} out for delivery`, "human", o);
  });
}

/** The customer signs on the driver's phone. */
export function sign(id: string, signature: string) {
  const o = ready(id, "out");
  if (!o) return;
  checkpoint(`Customer signature (${id})`);
  update((s) => {
    o.signature = signature;
    o.status = "signed";
    log(s, `${o.id} customer accepted and signed`, "human", o);
  });
}

/** The driver photographs the installed fridge. */
export function attachPhoto(id: string, photo?: string) {
  const o = ready(id, "signed");
  if (!o || o.photo) return;
  checkpoint(`Delivery photo (${id})`);
  update((s) => {
    o.photo = photo ?? SAMPLE_PHOTO;
    log(s, `${o.id} delivery photo ${photo ? "uploaded" : "taken"} by driver`, "human", o);
  });
  void advance(id);
}

async function validateProof(id: string) {
  const o = ready(id, "signed");
  if (!o || !o.photo) return;
  const models = o.items.map((i) => CATALOG[i.sku].name).join(" and ");
  const checks = [
    "Fridge is installed and standing level at the customer's site",
    `Model matches the order: ${models}`,
    "No visible damage to the doors or body",
    "Photo timestamp is within the delivery window",
  ];
  update((s) => {
    o.proofChecks = [];
    s.busy[id] = "proof";
    log(s, `${o.id} AI checking delivery photo`, "ai", o);
  });
  for (const c of checks) {
    await sleep(500);
    update(() => void o.proofChecks!.push(c));
  }
  await sleep(300);
  update((s) => {
    delete s.busy[id];
    o.status = "proof_ok";
    log(s, `${o.id} proof of delivery verified by AI`, "ai", o);
  });
}

/* ---------- stage 7: settle ---------- */

/** Accounts confirms the customer has paid. */
export function acceptPayment(id: string, method: string) {
  const o = ready(id, "proof_ok");
  if (!o) return;
  checkpoint(`Accept payment (${id})`);
  const { total } = totals(o);
  update((s) => {
    const time = clock();
    o.payment = { amount: total, method, time };
    s.bank.push({
      ref: `TRX-${88200 + Math.floor(Math.random() * 700)}`,
      time: time.slice(0, 5),
      from: o.customer,
      amount: total,
      desc: `Transfer ${o.id}`,
      matched: false,
      orderId: o.id,
    });
    o.status = "paid";
    log(s, `${o.id} payment of ${baht(total)} accepted (${method})`, "human", o);
  });
  void advance(id);
}

async function matchBank(id: string) {
  const o = ready(id, "paid");
  if (!o) return;
  update((s) => {
    s.busy[id] = "bank";
    log(s, `${o.id} AI querying Bank API`, "ai", o);
  });
  await sleep(1400);
  update((s) => {
    const tx = s.bank.find((t) => t.orderId === o.id)!;
    tx.matched = true;
    o.bankRef = tx.ref;
    delete s.busy[id];
    o.status = "matched";
    log(s, `${o.id} matched to bank transaction ${tx.ref}`, "ai", o);
  });
}

async function updateStock(id: string) {
  const o = ready(id, "matched");
  if (!o) return;
  setBusy(id, "db");
  await sleep(900);
  update((s) => {
    delete s.busy[id];
    o.stockDiff = o.items.map((i) => {
      const before = s.stock[i.sku];
      s.stock[i.sku] = before - i.qty;
      return { sku: i.sku, before, after: s.stock[i.sku] };
    });
    o.status = "closed";
    log(s, `${o.id} stock and database updated (marked paid)`, "sys", o);
  });
}

/* ---------- stage 8: Gmail ---------- */

async function emailInvoice(id: string) {
  const o = ready(id, "closed");
  if (!o) return;
  const draft = draftEmail(o);
  setBusy(id, "send");
  await sleep(1100);
  update((s) => {
    delete s.busy[id];
    o.mail = { ...draft, time: clock(), id: "msg-" + Math.random().toString(16).slice(2, 10) };
    o.status = "emailed";
    log(s, `${o.id} paid invoice emailed to ${draft.to} via Gmail API`, "mail", o);
  });
  toast(`${o.id}: paid invoice emailed to the customer`, "mail");
}

/* ---------- demo controls ---------- */

export function reset() {
  if (!canTravel()) return;
  update((s) => {
    // Start over on the Back office, where invoices come in.
    Object.assign(s, initialState(), { toasts: s.toasts });
  });
  toast("Demo reset");
}
