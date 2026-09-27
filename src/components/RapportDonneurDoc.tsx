import type { ModeleStructure } from "@/lib/rapport-modeles";

type Valeurs = Record<string, string | boolean | null>;

/** Document blanc imprimable, uniquement au logo du donneur d'ordre. */
export function RapportDonneurDoc({
  structure,
  logo,
  donneur,
  valeurs,
  signatureClient,
  signatureTechnicien,
  signataireNom,
  technicien,
  signedAt,
}: {
  structure: ModeleStructure;
  logo?: string | null;
  donneur: string;
  valeurs: Valeurs;
  signatureClient?: string | null;
  signatureTechnicien?: string | null;
  signataireNom?: string | null;
  technicien?: string | null;
  signedAt?: string | null;
}) {
  const aff = (v: string | boolean | null | undefined, type: string) => {
    if (type === "case") return v === true || v === "true" ? "☑" : "☐";
    if (type === "ouinon") return v === "oui" ? "Oui" : v === "non" ? "Non" : v === "na" ? "N/A" : "—";
    return v ? String(v) : "—";
  };
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-6 text-[13px] leading-snug text-slate-900 print:p-0">
      <header className="mb-4 flex items-center justify-between gap-4 border-b border-slate-300 pb-3">
        {logo ? <img src={logo} alt={donneur} className="max-h-16 max-w-[45%] object-contain" /> : <div className="text-lg font-bold">{donneur}</div>}
        <h1 className="text-right text-lg font-bold">{structure.titre}</h1>
      </header>
      {structure.sections.map((s, i) => (
        <section key={i} className="mb-3 break-inside-avoid">
          {s.titre && <h2 className="mb-1 bg-slate-100 px-2 py-1 text-[12px] font-bold uppercase">{s.titre}</h2>}
          <table className="w-full border-collapse">
            <tbody>
              {s.champs.map((c) => (
                <tr key={c.id} className="border-b border-slate-200">
                  <td className="w-3/5 py-1 pr-2 align-top">{c.label}</td>
                  <td className="py-1 align-top font-semibold whitespace-pre-wrap">{aff(valeurs[c.id], c.type)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <div className="mt-6 grid grid-cols-2 gap-4 break-inside-avoid">
        <div className="rounded border border-slate-300 p-2">
          <div className="text-[11px] font-bold uppercase">Technicien {technicien ? `— ${technicien}` : ""}</div>
          {signatureTechnicien ? <img src={signatureTechnicien} alt="Signature technicien" className="h-24 w-full object-contain" /> : <div className="h-24" />}
        </div>
        <div className="rounded border border-slate-300 p-2">
          <div className="text-[11px] font-bold uppercase">Client {signataireNom ? `— ${signataireNom}` : ""}</div>
          {signatureClient ? <img src={signatureClient} alt="Signature client" className="h-24 w-full object-contain" /> : <div className="h-24" />}
        </div>
      </div>
      {signedAt && (
        <p className="mt-2 text-right text-[11px] text-slate-600">
          Signé le {new Date(signedAt).toLocaleDateString("fr-FR")} à{" "}
          {new Date(signedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
