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
        ? "তুমি একজন অভিজ্ঞ ব্যবসায়িক উপদেষ্টা যিনি একদম সহজ বাংলায় কথা বলেন। জটিল শব্দ ব্যবহার করো না। সংখ্যা ও টাকার অঙ্ক স্পষ্ট রাখো। প্রতিটি পয়েন্ট ১-২ লাইনে — যেন একজন সাধারণ ব্যবসায়ীও সহজে বোঝেন।"
        : "You are a business advisor who explains in very simple language. No jargon. Be specific with numbers. Each point 1-2 short sentences.";
    const prompt = `Business metrics JSON:\n${JSON.stringify(data.metrics, null, 2)}\n\nReturn ONLY valid JSON with this exact shape (write Bangla content if lang=bn):
{
  "summary": "৩-৪ লাইনে একদম সহজ সারাংশ — এই মাসে ব্যবসা কেমন চলেছে",
  "problems": ["এই মাসের সমস্যা ১ (আসল সংখ্যাসহ)", "সমস্যা ২", "সমস্যা ৩"],
  "quick_fixes": ["এখনই যা করতে হবে — কাজ ১", "কাজ ২", "কাজ ৩"],
  "develop": ["যা উন্নত/ডেভেলপ করা দরকার — পয়েন্ট ১", "পয়েন্ট ২", "পয়েন্ট ৩"],
  "future_plus": ["ভবিষ্যতে যা যোগ/বাড়ানো উচিত — কাজ ১", "কাজ ২", "কাজ ৩"],
  "future_minus": ["ভবিষ্যতে যা বাদ/কমানো উচিত — কাজ ১", "কাজ ২", "কাজ ৩"],
  "insights": ["গুরুত্বপূর্ণ অবজার্ভেশন ১", "২"],
  "risks": [{"title":"ঝুঁকির নাম","severity":"low|medium|high","detail":"সহজে কী ক্ষতি হতে পারে"}],
  "recommendations": ["সুপারিশ ১", "২"],
  "forecast": "পরের মাসে কী হতে পারে — ২ লাইনে",
  "score": 0-100
}
গুরুত্বপূর্ণ: problems, quick_fixes, develop, future_plus, future_minus — প্রতিটিতে অন্তত ৩টি করে পয়েন্ট দাও। ডেটার আসল সংখ্যা/টাকা ব্যবহার করো।`;
    const { text } = await generateText({
      model: gateway(MODEL),
      system: sys,
      prompt,
    });
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { summary: text, problems: [], quick_fixes: [], develop: [], future_plus: [], future_minus: [], insights: [], risks: [], recommendations: [], forecast: "", score: 0 };
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
