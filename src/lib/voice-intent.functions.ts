import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  transcript: z.string().min(1).max(500),
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        group: z.string().optional(),
      })
    )
    .min(1)
    .max(200),
});

export const resolveVoiceIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const list = data.options
      .map((o) => `- ${o.id} :: ${o.label}${o.group ? ` (${o.group})` : ""}`)
      .join("\n");

    const system = `You are a voice-command router for a Bengali/English banking admin app.
The user spoke (possibly with typos, mispronunciation, or partial words) in Bangla or English.
Pick the SINGLE best matching command id from the list, even if the wording is wrong or approximate.
If absolutely nothing is even loosely related, reply with NONE.
Reply with ONLY the id (one token) or NONE. No explanation, no punctuation.`;

    const prompt = `Commands:\n${list}\n\nUser said: "${data.transcript}"\n\nBest id:`;

    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature: 0,
    });

    const raw = text.trim().split(/\s+/)[0]?.replace(/[^\w-]/g, "") ?? "";
    if (!raw || raw.toUpperCase() === "NONE") return { id: null as string | null };
    const found = data.options.find((o) => o.id === raw);
    return { id: found ? found.id : null };
  });
