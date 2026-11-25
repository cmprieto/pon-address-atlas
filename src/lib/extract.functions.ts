import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PROMPT = `Eres un asistente de replanteos FTTH. Recibes la imagen de un plano.
Extrae:
- "pon": el nombre/código del PON de la cabecera o cajetín, SIN el texto "hoja X de Y".
- "poblacion": la población/municipio de la cabecera.
- "fincas": TODAS las fincas marcadas en el plano, cada una con "tipoVia" (tipo de vía como CALLE, AVDA, PLAZA, PASEO, etc., o vacío si no aparece), "nombreVia" (nombre de la calle sin el tipo de vía), "calle" (tipo de vía + nombre de la calle) y "numero" (número de portal/finca). Si la misma calle y número aparece varias veces en este plano, inclúyela tantas veces como aparezca.
- "ctos": TODOS los números/códigos de CTO que aparezcan marcados en el plano, en orden de lectura (ej. ["CTO-01","CTO-02"] o el código/número exacto del plano).
Responde SOLO con JSON: {"pon":"","poblacion":"","fincas":[{"tipoVia":"","nombreVia":"","calle":"","numero":""}],"ctos":[""]}`;

const Out = z.object({
  pon: z.string().catch(""),
  poblacion: z.string().catch(""),
  fincas: z
    .array(
      z.object({
        tipoVia: z.coerce.string().catch(""),
        nombreVia: z.coerce.string().catch(""),
        calle: z.coerce.string().catch(""),
        numero: z.coerce.string(),
      }),
    )
    .catch([]),
  ctos: z.array(z.coerce.string()).catch([]),
});

export const extractPage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ image: z.string().startsWith("data:image/").max(12_000_000), page: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateChatCompletion } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateChatCompletion({
        model: "openai/gpt-6-astra",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      });
      const text = String(res.choices?.[0]?.message?.content ?? "");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      return { page: data.page, ...Out.parse(JSON.parse(json || "{}")), error: null as string | null };
    } catch (e) {
      console.error("extractPage failed", e);
      return { page: data.page, pon: "", poblacion: "", fincas: [], ctos: [], error: "No se pudo leer esta página" };
    }
  });
