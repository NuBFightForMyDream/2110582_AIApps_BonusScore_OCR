export type Sku = "FR-MINI" | "FR-1D" | "FR-2D" | "FR-SBS";

export type Channel = "paper" | "e-invoice";

/** Who performs (or performed) a step. */
export type Actor = "ai" | "human" | "sys" | "mail";

export type Status =
  | "stored" // stage 2: raw file in S3, row in Postgres
  | "extracted" // stage 3: OCR/LLM done, waiting for human review
  | "saved" // stage 3: validated + saved via API
  | "short" // stage 4: stock short, waiting for human restock decision
  | "ready" // stage 4: stock OK
  | "released" // stage 5: agent approved
  | "invoiced" // stage 6: invoice created, delivery notified
  | "out" // stage 6: out for delivery
  | "signed" // stage 6: customer signed
  | "proof_ok" // stage 7: AI verified delivery photo
  | "paid" // stage 7: human accepted payment
  | "matched" // stage 7: AI matched bank transaction
  | "closed" // stage 7: stock + DB updated
  | "emailed"; // stage 8: invoice emailed via Gmail

export type BusyKind =
  | "ocr"
  | "llm"
  | "api"
  | "stock"
  | "restock"
  | "agent"
  | "invoice"
  | "proof"
  | "bank"
  | "db"
  | "send";

export interface LineItem {
  sku: Sku;
  qty: number;
}

export interface ExtractedField {
  label: string;
  value: string;
  confidence: number; // 0..1
  flagged?: boolean;
  key?: "taxId";
}

export interface Check {
  ok: boolean;
  text: string;
}

export interface AgentStep {
  tool: string;
  args?: string;
  result: string;
}

export interface TimelineEntry {
  t: string;
  msg: string;
  actor: Actor;
}

export interface Order {
  id: string;
  channel: Channel;
  customer: string;
  email: string;
  taxId: string; // the true value printed on the document
  ocrTaxId: string; // what the OCR read (may contain a misread)
  taxIdFinal?: string; // value after human review
  items: LineItem[];
  date: string;
  due: string;
  status: Status;
  s3: string;
  scan?: string; // uploaded image (data URL)
  fields?: ExtractedField[];
  checks?: Check[];
  shortList?: { sku: Sku; need: number; have: number }[];
  restockMode?: "buy" | "build";
  agentTrace?: AgentStep[];
  signature?: string;
  photo?: string;
  proofChecks?: string[];
  payment?: { amount: number; method: string; time: string };
  bankRef?: string;
  stockDiff?: { sku: Sku; before: number; after: number }[];
  mail?: { to: string; subject: string; body: string; time: string; id: string };
  timeline: TimelineEntry[];
}

export interface BankTx {
  ref: string;
  time: string;
  from: string;
  amount: number;
  desc: string;
  matched: boolean;
  orderId?: string;
}

export interface LogEntry {
  t: string;
  msg: string;
  actor: Actor;
  orderId?: string;
}

export interface Toast {
  id: number;
  msg: string;
  actor?: Actor;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}
