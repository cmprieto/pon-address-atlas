import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { extractPage } from "@/lib/extract.functions";
import { findConflicts, headerOf, parsePages, toText, type PageResult } from "@/lib/replanteo";

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
  const [decisions, setDecisions] = useState<Record<string, boolean | undefined>>({});
  const [copied, setCopied] = useState(false);

  const conflicts = useMemo(() => findConflicts(results), [results]);
  const pending = conflicts.filter((c) => decisions[c.key] === undefined);
  const text = useMemo(
    () => toText(results, Object.fromEntries(Object.entries(decisions).map(([k, v]) => [k, !!v]))),
    [results, decisions],
  );
  const pages = doc ? parsePages(pagesInput, doc.numPages) : [];

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFile(f); setResults([]); setDecisions({}); setErrors([]);
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
    setBusy(true); setResults([]); setDecisions({}); setErrors([]);
    const out: PageResult[] = [];
    const errs: string[] = [];
    for (const [i, n] of pages.entries()) {
      setProgress(`Leyendo página ${n} (${i + 1}/${pages.length})…`);
      try {
        const image = await renderPage(doc, n);
        const r = await extract({ data: { image, page: n } });
        if (r.error) errs.push(`Página ${n}: ${r.error}`);
        out.push(r);
        setResults([...out]);
      } catch {
        errs.push(`Página ${n}: error al procesar`);
      }
    }
    setErrors(errs); setProgress(""); setBusy(false);
  }

  const header = headerOf(results);
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
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
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
                {busy ? progress : "Extraer fincas"}
              </button>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {errors.map((e) => <p key={e}>{e}</p>)}
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
                  <p className="text-xs text-muted-foreground">Páginas {c.pages.join(", ")}</p>
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
          <div className="shadow-card rounded-2xl bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">PON</p>
                <p className="font-bold">{header.pon || "—"}</p>
                <p className="mt-1 font-mono text-xs uppercase text-muted-foreground">Población</p>
                <p className="font-bold">{header.poblacion || "—"}</p>
              </div>
              <button
                disabled={pending.length > 0 || busy}
                onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            {pending.length > 0 && !busy && (
              <p className="mt-3 text-xs font-semibold text-accent-foreground">Responde las {pending.length} repeticiones pendientes para cerrar el listado.</p>
            )}
            <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 font-mono text-sm">{text}</pre>
          </div>
        )}
      </section>
    </main>
  );
}
