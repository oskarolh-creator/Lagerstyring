import Link from "next/link";
import { notFound } from "next/navigation";
import { createLoan } from "@/app/actions";
import Messages from "@/components/Messages";
import LoanTypeFields from "@/components/LoanTypeFields";
import ReturnForm from "@/components/ReturnForm";
import { date, imageUrl, isOverdue, location, today } from "@/lib/format";
import { requireUser } from "@/lib/supabase-server";
import type { Item, Loan } from "@/lib/types";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feil?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { feil, ok } = await searchParams;
  const { supabase, profile } = await requireUser();

  const { data: item } = await supabase
    .from("items_with_availability")
    .select("*")
    .eq("id", id)
    .maybeSingle<Item>();
  if (!item) notFound();

  const { data: loanData } = await supabase
    .from("loans")
    .select("*, profiles(full_name)")
    .eq("item_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const loans = (loanData ?? []) as Loan[];
  const open = loans.filter((l) => l.returned_qty < l.quantity);
  const closed = loans.filter((l) => l.returned_qty >= l.quantity).slice(0, 10);
  const src = imageUrl(item.image_path);
  const back = `/varer/${id}`;

  return (
    <>
      <div className="row spread">
        <Link href="/" className="muted small">← Alle varer</Link>
        {profile.role === "admin" && (
          <Link href={`/varer/${id}/rediger`} className="btn">Rediger vare</Link>
        )}
      </div>
      <h1 style={{ marginTop: 12 }}>{item.name}</h1>
      <Messages feil={feil} ok={ok} />

      <div className="detail">
        <div>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="big" src={src} alt={item.name} />
          ) : (
            <div className="thumb empty card">Ingen bilde</div>
          )}
          {item.description && <p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p>}
          <p className="muted small">Kategori: {item.category}</p>
        </div>

        <div>
          <div className="loc">📍 {location(item)}</div>
          <div className="stats">
            <div className="stat"><div className="n">{item.available_qty}</div><div className="l">Ledig</div></div>
            <div className="stat"><div className="n">{item.out_qty}</div><div className="l">Utlånt</div></div>
            <div className="stat"><div className="n">{item.total_qty}</div><div className="l">Totalt</div></div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Kvitter ut utlån</h2>
            {item.available_qty < 1 ? (
              <p className="muted">Ingen ledige akkurat nå.</p>
            ) : (
              <form action={createLoan}>
                <input type="hidden" name="item_id" value={item.id} />
                <LoanTypeFields />
                <div className="field">
                  <label htmlFor="quantity">Antall (maks {item.available_qty})</label>
                  <input id="quantity" name="quantity" type="number" min={1} max={item.available_qty} required />
                </div>
                <div className="field">
                  <label htmlFor="borrower_name">Hvem låner (navn)</label>
                  <input id="borrower_name" name="borrower_name" required />
                </div>
                <div className="grid2">
                  <div className="field">
                    <label htmlFor="borrower_company">Firma / event</label>
                    <input id="borrower_company" name="borrower_company" />
                  </div>
                  <div className="field">
                    <label htmlFor="borrower_phone">Telefon</label>
                    <input id="borrower_phone" name="borrower_phone" type="tel" />
                  </div>
                </div>
                <div className="grid2">
                  <div className="field">
                    <label htmlFor="start_date">Fra</label>
                    <input id="start_date" name="start_date" type="date" defaultValue={today()} required />
                  </div>
                  <div className="field">
                    <label htmlFor="due_date">Til (retur)</label>
                    <input id="due_date" name="due_date" type="date" required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="description">Beskrivelse</label>
                  <textarea id="description" name="description" placeholder="Hva skal det brukes til, levering, tilstand osv." />
                </div>
                <p className="muted small">Utlånt av: {profile.full_name}</p>
                <button className="btn primary" type="submit" style={{ width: "100%" }}>Registrer utlån</button>
              </form>
            )}
          </div>
        </div>
      </div>

      <h2>Ute nå ({open.length})</h2>
      {open.length === 0 && <p className="muted">Ingen aktive utlån.</p>}
      <div className="loan-list">
        {open.map((l) => (
          <LoanCard key={l.id} l={l} back={back} />
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <h2>Siste returnerte</h2>
          <div className="loan-list">
            {closed.map((l) => (
              <LoanCard key={l.id} l={l} back={back} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function LoanCard({ l, back }: { l: Loan; back: string }) {
  const outstanding = l.quantity - l.returned_qty;
  const late = isOverdue(l);
  return (
    <div className="card loan">
      <div className="row spread">
        <strong>
          {outstanding < l.quantity && outstanding > 0
            ? `${outstanding} av ${l.quantity} ute`
            : `${l.quantity} stk`}{" "}
          · {l.borrower_name}
          {l.borrower_company && ` (${l.borrower_company})`}
        </strong>
        <span className="row" style={{ gap: 6 }}>
          {l.loan_type === "faktura" && <span className="badge inv">Faktureres</span>}
          {late ? (
            <span className="badge warn">Forsinket</span>
          ) : outstanding === 0 ? (
            <span className="badge ok">Returnert</span>
          ) : null}
        </span>
      </div>
      <div className="muted small">
        {date(l.start_date)} – {date(l.due_date)} · Utlånt av {l.profiles?.full_name ?? "ukjent"}
        {l.borrower_phone && ` · Tlf ${l.borrower_phone}`}
      </div>
      {l.description && <div style={{ whiteSpace: "pre-wrap" }}>{l.description}</div>}
      <div className="row">
        {outstanding > 0 && <ReturnForm loanId={l.id} outstanding={outstanding} back={back} />}
        <Link href={`/utlan/${l.id}/skjema`} className="btn">Utlånsskjema</Link>
      </div>
    </div>
  );
}
