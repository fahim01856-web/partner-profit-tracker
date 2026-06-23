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
        hint: z.string().optional(),
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
      .map((o) => `- ${o.id} :: ${o.label}${o.group ? ` [${o.group}]` : ""}`)
      .join("\n");

    const system = `You are a voice-command router for a Bengali/English banking admin web app.
The user speaks Bangla or English (often with typos, mispronunciation, partial words, mixed languages, or just a feature/page name).
Your job: ALWAYS pick the SINGLE best matching command id from the list — even if the match is loose, partial, semantic, or only thematically related.

Rules:
- Use semantic understanding (synonyms, related concepts, Bangla↔English meaning) — not just exact keyword overlap.
- If the user names ANY topic, page, feature, report, person-type, or action that ANY command in the list could plausibly serve, return that command's id.
- Only reply NONE if the input is total gibberish, silence, or completely unrelated to a banking/admin app (e.g. weather, jokes).
- Reply with ONLY the id token (e.g. cmd_12) or NONE. No explanation, no punctuation, no quotes.`;

    const prompt = `Available commands:\n${list}\n\nUser said: "${data.transcript}"\n\nBest matching id:`;

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
