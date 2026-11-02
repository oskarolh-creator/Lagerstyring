import Link from "next/link";
import { notFound } from "next/navigation";
import Messages from "@/components/Messages";
import PrintButton from "@/components/PrintButton";
import { date, location } from "@/lib/format";
import { requireUser } from "@/lib/supabase-server";
import type { Loan } from "@/lib/types";

type LoanWithItem = Loan & {
  items: { name: string; image_path: string | null; category: string; zone: string; rack: string; shelf: string } | null;
};

export default async function LoanSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("loans")
    .select("*, items(name, image_path, category, zone, rack, shelf), profiles(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const l = data as LoanWithItem;
  const outstanding = l.quantity - l.returned_qty;

  return (
    <>
      <div className="row spread no-print" style={{ marginBottom: 16 }}>
        <Link href={`/varer/${l.item_id}`} className="muted small">← Til varen</Link>
        <PrintButton label="Skriv ut skjema" />
      </div>
      <div className="no-print"><Messages ok={ok} /></div>

      <div className="sheet">
        <div className="row spread">
          <h1 style={{ margin: 0 }}>Utlånsskjema</h1>
          <strong>{l.loan_type === "faktura" ? "FAKTURERES" : "LÅN"}</strong>
        </div>
        <p className="small" style={{ color: "#555" }}>
          Nr. {l.id.slice(0, 8).toUpperCase()} · Registrert {date(l.created_at.slice(0, 10))}
        </p>

        <table>
          <tbody>
            <tr><th>Utstyr</th><td>{l.items?.name ?? "Slettet vare"} ({l.items?.category})</td></tr>
            <tr><th>Antall</th><td><strong>{l.quantity} stk</strong>{l.returned_qty > 0 && ` (${l.returned_qty} levert tilbake, ${outstanding} ute)`}</td></tr>
            <tr><th>Hentes fra</th><td>{l.items ? location(l.items) : ""}</td></tr>
            <tr><th>Periode</th><td>{date(l.start_date)} – {date(l.due_date)}</td></tr>
            <tr><th>Låntaker</th><td>{l.borrower_name}{l.borrower_company && `, ${l.borrower_company}`}{l.borrower_phone && ` · Tlf ${l.borrower_phone}`}</td></tr>
            {l.loan_type === "faktura" && (
              <tr><th>Fakturamottaker</th><td>{l.invoice_to}{l.invoice_email && ` · ${l.invoice_email}`}</td></tr>
            )}
            <tr><th>Utlånt av</th><td>{l.profiles?.full_name}</td></tr>
            <tr><th>Beskrivelse</th><td style={{ whiteSpace: "pre-wrap", height: 90 }}>{l.description}</td></tr>
            <tr><th>Merknader ved retur</th><td style={{ height: 70 }}></td></tr>
          </tbody>
        </table>

        <p className="small" style={{ color: "#555" }}>
          Låntaker er ansvarlig for utstyret i låneperioden og skal levere det tilbake i samme stand innen
          avtalt dato.
        </p>

        <div className="sign">
          <div>Dato og signatur låntaker</div>
          <div>Dato og signatur utlåner</div>
        </div>
      </div>
    </>
  );
}
