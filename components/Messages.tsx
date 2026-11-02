const OK: Record<string, string> = {
  utlan: "Utlånet er registrert.",
  retur: "Returen er registrert.",
  "1": "Lagret.",
};

export default function Messages({ feil, ok }: { feil?: string; ok?: string }) {
  return (
    <>
      {feil && <div className="error">{feil}</div>}
      {ok && OK[ok] && <div className="notice">{OK[ok]}</div>}
    </>
  );
}
