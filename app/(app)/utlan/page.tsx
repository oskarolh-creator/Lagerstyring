import Link from "next/link";
import Messages from "@/components/Messages";
import ReturnForm from "@/components/ReturnForm";
import { date, isOverdue, today } from "@/lib/format";
import { requireUser } from "@/lib/supabase-server";
import type { Loan } from "@/lib/types";

const TABS = [
  { key: "aktive", label: "Ute nå" },
  { key: "forsinket", label: "Forsinket" },
  { key: "historikk", label: "Historikk" },
] as const;

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string; feil?: string; ok?: string }>;
}) {
  const { vis = "aktive", feil, ok } = await searchParams;
  const { supabase } = await requireUser();

  let query = supabase
    .from("loans")
    .select("*, items(name, image_path), profiles(full_name)")
    .order("due_date", { ascending: vis !== "historikk" })
    .limit(300);
  // PostgREST kan ikke sammenligne to kolonner, så "åpne" filtreres på returned_at.
  if (vis === "historikk") query = query.not("returned_at", "is", null);
  else query = query.is("returned_at", null);
  if (vis === "forsinket") query = query.lt("due_date", today());

  const { data, error } = await query;
  const loans = (data ?? []) as Loan[];
  const back = `/utlan?vis=${vis}`;

  return (
    <>
      <h1>Utlån</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/utlan?vis=${t.key}`} className={vis === t.key ? "on" : ""}>
            {t.label}
          </Link>
        ))}
      </div>
      <Messages feil={feil ?? error?.message} ok={ok} />
      {loans.length === 0 && <p className="muted">Ingen utlån her.</p>}
      {loans.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Vare</th>
                <th>Antall</th>
                <th>Låntaker</th>
                <th>Periode</th>
                <th className="hide-mobile">Utlånt av</th>
                <th className="hide-mobile">Beskrivelse</th>
                {vis !== "historikk" && <th>Retur</th>}
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const outstanding = l.quantity - l.returned_qty;
                return (
                  <tr key={l.id} className={isOverdue(l) ? "overdue" : ""}>
                    <td>
                      <Link href={`/varer/${l.item_id}`}>{l.items?.name ?? "Slettet vare"}</Link>
                    </td>
                    <td className="qty">
                      {outstanding < l.quantity && outstanding > 0 ? `${outstanding} av ${l.quantity}` : l.quantity}
                    </td>
                    <td>
                      {l.borrower_name}
                      {l.borrower_company && <div className="muted small">{l.borrower_company}</div>}
                      {l.borrower_phone && <div className="muted small">{l.borrower_phone}</div>}
                    </td>
                    <td className="small">
                      {date(l.start_date)} – {date(l.due_date)}
                      {isOverdue(l) && <div><span className="badge warn">Forsinket</span></div>}
                      {l.returned_at && <div className="muted">Levert {date(l.returned_at.slice(0, 10))}</div>}
                    </td>
                    <td className="hide-mobile small">{l.profiles?.full_name}</td>
                    <td className="hide-mobile small" style={{ whiteSpace: "pre-wrap", maxWidth: 260 }}>
                      {l.description}
                    </td>
                    {vis !== "historikk" && (
                      <td>
                        <ReturnForm loanId={l.id} outstanding={outstanding} back={back} />
                      </td>
                    )}
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
