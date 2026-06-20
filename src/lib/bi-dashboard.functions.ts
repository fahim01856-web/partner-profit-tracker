import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MODEL = "google/gemini-2.5-flash";

function provider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

export const analyzeBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        lang: z.enum(["bn", "en"]).default("bn"),
        metrics: z.record(z.string(), z.any()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const gateway = provider();
    const sys =
      data.lang === "bn"
        ? "তুমি একজন অভিজ্ঞ ব্যবসায়িক বিশ্লেষক। বাংলায় সংক্ষিপ্ত, কার্যকর, সংখ্যাভিত্তিক উত্তর দাও।"
        : "You are a senior business analyst. Reply in concise, actionable, number-driven English.";
    const prompt = `Business metrics JSON:\n${JSON.stringify(data.metrics, null, 2)}\n\nReturn ONLY valid JSON with this shape:
{
  "summary": "2-3 sentence executive summary",
  "insights": ["..."],
  "risks": [{"title":"...","severity":"low|medium|high","detail":"..."}],
  "recommendations": ["..."],
  "forecast": "next month outlook in 1-2 sentences",
  "score": 0-100
}`;
    const { text } = await generateText({
      model: gateway(MODEL),
      system: sys,
      prompt,
    });
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { summary: text, insights: [], risks: [], recommendations: [], forecast: "", score: 0 };
    }
  });

export const askBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        lang: z.enum(["bn", "en"]).default("bn"),
        question: z.string().min(1),
        metrics: z.record(z.string(), z.any()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const gateway = provider();
    const sys =
      data.lang === "bn"
        ? "তুমি এজেন্ট ব্যাংকের একজন স্মার্ট AI বিজনেস অ্যানালিস্ট। প্রদত্ত ডেটার উপর ভিত্তি করে বাংলায় সংক্ষিপ্ত, স্পষ্ট উত্তর দাও।"
        : "You are an AI business analyst for an agent bank. Use the data provided to answer concisely.";
    const { text } = await generateText({
      model: gateway(MODEL),
      system: sys,
      prompt: `Data:\n${JSON.stringify(data.metrics)}\n\nQuestion: ${data.question}`,
    });
    return { answer: text };
  });
