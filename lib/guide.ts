"use client";

/*
 * Step-by-step guided demo. Nothing runs on a timer: the guide works out the
 * next step from the followed invoice's current status, shows what will
 * happen, and runs it only when the user presses Next. Users can also press
 * the real button in the step card instead — the guide just follows along.
 */

import * as act from "./actions";
import { demoSignature } from "./canvas";
import { draftEmail } from "./format";
import { getState, update, type State } from "./store";
import type { Actor, Order } from "./types";

export interface GuideStep {
  n: number;
  stage: number;
  actor: Actor | "done";
  title: string;
  text: string;
  /** Label for the Next button; absent when the user must act themselves. */
  next?: string;
  run?: () => unknown;
}

export const GUIDE_TOTAL = 17;

export function startGuide() {
  update((s) => void (s.guide = { orderId: null }));
}

export function exitGuide() {
  update((s) => void (s.guide = null));
}

export function guideOrder(s: State): Order | undefined {
  const id = s.guide?.orderId;
  return id ? s.orders.find((o) => o.id === id) : undefined;
}

/** Runs the current step's action, keeping the followed invoice on screen. */
export function runGuideStep() {
  const s = getState();
  const o = guideOrder(s);
  if (o && s.busy[o.id]) return;
  if (o && s.selected !== o.id) act.select(o.id);
  guideStep(s).run?.();
}

export function guideStep(s: State): GuideStep {
  const o = guideOrder(s);
  if (!o) {
    return {
      n: 1,
      stage: 1,
      actor: "sys",
      title: "Scan a paper invoice",
      text: "A paper invoice is scanned. The raw image goes to S3 and a record is created in Postgres.",
      next: "Scan sample invoice",
      run: () => {
        const id = act.scanPaper();
        update((st) => void (st.guide = { orderId: id }));
      },
    };
  }
  const id = o.id;

  switch (o.status) {
    case "stored":
      return {
        n: 2, stage: 3, actor: "ai",
        title: "Read the scan",
        text: "A local OCR model reads the fields from the image, then an LLM checks that they make sense.",
        next: "Read invoice",
        run: () => act.extract(id),
      };
    case "extracted":
      return {
        n: 3, stage: 3, actor: "human",
        title: "Fix the flagged Tax ID",
        text: "The LLM spotted a letter O where a zero should be. Type the fix in the card, or let the guide apply the AI suggestion.",
        next: "Use AI suggestion and save",
        run: () => act.approve(id, o.taxId),
      };
    case "saved":
      return {
        n: 4, stage: 4, actor: "sys",
        title: "Check stock",
        text: "Each order line is compared against the stock table in the database.",
        next: "Check stock",
        run: () => act.checkStock(id),
      };
    case "short":
      return {
        n: 5, stage: 4, actor: "human",
        title: "Approve a restock",
        text: "Only 6 side-by-side fridges are in the warehouse and the order needs 9. A person decides how to restock: buy from the supplier or order a production run.",
        next: "Buy from supplier",
        run: () => act.restock(id, "buy"),
      };
    case "ready":
      return {
        n: 6, stage: 5, actor: "ai",
        title: "Agent validates the order",
        text: "An AI agent calls tools to check the customer, their credit, the prices and the stock, then decides.",
        next: "Run agent",
        run: () => act.runAgent(id),
      };
    case "released":
      return {
        n: 7, stage: 6, actor: "sys",
        title: "Create the invoice",
        text: "One event creates the e-invoice and a paper copy, and notifies the delivery team.",
        next: "Create invoice",
        run: () => act.createInvoice(id),
      };
    case "invoiced":
      return {
        n: 8, stage: 6, actor: "sys",
        title: "Dispatch",
        text: "The truck is loaded and the order goes out for delivery.",
        next: "Dispatch",
        run: () => act.dispatch(id),
      };
    case "out":
      return {
        n: 9, stage: 6, actor: "human",
        title: "Customer signs",
        text: "The customer accepts the goods. Draw a signature in the card and confirm, or let the guide sign.",
        next: "Sign for me",
        run: () => act.sign(id, demoSignature()),
      };
    case "signed":
      return o.photo
        ? {
            n: 11, stage: 6, actor: "ai",
            title: "AI checks the photo",
            text: "The AI looks for the signature, the invoice number and the item count on the delivery note.",
            next: "Verify photo",
            run: () => act.validateProof(id),
          }
        : {
            n: 10, stage: 6, actor: "sys",
            title: "Photograph the delivery note",
            text: "The delivery team takes a photo of the signed note as proof of delivery.",
            next: "Use sample photo",
            run: () => act.attachPhoto(id),
          };
    case "proof_ok":
      return {
        n: 12, stage: 7, actor: "human",
        title: "Accept the payment",
        text: "Delivery is proven. Staff record the customer's payment and pass the invoice to the AI.",
        next: "Accept payment",
        run: () => act.acceptPayment(id, "Bank transfer"),
      };
    case "paid":
      return {
        n: 13, stage: 7, actor: "ai",
        title: "Match with the bank",
        text: "The AI finds the matching incoming transfer through the Bank API. Open the Bank tab on the right to watch it.",
        next: "Match payment",
        run: () => act.matchBank(id),
      };
    case "matched":
      return {
        n: 14, stage: 7, actor: "sys",
        title: "Update stock and database",
        text: "Delivered items are taken out of stock and the invoice is marked paid. This closes the loop with stage 4.",
        next: "Update stock and database",
        run: () => act.updateStock(id),
      };
    case "closed":
      return s.composeFor === id
        ? {
            n: 16, stage: 8, actor: "mail",
            title: "Send the email",
            text: "Read the draft and edit it if you like. Send it from the Gmail window, or let the guide send it as written.",
            next: "Send email",
            run: () => act.sendEmail(id, draftEmail(o)),
          }
        : {
            n: 15, stage: 8, actor: "mail",
            title: "Draft the Gmail invoice",
            text: "A receipt email is drafted with the paid invoice attached.",
            next: "Draft email in Gmail",
            run: () => act.compose(id),
          };
    case "emailed":
      return {
        n: GUIDE_TOTAL, stage: 8, actor: "done",
        title: "Paid and closed",
        text: "Nine side-by-side and six two-door fridges went from a paper order to a paid invoice in the customer's inbox. A person stepped in four times: the Tax ID, the restock, the signature and the payment.",
        next: "Finish",
        run: exitGuide,
      };
  }
}
