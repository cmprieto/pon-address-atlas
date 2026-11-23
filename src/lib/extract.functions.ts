import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PROMPT = `Eres un asistente de replanteos FTTH. Recibes la imagen de un plano.
Extrae:
- "pon": el nombre/código del PON que aparece en la cabecera o cajetín del plano.
- "poblacion": la población/municipio de la cabecera.
- "fincas": TODAS las fincas marcadas en el plano, cada una con "calle" (nombre de la calle, con tipo de vía si aparece) y "numero" (número de portal/finca). Si la misma calle y número aparece varias veces en este plano, inclúyela tantas veces como aparezca.
Responde SOLO con JSON: {"pon":"","poblacion":"","fincas":[{"calle":"","numero":""}]}`;

const Out = z.object({
  pon: z.string().catch(""),
  poblacion: z.string().catch(""),
  fincas: z.array(z.object({ calle: z.coerce.string(), numero: z.coerce.string() })).catch([]),
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
      return { page: data.page, pon: "", poblacion: "", fincas: [], error: "No se pudo leer esta página" };
    }
  });
