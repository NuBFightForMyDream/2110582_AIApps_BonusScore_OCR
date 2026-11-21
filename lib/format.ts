import { CATALOG, COMPANY, STATUS_ORDER } from "./data";
import type { EmailDraft, Order, Status } from "./types";

export const baht = (n: number) =>
  "฿" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const clock = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function totals(o: Pick<Order, "items">) {
  const sub = o.items.reduce((a, i) => a + i.qty * CATALOG[i.sku].price, 0);
  const vat = Math.round(sub * 7) / 100;
  return { sub, vat, total: sub + vat };
}

/** True if the order has reached (or passed) the given status. */
export const reached = (o: Order, st: Status) => STATUS_ORDER.indexOf(o.status) >= STATUS_ORDER.indexOf(st);

export function draftEmail(o: Order): EmailDraft {
  const { total } = totals(o);
  return {
    to: o.email,
    subject: `Invoice ${o.id} — payment received`,
    body:
      `Dear ${o.customer},\n\n` +
      `Thank you — we have received your payment of ${baht(total)} (bank ref ${o.bankRef}).\n` +
      `Your paid invoice ${o.id} is attached for your records.\n\n` +
      `Kind regards,\nAccounts Team\n${COMPANY}`,
  };
}
