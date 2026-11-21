"use client";

/*
 * Mock services. Every "API call" below is a timed delay plus a state change
 * in the browser. Nothing talks to S3, Postgres, an OCR model, an LLM, a bank
 * or Gmail. Each function is named after the real step it stands in for.
 */

import { samplePhoto } from "./canvas";
import { CREDIT_LIMIT, OUTSTANDING, TEMPLATES } from "./data";
import { baht, clock, totals } from "./format";
import { getState, initialState, update, type State } from "./store";
import type { Actor, BusyKind, Channel, EmailDraft, Order, Status } from "./types";

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

function makeOrder(s: State, channel: Channel, scan?: string): Order {
  const tpl = channel === "paper" ? TEMPLATES[s.paperIdx++ % 2 === 0 ? 2 : 3] : TEMPLATES[s.nextNo % 2];
  const id = `INV-${s.nextNo++}`;
  const o: Order = {
    id,
    channel,
    customer: tpl.customer,
    email: tpl.email,
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

/* ---------- navigation ---------- */

export function select(id: string | null) {
  update((s) => void (s.selected = id));
}

/* ---------- stages 1–2: intake & storage ---------- */

export function fetchEInvoices(): string {
  let first = "";
  update((s) => {
    const batch = [makeOrder(s, "e-invoice"), makeOrder(s, "e-invoice")];
    batch.forEach((o) => log(s, `${o.id} fetched from e-invoice system → stored at ${o.s3}`, "sys", o));
    first = batch[0].id;
    if (!s.selected) s.selected = first;
  });
  toast("2 e-invoices fetched and stored in S3 + Postgres");
  return first;
}

export function scanPaper(scan?: string): string {
  let id = "";
  update((s) => {
    const o = makeOrder(s, "paper", scan);
    log(s, `${o.id} paper invoice scanned → stored at ${o.s3}`, "sys", o);
    s.selected = id = o.id;
  });
  toast(`${id} scanned and stored`);
  return id;
}

/* ---------- stage 3: extract & validate ---------- */

export async function extract(id: string) {
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
  if (flagged) toast(`${o.id}: 1 field needs human review`, "human");
}

/** Human approves the extracted fields. Returns an error message if the input is invalid. */
export async function approve(id: string, taxIdInput?: string): Promise<string | null> {
  const o = ready(id, "extracted");
  if (!o) return null;
  const flagged = o.fields?.some((f) => f.flagged);
  const value = (flagged ? taxIdInput ?? "" : o.taxId).trim();
  if (!/^\d{13}$/.test(value)) return "Tax ID must be exactly 13 digits.";

  update((s) => {
    o.taxIdFinal = value;
    if (flagged) log(s, `${o.id} reviewer corrected Tax ID → ${value}`, "human", o);
    else log(s, `${o.id} reviewer confirmed extracted fields`, "human", o);
    s.busy[id] = "api";
  });
  await sleep(700);
  update((s) => {
    delete s.busy[id];
    o.status = "saved";
    log(s, `${o.id} saved via POST /api/invoices → Postgres`, "sys", o);
  });
  toast(`${o.id} saved to database via API`);
  return null;
}

/* ---------- stages 4–5: stock & agentic decision ---------- */

export async function checkStock(id: string) {
  const o = ready(id, "saved");
  if (!o) return;
  setBusy(id, "stock");
  await sleep(900);
  const s0 = getState();
  const short = o.items.filter((i) => s0.stock[i.sku] < i.qty);
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
  if (short.length) toast(`${o.id}: stock short — a person has been notified`, "human");
}

export async function restock(id: string, mode: "buy" | "build") {
  const o = ready(id, "short");
  if (!o) return;
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
  await checkStock(id);
}

export async function runAgent(id: string) {
  const o = ready(id, "ready");
  if (!o) return;
  const { total } = totals(o);
  const steps = [
    { tool: "get_customer", args: `"${o.customer}"`, result: `account active, credit limit ${baht(CREDIT_LIMIT)}` },
    { tool: "check_credit", result: `outstanding ${baht(OUTSTANDING)} + this order ${baht(total)} is within limit` },
    { tool: "match_prices", result: `${o.items.length}/${o.items.length} line prices match the price list` },
    { tool: "reserve_stock", result: o.items.map((i) => `${i.qty}× ${i.sku}`).join(", ") + " reserved" },
    { tool: "decide", result: "APPROVE · route to fulfilment" },
  ];
  update((s) => {
    o.agentTrace = [];
    s.busy[id] = "agent";
    log(s, `${o.id} agentic AI validating order`, "ai", o);
  });
  for (const step of steps) {
    await sleep(650);
    update(() => void o.agentTrace!.push(step));
  }
  await sleep(400);
  update((s) => {
    delete s.busy[id];
    o.status = "released";
    log(s, `${o.id} approved by agent → released to fulfilment`, "ai", o);
  });
  toast(`${o.id} approved and released`, "ai");
}

/* ---------- stage 6: fulfilment ---------- */

export async function createInvoice(id: string) {
  const o = ready(id, "released");
  if (!o) return;
  setBusy(id, "invoice");
  await sleep(800);
  update((s) => {
    delete s.busy[id];
    o.status = "invoiced";
    log(s, `${o.id} e-invoice + paper copy created; delivery team notified`, "sys", o);
  });
  toast("Delivery team notified (mock push)");
}

export function dispatch(id: string) {
  const o = ready(id, "invoiced");
  if (!o) return;
  update((s) => {
    o.status = "out";
    log(s, `${o.id} out for delivery`, "sys", o);
  });
}

export function sign(id: string, signature: string) {
  const o = ready(id, "out");
  if (!o) return;
  update((s) => {
    o.signature = signature;
    o.status = "signed";
    log(s, `${o.id} customer accepted and signed`, "human", o);
  });
}

export function attachPhoto(id: string, photo?: string) {
  const o = ready(id, "signed");
  if (!o) return;
  update((s) => {
    o.photo = photo ?? samplePhoto(o);
    log(s, `${o.id} delivery photo ${photo ? "uploaded" : "taken by delivery team"}`, "sys", o);
  });
}

export async function validateProof(id: string) {
  const o = ready(id, "signed");
  if (!o || !o.photo) return;
  const checks = [
    "Signature detected on delivery note",
    `Invoice number ${o.id} readable`,
    "Item count matches the order",
    "Photo timestamp within delivery window",
  ];
  update((s) => {
    o.proofChecks = [];
    s.busy[id] = "proof";
    log(s, `${o.id} AI checking delivery photo`, "ai", o);
  });
  for (const c of checks) {
    await sleep(450);
    update(() => void o.proofChecks!.push(c));
  }
  await sleep(300);
  update((s) => {
    delete s.busy[id];
    o.status = "proof_ok";
    log(s, `${o.id} proof of delivery verified and signed off by AI`, "ai", o);
  });
  toast(`${o.id} proof verified`, "ai");
}

/* ---------- stage 7: settle ---------- */

export function acceptPayment(id: string, method: string) {
  const o = ready(id, "proof_ok");
  if (!o) return;
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
    log(s, `${o.id} staff accepted payment ${baht(total)} (${method}); invoice sent to AI`, "human", o);
  });
}

export async function matchBank(id: string) {
  const o = ready(id, "paid");
  if (!o) return;
  update((s) => {
    s.busy[id] = "bank";
    log(s, `${o.id} AI querying Bank API`, "ai", o);
  });
  await sleep(1400);
  let ref = "";
  update((s) => {
    const tx = s.bank.find((t) => t.orderId === o.id)!;
    tx.matched = true;
    o.bankRef = ref = tx.ref;
    delete s.busy[id];
    o.status = "matched";
    log(s, `${o.id} matched to bank transaction ${tx.ref}`, "ai", o);
  });
  toast(`Matched ${ref} to ${o.id}`, "ai");
}

export async function updateStock(id: string) {
  const o = ready(id, "matched");
  if (!o) return;
  setBusy(id, "db");
  await sleep(800);
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

export function compose(id: string | null) {
  update((s) => void (s.composeFor = id));
}

export async function sendEmail(id: string, draft: EmailDraft) {
  const o = ready(id, "closed");
  if (!o) return;
  setBusy(id, "send");
  await sleep(1000);
  update((s) => {
    delete s.busy[id];
    o.mail = { ...draft, time: clock(), id: "msg-" + Math.random().toString(16).slice(2, 10) };
    o.status = "emailed";
    s.composeFor = null;
    log(s, `${o.id} invoice emailed to ${draft.to} via Gmail API`, "mail", o);
  });
  toast(`Invoice ${o.id} emailed to customer (mock)`, "mail");
}

/* ---------- demo controls ---------- */

export function reset() {
  const s0 = getState();
  if (Object.keys(s0.busy).length) return;
  update((s) => {
    const toasts = s.toasts;
    Object.assign(s, initialState(), { toasts });
  });
  toast("Demo reset");
}

