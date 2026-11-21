import type { Actor, BankTx, Sku, Status } from "./types";

export const CATALOG: Record<Sku, { name: string; price: number }> = {
  "FR-MINI": { name: "Mini bar fridge 85 L", price: 4290 },
  "FR-1D": { name: "Single-door fridge 180 L", price: 6990 },
  "FR-2D": { name: "Two-door fridge 340 L, inverter", price: 12900 },
  "FR-SBS": { name: "Side-by-side fridge 600 L", price: 32900 },
};

export interface CustomerTemplate {
  customer: string;
  email: string;
  address: string;
  taxId: string;
  /** Simulated OCR misread (letter O instead of zero). */
  ocrTaxId?: string;
  items: [Sku, number][];
}

/** First two arrive as e-invoices, last two as paper scans. */
export const TEMPLATES: CustomerTemplate[] = [
  {
    customer: "Chaiyaporn Electric Ltd.",
    email: "accounts@chaiyaporn-electric.example",
    address: "88 Rama IV Rd, Khlong Toei, Bangkok 10110",
    taxId: "0105559012345",
    items: [["FR-2D", 12], ["FR-1D", 20]],
  },
  {
    customer: "Rattana Home Store",
    email: "billing@rattana-home.example",
    address: "214 Ngamwongwan Rd, Mueang, Nonthaburi 11000",
    taxId: "0105561098765",
    items: [["FR-SBS", 4], ["FR-MINI", 10]],
  },
  {
    customer: "Siam Appliance Co.",
    email: "finance@siamappliance.example",
    address: "1/9 Phetkasem Rd, Bang Khae, Bangkok 10160",
    taxId: "0105548021187",
    ocrTaxId: "0105548O21187",
    items: [["FR-SBS", 9], ["FR-2D", 6]],
  },
  {
    customer: "Lumpini Residence Hotel",
    email: "ap@lumpini-residence.example",
    address: "35 Wireless Rd, Pathum Wan, Bangkok 10330",
    taxId: "0105563044120",
    ocrTaxId: "01O5563044120",
    items: [["FR-MINI", 24], ["FR-1D", 4]],
  },
];

export const STATUS: Record<Status, { label: string; stage: number }> = {
  stored: { label: "Stored", stage: 2 },
  extracted: { label: "Needs review", stage: 3 },
  saved: { label: "Validated", stage: 3 },
  short: { label: "Stock short", stage: 4 },
  ready: { label: "Stock OK", stage: 4 },
  decided: { label: "Agent recommends approval", stage: 5 },
  released: { label: "Order released", stage: 5 },
  invoiced: { label: "Invoice created", stage: 6 },
  out: { label: "Out for delivery", stage: 6 },
  signed: { label: "Customer signed", stage: 6 },
  proof_ok: { label: "Proof verified", stage: 7 },
  paid: { label: "Payment received", stage: 7 },
  matched: { label: "Bank matched", stage: 7 },
  closed: { label: "Stock updated", stage: 7 },
  emailed: { label: "Complete", stage: 8 },
};

export const STATUS_ORDER = Object.keys(STATUS) as Status[];

/** Who has to act next for an order in a given status, and what they do. */
export const NEXT: Record<Status, { actor: Actor; what: string } | null> = {
  stored: { actor: "ai", what: "Run OCR + LLM check" },
  extracted: { actor: "human", what: "Review extracted fields" },
  saved: { actor: "sys", what: "Check stock" },
  short: { actor: "human", what: "Approve restock" },
  ready: { actor: "ai", what: "Run agentic validation" },
  decided: { actor: "human", what: "Confirm the agent's decision" },
  released: { actor: "sys", what: "Create invoice" },
  invoiced: { actor: "sys", what: "Dispatch delivery" },
  out: { actor: "human", what: "Collect customer signature" },
  signed: { actor: "ai", what: "Verify delivery photo" },
  proof_ok: { actor: "human", what: "Accept payment" },
  paid: { actor: "ai", what: "Match payment via Bank API" },
  matched: { actor: "sys", what: "Update stock & database" },
  closed: { actor: "mail", what: "Email paid invoice" },
  emailed: null,
};

export const STAGES: { n: number; name: string; detail: string; actors: Actor[] }[] = [
  { n: 1, name: "Intake", detail: "Paper invoice scanned or e-invoice fetched", actors: ["sys"] },
  { n: 2, name: "Store", detail: "Raw file to S3, record to Postgres", actors: ["sys"] },
  { n: 3, name: "Extract & validate", detail: "Local OCR, LLM check, human review of flags", actors: ["ai", "human"] },
  { n: 4, name: "Check stock", detail: "Compare order against the stock table", actors: ["sys", "human"] },
  { n: 5, name: "Agentic decision", detail: "Agent checks customer, credit, prices, reserves stock", actors: ["ai"] },
  { n: 6, name: "Fulfil", detail: "Invoice, delivery, customer signature, AI photo proof", actors: ["sys", "human", "ai"] },
  { n: 7, name: "Settle", detail: "Payment accepted, bank match, stock write-back", actors: ["human", "ai", "sys"] },
  { n: 8, name: "Gmail invoice", detail: "Paid invoice emailed to the customer", actors: ["mail"] },
];

export const ACTOR_LABEL: Record<Actor, string> = {
  ai: "AI",
  human: "Human",
  sys: "System",
  mail: "Gmail",
};

export const INITIAL_STOCK: Record<Sku, number> = {
  "FR-MINI": 60,
  "FR-1D": 45,
  "FR-2D": 30,
  "FR-SBS": 6,
};

/** Used to draw the stock bars. */
export const STOCK_FULL = 60;

export const INITIAL_BANK: BankTx[] = [
  { ref: "TRX-88120", time: "09:14", from: "Bangkok Compressor Parts", amount: -186400, desc: "Supplier payment", matched: true },
  { ref: "TRX-88131", time: "10:02", from: "Nonthaburi Electric", amount: 92650, desc: "INV-2033", matched: true },
];

export const CREDIT_LIMIT = 1500000;
export const OUTSTANDING = 142300;

export const COMPANY = "FlowLedger Appliance Distribution";
