"use client";

import { useState } from "react";

export default function LoanTypeFields() {
  const [type, setType] = useState<"lan" | "faktura">("lan");
  return (
    <>
      <div className="field">
        <label>Type</label>
        <div className="seg">
          <label className={type === "lan" ? "on" : ""}>
            <input type="radio" name="loan_type" value="lan" checked={type === "lan"} onChange={() => setType("lan")} />
            Lån (gratis)
          </label>
          <label className={type === "faktura" ? "on" : ""}>
            <input type="radio" name="loan_type" value="faktura" checked={type === "faktura"} onChange={() => setType("faktura")} />
            Faktureres
          </label>
        </div>
      </div>
      {type === "faktura" && (
        <div className="grid2">
          <div className="field">
            <label htmlFor="invoice_to">Fakturamottaker</label>
            <input id="invoice_to" name="invoice_to" placeholder="Firma / org.nr" required />
          </div>
          <div className="field">
            <label htmlFor="invoice_email">Faktura-e-post</label>
            <input id="invoice_email" name="invoice_email" type="email" />
          </div>
        </div>
      )}
    </>
  );
}
