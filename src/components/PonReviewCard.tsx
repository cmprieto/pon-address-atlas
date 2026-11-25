import { useEffect, useState } from "react";
import { Check, Download, Plus, Trash2 } from "lucide-react";
import { fillPlantillaPdf } from "@/lib/fill-plantilla";
import { groupText, type Cto, type Finca, type PonGroup } from "@/lib/replanteo";

type Props = {
  group: PonGroup;
  index: number;
  total: number;
  defaultDate: string;
  tecnico: string;
  onTecnicoChange: (v: string) => void;
  blocked: boolean;
  templateUrl: string;
  copied: boolean;
  onCopy: (text: string) => void;
};

const renumber = (list: Cto[]): Cto[] => list.map((c, i) => ({ id: i + 1, numero: c.numero }));

export function PonReviewCard({ group, index, total, defaultDate, tecnico, onTecnicoChange, blocked, templateUrl, copied, onCopy }: Props) {
  const [proyecto, setProyecto] = useState(group.poblacion);
  const [pon, setPon] = useState(group.pon);
  const [fecha, setFecha] = useState(defaultDate);
  const [fincas, setFincas] = useState<Finca[]>(group.fincas);
  const [ctos, setCtos] = useState<Cto[]>(group.ctos);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fecha && defaultDate) setFecha(defaultDate);
  }, [defaultDate, fecha]);

  useEffect(() => {
    setProyecto(group.poblacion);
    setPon(group.pon);
    setFincas(group.fincas);
    setCtos(group.ctos);
    setConfirmed(false);
  }, [group]);

  const currentGroup: PonGroup = { pon, poblacion: proyecto, pages: group.pages, fincas, ctos };

  function updateFinca(idx: number, patch: Partial<Finca>) {
    setFincas((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        return { ...next, calle: [next.tipoVia, next.nombreVia].filter(Boolean).join(" ") };
      }),
    );
  }

  function updateCto(idx: number, numero: string) {
    setCtos((prev) => renumber(prev.map((c, i) => (i === idx ? { ...c, numero } : c))));
  }

  async function downloadPdf() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error("No se pudo cargar la plantilla");
      const bytes = await fillPlantillaPdf(await res.arrayBuffer(), {
        proyecto,
        pon,
        fecha,
        tecnico,
        fincas: fincas.filter((f) => (f.tipoVia || f.nombreVia || f.calle || f.numero).trim()),
        ctos: renumber(ctos.filter((c) => c.numero.trim())),
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const safe = (pon || "PON").replace(/[^a-zA-Z0-9_-]+/g, "_");
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plantilla_${safe}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("No se pudo generar el PDF corporativo");
    } finally {
      setBusy(false);
    }
  }

  const fieldCls = "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

  return (
    <div className="shadow-card rounded-2xl bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase text-muted-foreground">
            {total > 1 ? `Plantilla ${index + 1} de ${total} · ` : ""}Páginas {group.pages.join(", ")}
          </p>
          <h2 className="text-lg font-extrabold uppercase">{pon || "SIN PON"}</h2>
          <p className="text-xs text-muted-foreground">{fincas.length} fincas · {ctos.length} CTO</p>
        </div>
        <button
          type="button"
          disabled={blocked}
          onClick={() => onCopy(groupText(currentGroup))}
          className="rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground disabled:opacity-50"
        >
          {copied ? "¡Copiado!" : "Copiar texto"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Proyecto</span>
          <input value={proyecto} disabled={confirmed} onChange={(e) => setProyecto(e.target.value)} className={fieldCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Zona / PON</span>
          <input value={pon} disabled={confirmed} onChange={(e) => setPon(e.target.value)} className={fieldCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Fecha</span>
          <input value={fecha} disabled={confirmed} onChange={(e) => setFecha(e.target.value)} placeholder="DD/MM/AAAA" className={fieldCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Técnico</span>
          <input value={tecnico} disabled={confirmed} onChange={(e) => onTecnicoChange(e.target.value)} placeholder="Tu nombre" className={fieldCls} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Registro de calles</h3>
          {!confirmed && (
            <button
              type="button"
              onClick={() => setFincas((prev) => [...prev, { tipoVia: "", nombreVia: "", calle: "", numero: "" }])}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir finca
            </button>
          )}
        </div>
        {fincas.length === 0 ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Sin fincas extraídas.</p>
        ) : (
          <div className="space-y-1.5">
            {fincas.map((f, i) => (
              <div key={i} className="grid grid-cols-[4.5rem_1fr_3.5rem_auto] items-center gap-1.5">
                <input aria-label={`Tipo vía ${i + 1}`} value={f.tipoVia ?? ""} disabled={confirmed} placeholder="CALLE" onChange={(e) => updateFinca(i, { tipoVia: e.target.value })} className={fieldCls} />
                <input aria-label={`Nombre vía ${i + 1}`} value={f.nombreVia ?? f.calle} disabled={confirmed} placeholder="Nombre vía" onChange={(e) => updateFinca(i, { nombreVia: e.target.value })} className={fieldCls} />
                <input aria-label={`Nº vía ${i + 1}`} value={f.numero} disabled={confirmed} placeholder="Nº" onChange={(e) => updateFinca(i, { numero: e.target.value })} className={`${fieldCls} text-center font-mono`} />
                {!confirmed && (
                  <button type="button" aria-label={`Eliminar finca ${i + 1}`} onClick={() => setFincas((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-lg p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Registro de CTO</h3>
          {!confirmed && (
            <button
              type="button"
              onClick={() => setCtos((prev) => renumber([...prev, { id: prev.length + 1, numero: "" }]))}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir CTO
            </button>
          )}
        </div>
        {ctos.length === 0 ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Sin CTO detectadas en el plano.</p>
        ) : (
          <div className="space-y-1.5">
            {ctos.map((c, i) => (
              <div key={i} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-1.5">
                <span className="flex h-9 items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">{c.id}</span>
                <input aria-label={`Nº CTO ${c.id}`} value={c.numero} disabled={confirmed} placeholder="Nº CTO" onChange={(e) => updateCto(i, e.target.value)} className={`${fieldCls} font-mono`} />
                {!confirmed && (
                  <button type="button" aria-label={`Eliminar CTO ${c.id}`} onClick={() => setCtos((prev) => renumber(prev.filter((_, idx) => idx !== i)))} className="rounded-lg p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-muted px-3.5 py-3">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={blocked}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        <span className="text-sm font-semibold">
          {confirmed ? "Datos confirmados" : "Confirmo que los datos son correctos"}
        </span>
        {confirmed && <Check className="ml-auto h-4 w-4 text-primary" />}
      </label>

      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

      <button
        type="button"
        disabled={blocked || !confirmed || busy}
        onClick={downloadPdf}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {busy ? "Generando PDF…" : total > 1 ? `Rellenar y descargar PDF (${pon || `PON ${index + 1}`})` : "Rellenar y descargar PDF"}
      </button>
    </div>
  );
}