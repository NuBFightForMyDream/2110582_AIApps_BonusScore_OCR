import { CATALOG, COMPANY } from "@/lib/data";
import { baht, totals } from "@/lib/format";
import type { Order } from "@/lib/types";

/** The invoice as a document: the uploaded scan, a mock paper scan, or the issued invoice. */
export default function DocView({ o, issued }: { o: Order; issued?: boolean }) {
  if (o.scan && !issued) {
    return (
      <figure className="doc doc-upload">
        <img src={o.scan} alt={`Uploaded scan of invoice ${o.id}`} />
        <figcaption>Uploaded scan, saved as {o.s3.split("/").pop()}</figcaption>
      </figure>
    );
  }
  const { sub, vat, total } = totals(o);
  const paper = o.channel === "paper" && !issued;
  return (
    <article className={`doc ${paper ? "doc-paper" : ""}`} aria-label={`Invoice ${o.id}`}>
      <header className="doc-h">
        <div>
          <b>{issued ? "Tax invoice (e-invoice and paper copy)" : "Tax invoice"}</b>
          <div className="muted">{COMPANY}, Bangkok</div>
        </div>
        <div className="doc-no">
          <b>{o.id}</b>
          <div className="muted">Issued {o.date}</div>
          <div className="muted">Due {o.due}</div>
        </div>
      </header>
      <div className="doc-bill">
        <div className="muted small">Bill to</div>
        <b>{o.customer}</b>
        <div className="mono">Tax ID {o.taxIdFinal ?? o.taxId}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.sku}>
              <td>{CATALOG[i.sku].name}</td>
              <td className="num">{i.qty}</td>
              <td className="num">{baht(CATALOG[i.sku].price)}</td>
              <td className="num">{baht(i.qty * CATALOG[i.sku].price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="doc-tot">
        <dt>Subtotal</dt>
        <dd>{baht(sub)}</dd>
        <dt>VAT 7%</dt>
        <dd>{baht(vat)}</dd>
        <dt>
          <b>Total</b>
        </dt>
        <dd>
          <b>{baht(total)}</b>
        </dd>
      </dl>
      {o.status === "emailed" && issued && <div className="stamp">PAID</div>}
    </article>
  );
}
