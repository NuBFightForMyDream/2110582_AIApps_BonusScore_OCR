"use client";

/*
 * Step-by-step guided demo. The guide follows one invoice and works out the
 * current step from its status. Human steps wait for the user to press Next
 * (or do the step themselves on the screen). Automatic steps have no button:
 * the guide just narrates them while they run.
 */

import * as act from "./actions";
import { demoSignature } from "./canvas";
import { ROLE_OF, type Role } from "./roles";
import { getState, update, type State } from "./store";
import type { Actor, Order } from "./types";

export interface GuideStep {
  n: number;
  /** The screen this step happens on. */
  role: Role;
  stage: number;
  actor: Actor | "done";
  title: string;
  text: string;
  /** True when the step runs by itself. */
  auto?: boolean;
  /** Label for the Next button on human steps. */
  next?: string;
  run?: () => unknown;
}

export const GUIDE_TOTAL = 17;

/** Starts the walkthrough by scanning the sample invoice straight away. */
export function startGuide() {
  if (!act.canTravel()) return;
  const id = act.scanPaper();
  update((s) => {
    s.guide = { orderId: id };
    s.role = "admin";
  });
}

export function exitGuide() {
  update((s) => void (s.guide = null));
}

export function guideOrder(s: State): Order | undefined {
  const id = s.guide?.orderId;
  return id ? s.orders.find((o) => o.id === id) : undefined;
}

/** Goes forward: replays an undone step if there is one, otherwise does the human step. */
export function runGuideStep() {
  const s = getState();
  const step = guideStep(s);
  if (step.auto || !act.canTravel()) return;
  if (s.future.length && step.actor !== "done") return act.redo();
  const o = guideOrder(s);
  if (o && s.selected !== o.id) act.select(o.id);
  step.run?.();
}

export function guideStep(s: State): GuideStep {
  const o = guideOrder(s);
  return { ...stepFor(o), role: o ? ROLE_OF[o.status] : "admin" };
}

const auto = (n: number, stage: number, actor: Actor, title: string, text: string): Omit<GuideStep, "role"> => ({
  n,
  stage,
  actor,
  title,
  text,
  auto: true,
});

function stepFor(o: Order | undefined): Omit<GuideStep, "role"> {
  if (!o) {
    return {
      n: 1, stage: 1, actor: "human",
      title: "Scan a paper invoice",
      text: "A clerk scans a retailer's paper order. Everything after this runs by itself until a person is needed.",
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
      return auto(2, 3, "ai", "AI reads the invoice",
        "The scan is saved to S3 and Postgres. A local OCR model reads the fields and an LLM checks them. No one has to press anything.");
    case "extracted":
      return o.fields?.some((f) => f.flagged)
        ? {
            n: 3, stage: 3, actor: "human",
            title: "A person checks the flagged field",
            text: "The LLM spotted a letter O where a zero should be in the Tax ID. This is where a person steps in: fix it in the review form, or use the AI suggestion.",
            next: "Use AI suggestion and save",
            run: () => act.approve(id, o.taxId),
          }
        : auto(3, 3, "sys", "Fields saved", "Nothing was flagged, so the invoice is saved without a person.");
    case "saved":
      return auto(4, 4, "sys", "Warehouse system checks stock",
        "The order lines are compared with the stock table automatically.");
    case "short":
      return {
        n: 5, stage: 4, actor: "human",
        title: "Approve a restock",
        text: "Only 6 side-by-side fridges are in the warehouse and the order needs 9. The system stopped here because a person has to decide: buy from the supplier or order a production run.",
        next: "Buy from supplier",
        run: () => act.restock(id, "buy"),
      };
    case "ready":
      return auto(6, 5, "ai", "Agent checks the order",
        "An AI agent calls tools to check the customer, their credit, the prices and the stock. It only recommends; it does not release the order on its own.");
    case "decided":
      return {
        n: 7, stage: 5, actor: "human",
        title: "Confirm the agent's decision",
        text: "The agent recommends approving the order. A person confirms before anything ships. Use the pop-up, or the task in the back office.",
        next: "Approve order",
        run: () => act.confirmAgent(id),
      };
    case "released":
      return auto(8, 6, "sys", "Invoice created, job sent to the driver",
        "The e-invoice and a paper copy are created and the delivery appears on the driver's phone.");
    case "invoiced":
      return {
        n: 9, stage: 6, actor: "human",
        title: "Driver starts the delivery",
        text: "The driver loads the truck and taps Start delivery on their phone.",
        next: "Start delivery",
        run: () => act.dispatch(id),
      };
    case "out":
      return {
        n: 10, stage: 6, actor: "human",
        title: "Customer signs",
        text: "The customer accepts the fridges and signs on the driver's phone. Draw a signature, or let the guide sign.",
        next: "Sign for me",
        run: () => act.sign(id, demoSignature()),
      };
    case "signed":
      return o.photo
        ? auto(12, 6, "ai", "AI checks the photo",
            "The AI checks that the right model was delivered, that it is installed and that nothing is damaged.")
        : {
            n: 11, stage: 6, actor: "human",
            title: "Driver photographs the fridge",
            text: "The driver takes a photo of the fridge in place as proof of delivery. Tap the shutter, or let the guide take it.",
            next: "Take photo",
            run: () => act.attachPhoto(id),
          };
    case "proof_ok":
      return {
        n: 13, stage: 7, actor: "human",
        title: "Accounts accepts the payment",
        text: "Delivery is proven. A person in Accounts confirms the customer has paid. Everything after this is automatic.",
        next: "Accept payment",
        run: () => act.acceptPayment(id, "Bank transfer"),
      };
    case "paid":
      return auto(14, 7, "ai", "AI matches the payment",
        "The AI finds the incoming transfer through the Bank API and checks the amount, payer and reference.");
    case "matched":
      return auto(15, 7, "sys", "Stock and database updated",
        "The delivered fridges come out of stock and the invoice is marked paid. This closes the loop with stage 4.");
    case "closed":
      return auto(16, 8, "mail", "Paid invoice emailed",
        "The paid invoice is emailed to the customer through the Gmail API.");
    case "emailed":
      return {
        n: GUIDE_TOTAL, stage: 8, actor: "done",
        title: "Paid and closed",
        text: "This is the customer's inbox with the paid invoice. People only stepped in where judgement or a signature was needed: the Tax ID, the restock, the agent's decision, the delivery, the signature, the photo and the payment. Everything else ran by itself.",
        next: "Finish",
        run: exitGuide,
      };
  }
}
