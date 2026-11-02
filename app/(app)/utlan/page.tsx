import Link from "next/link";
import { setInvoiced } from "@/app/actions";
import Messages from "@/components/Messages";
import PrintButton from "@/components/PrintButton";
import ReturnForm from "@/components/ReturnForm";
import { date, isOverdue, today } from "@/lib/format";
import { requireUser } from "@/lib/supabase-server";
import type { Loan } from "@/lib/types";

const TABS = [
  { key: "aktive", label: "Ute nå" },
  { key: "forsinket", label: "Forsinket" },
  { key: "faktura", label: "Til fakturering" },
  { key: "fakturert", label: "Fakturert" },
  { key: "historikk", label: "Historikk" },
] as const;

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string; feil?: string; ok?: string }>;
}) {
  const { vis = "aktive", feil, ok } = await searchParams;
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";

  let query = supabase
    .from("loans")
    .select("*, items(name, image_path), profiles(full_name)")
    .limit(500);
  if (vis === "faktura") query = query.eq("loan_type", "faktura").is("invoiced_at", null).order("start_date");
  else if (vis === "fakturert")
    query = query.eq("loan_type", "faktura").not("invoiced_at", "is", null).order("invoiced_at", { ascending: false });
  else if (vis === "historikk") query = query.not("returned_at", "is", null).order("due_date", { ascending: false });
  else {
    // PostgREST kan ikke sammenligne to kolonner, så «åpne» filtreres på returned_at.
    query = query.is("returned_at", null).order("due_date");
    if (vis === "forsinket") query = query.lt("due_date", today());
  }

  const { data, error } = await query;
  const loans = (data ?? []) as Loan[];
  const back = `/utlan?vis=${vis}`;
  const invoiceView = vis === "faktura" || vis === "fakturert";
  const tabLabel = TABS.find((t) => t.key === vis)?.label ?? "";

  return (
    <>
      <div className="row spread">
        <h1>Utlån</h1>
        {loans.length > 0 && <PrintButton label="Skriv ut liste" />}
      </div>
      <div className="tabs no-print" style={{ flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/utlan?vis=${t.key}`} className={vis === t.key ? "on" : ""}>
            {t.label}
          </Link>
        ))}
      </div>
      <h2 className="print-only">{tabLabel} · utskrevet {date(today())}</h2>
      <Messages feil={feil ?? error?.message} ok={ok} />
      {loans.length === 0 && <p className="muted">Ingen utlån her.</p>}
      {loans.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Vare</th>
                <th>Antall</th>
                <th>{invoiceView ? "Fakturamottaker" : "Låntaker"}</th>
                <th>Periode</th>
                <th className="hide-mobile">Utlånt av</th>
                <th className="hide-mobile">Beskrivelse</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const outstanding = l.quantity - l.returned_qty;
                return (
                  <tr key={l.id} className={!invoiceView && isOverdue(l) ? "overdue" : ""}>
                    <td>
                      <Link href={`/varer/${l.item_id}`}>{l.items?.name ?? "Slettet vare"}</Link>
                      {l.loan_type === "faktura" && !invoiceView && (
                        <div><span className="badge inv">Faktureres</span></div>
                      )}
                    </td>
                    <td className="qty">
                      {outstanding < l.quantity && outstanding > 0 ? `${outstanding} av ${l.quantity}` : l.quantity}
                    </td>
                    <td>
                      {invoiceView ? (
                        <>
                          {l.invoice_to || l.borrower_company || l.borrower_name}
                          {l.invoice_email && <div className="muted small">{l.invoice_email}</div>}
                          <div className="muted small">Kontakt: {l.borrower_name}{l.borrower_phone && `, ${l.borrower_phone}`}</div>
                        </>
                      ) : (
                        <>
                          {l.borrower_name}
                          {l.borrower_company && <div className="muted small">{l.borrower_company}</div>}
                          {l.borrower_phone && <div className="muted small">{l.borrower_phone}</div>}
                        </>
                      )}
                    </td>
                    <td className="small">
                      {date(l.start_date)} – {date(l.due_date)}
                      {!invoiceView && isOverdue(l) && <div><span className="badge warn">Forsinket</span></div>}
                      {l.returned_at && <div className="muted">Levert {date(l.returned_at.slice(0, 10))}</div>}
                      {l.invoiced_at && <div className="muted">Fakturert {date(l.invoiced_at.slice(0, 10))}</div>}
                    </td>
                    <td className="hide-mobile small">{l.profiles?.full_name}</td>
                    <td className="hide-mobile small" style={{ whiteSpace: "pre-wrap", maxWidth: 260 }}>
                      {l.description}
                    </td>
                    <td className="no-print">
                      <div className="loan-list" style={{ gap: 6 }}>
                        {!invoiceView && outstanding > 0 && (
                          <ReturnForm loanId={l.id} outstanding={outstanding} back={back} />
                        )}
                        {invoiceView && isAdmin && (
                          <form action={setInvoiced}>
                            <input type="hidden" name="loan_id" value={l.id} />
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="done" value={vis === "faktura" ? "1" : "0"} />
                            <button className="btn" type="submit">
                              {vis === "faktura" ? "Marker fakturert" : "Angre fakturert"}
                            </button>
                          </form>
                        )}
                        <Link href={`/utlan/${l.id}/skjema`} className="btn">Skjema</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
