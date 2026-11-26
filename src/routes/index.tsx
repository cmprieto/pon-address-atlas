import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import plantillaPdf from "@/assets/plantilla-area-influencia.pdf.asset.json";
import { PonReviewCard } from "@/components/PonReviewCard";
import { extractPage } from "@/lib/extract.functions";
import { buildGroups, findConflicts, nextAiRenewalDate, parsePages, tomorrowDate, toText, type PageResult } from "@/lib/replanteo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Replanteo AI — Fincas desde planos FTTH" },
      { name: "description", content: "Sube los planos PDF y obtén el listado de calles y fincas con PON y población." },
      { property: "og:title", content: "Replanteo AI" },
      { property: "og:description", content: "Extrae el listado de fincas de tus planos FTTH desde el móvil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Doc = { numPages: number; getPage: (n: number) => Promise<any> };

async function loadPdf(file: File): Promise<Doc> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise as unknown as Promise<Doc>;
}

async function renderPage(doc: Doc, n: number) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, 2400 / Math.max(base.width, base.height));
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

function Index() {
  const extract = useServerFn(extractPage);
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [pagesInput, setPagesInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<PageResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [creditsNotice, setCreditsNotice] = useState<{ renewalDate: string; stoppedAtPage: number } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean | undefined>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [tecnico, setTecnico] = useState("Carlos P.");
  const [fechaDefecto, setFechaDefecto] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("replanteo_tecnico");
    if (saved !== null) setTecnico(saved);
    setFechaDefecto(tomorrowDate());
  }, []);

  function updateTecnico(v: string) {
    setTecnico(v);
    localStorage.setItem("replanteo_tecnico", v);
  }

  function resetApp() {
    setFile(null);
    setDoc(null);
    setPagesInput("");
    setProgress("");
    setResults([]);
    setErrors([]);
    setCreditsNotice(null);
    setDecisions({});
    setCopied(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const conflicts = useMemo(() => findConflicts(results), [results]);
  const pending = conflicts.filter((c) => decisions[c.key] === undefined);
  const dec = useMemo(() => Object.fromEntries(Object.entries(decisions).map(([k, v]) => [k, !!v])), [decisions]);
  const groups = useMemo(() => buildGroups(results, dec), [results, dec]);
  const copy = async (id: string, t: string) => { await navigator.clipboard.writeText(t); setCopied(id); setTimeout(() => setCopied(null), 1500); };
  const pages = doc ? parsePages(pagesInput, doc.numPages) : [];

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFile(f); setResults([]); setDecisions({}); setErrors([]); setCreditsNotice(null);
    try {
      const d = await loadPdf(f);
      setDoc(d);
      setPagesInput(`1-${d.numPages}`);
    } catch {
      setErrors(["No se pudo abrir el PDF"]);
    }
  }

  async function run() {
    if (!doc || !pages.length) return;
    setBusy(true); setResults([]); setDecisions({}); setErrors([]); setCreditsNotice(null);
    const out: PageResult[] = [];
    const errs: string[] = [];
    for (const [i, n] of pages.entries()) {
      setProgress(`Leyendo página ${n} (${i + 1}/${pages.length})…`);
      try {
        const image = await renderPage(doc, n);
        const r = await extract({ data: { image, page: n } });
        if (r.errorCode === "credits_exhausted") {
          setCreditsNotice({ renewalDate: r.renewalDate || nextAiRenewalDate(), stoppedAtPage: n });
          break;
        }
        if (r.error) errs.push(`Página ${n}: ${r.error}`);
        out.push(r);
        setResults([...out]);
      } catch {
        errs.push(`Página ${n}: error al procesar`);
      }
    }
    setErrors(errs); setProgress(""); setBusy(false);
  }

  const done = results.length > 0 && !busy;

  return (
    <main className="mx-auto min-h-screen max-w-lg pb-16">
      <header className="bg-hero rounded-b-[2rem] px-6 pb-10 pt-10 text-primary-foreground">
        <p className="font-mono text-xs uppercase tracking-[0.25em] opacity-80">Digi · FTTH</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Replanteo AI</h1>
        <p className="mt-2 text-sm opacity-90">Del plano PDF al listado de fincas, en un toque.</p>
      </header>

      <section className="-mt-6 space-y-4 px-4">
        <div className="shadow-card rounded-2xl bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">1 · Planos</h2>
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-secondary/50 px-4 py-8 text-center active:scale-[0.99]">
            <span className="text-base font-semibold text-primary">{file ? file.name : "Subir PDF de planos"}</span>
            <span className="mt-1 text-xs text-muted-foreground">
              {doc ? `${doc.numPages} páginas` : "Toca para elegir el archivo"}
            </span>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          {doc && (
            <div className="mt-4">
              <label className="text-sm font-semibold text-muted-foreground" htmlFor="pages">2 · Páginas a tratar</label>
              <input
                id="pages"
                value={pagesInput}
                onChange={(e) => setPagesInput(e.target.value)}
                placeholder="Ej: 2-4, 7"
                inputMode="text"
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-base outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {pages.length ? `Se leerán: ${pages.join(", ")}` : "Indica páginas válidas"}
              </p>
              <button
                onClick={run}
                disabled={busy || !pages.length}
                className="mt-4 w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? progress : "Extraer fincas y CTO"}
              </button>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        {creditsNotice && (
          <div role="alert" className="shadow-card rounded-2xl border-2 border-accent bg-card p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-foreground">Créditos de IA agotados</h2>
                <p className="text-sm text-foreground">
                  No se pudo analizar el plano porque se han agotado los créditos de IA disponibles para leer páginas
                  {results.length > 0 ? ` (detenido en la página ${creditsNotice.stoppedAtPage}).` : "."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Próxima renovación de los créditos gratuitos: <strong className="text-foreground">{creditsNotice.renewalDate}</strong> (00:00 UTC), o en tu fecha de facturación si tienes un plan de pago. Para continuar antes, añade créditos o cambia a un plan de pago.
                </p>
              </div>
            </div>
          </div>
        )}

        {done && conflicts.length > 0 && (
          <div className="shadow-card rounded-2xl border-2 border-accent bg-card p-5">
            <h2 className="font-bold">Fincas repetidas en planos distintos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Puede que sean la misma finca. ¿Añado la repetición?</p>
            <ul className="mt-3 space-y-3">
              {conflicts.map((c) => (
                <li key={c.key} className="rounded-xl bg-muted p-3">
                  <p className="font-semibold">{c.calle} {c.numero}</p>
                  <p className="text-xs text-muted-foreground">PON {c.pons.join(", ")} · Páginas {c.pages.join(", ")}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([true, false] as const).map((v) => (
                      <button
                        key={String(v)}
                        onClick={() => setDecisions((d) => ({ ...d, [c.key]: v }))}
                        className={`rounded-lg py-2 text-sm font-semibold ${decisions[c.key] === v ? (v ? "bg-primary text-primary-foreground" : "bg-foreground text-background") : "bg-card text-foreground"}`}
                      >
                        {v ? "Sí, añadir" : "No"}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {results.length > 0 && (
          <>
            {pending.length > 0 && !busy && (
              <p className="px-1 text-xs font-semibold text-accent-foreground">Responde las {pending.length} repeticiones pendientes para cerrar los listados.</p>
            )}
            {groups.length > 1 && (
              <button
                disabled={pending.length > 0 || busy}
                onClick={() => copy("__all", toText(results, dec))}
                className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                {copied === "__all" ? "¡Copiado!" : `Copiar los ${groups.length} PON`}
              </button>
            )}
            {groups.map((g, i) => (
              <PonReviewCard
                key={g.pon}
                group={g}
                index={i}
                total={groups.length}
                defaultDate={fechaDefecto}
                tecnico={tecnico}
                onTecnicoChange={updateTecnico}
                blocked={pending.length > 0 || busy}
                templateUrl={plantillaPdf.url}
                copied={copied === g.pon}
                onCopy={(t) => copy(g.pon, t)}
              />
            ))}
            {!busy && (
              <button
                type="button"
                onClick={resetApp}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card py-3.5 text-sm font-bold text-foreground shadow-card active:scale-[0.99]"
              >
                <RotateCcw className="h-4 w-4" />
                Empezar de nuevo y subir otros planos
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
