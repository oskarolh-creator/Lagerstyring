import { returnLoan } from "@/app/actions";

export default function ReturnForm({
  loanId,
  outstanding,
  back,
}: {
  loanId: string;
  outstanding: number;
  back: string;
}) {
  return (
    <form action={returnLoan} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <input type="hidden" name="loan_id" value={loanId} />
      <input type="hidden" name="back" value={back} />
      <input
        name="return_qty"
        type="number"
        min={1}
        max={outstanding}
        defaultValue={outstanding}
        style={{ width: 80 }}
        aria-label="Antall tilbake"
      />
      <button className="btn" type="submit">Registrer retur</button>
    </form>
  );
}
