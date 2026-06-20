import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ACCOUNTS = ["AWCA", "MSA", "MSSA", "MMPDSA", "MTDRA", "MHSA", "SMSA", "MFSA"] as const;

const Input = z.object({
  imageDataUrl: z.string().min(20), // data:image/...;base64,...
});

export type AbOcrResult = Partial<Record<(typeof ACCOUNTS)[number], number>> & {
  date?: string | null;
  raw?: string;
};

const SYSTEM = `You are an OCR + parser for an Islami Bank Agent Banking daily balance report image.
Extract today's CLOSING BALANCE (or current balance) for each account-type code that appears in the image.
Possible codes (Bangla/English variants may appear): AWCA, MSA, MSSA, MMPDSA, MTDRA, MHSA, SMSA, MFSA.
Match common aliases:
- AWCA = Al-Wadeeah Current Account
- MSA  = Mudaraba Savings Account
- MSSA = Mudaraba Special Savings (Scheme) / MSS
- MMPDSA = Mudaraba Monthly Profit Deposit Scheme
- MTDRA = Mudaraba Term Deposit Receipt (MTDR)
- MHSA = Mudaraba Hajj Savings
- SMSA = Students Mudaraba Savings
- MFSA = Mudaraba Farmers Savings
Numbers may be in Bangla digits (০-৯) or English. Strip commas. Return amounts as plain numbers (BDT).
If a code is not present in the image, OMIT it from the JSON.
Also try to extract the report date if visible as ISO yyyy-mm-dd in "date".
Respond with ONLY valid JSON, no markdown, no commentary. Schema:
{ "date": "yyyy-mm-dd"|null, "AWCA"?: number, "MSA"?: number, "MSSA"?: number, "MMPDSA"?: number, "MTDRA"?: number, "MHSA"?: number, "SMSA"?: number, "MFSA"?: number }`;

export const ocrAgentBankingBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<AbOcrResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract balances from this image. JSON only." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";

    // Strip markdown fences if any
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to find a JSON object in the text
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { parsed = {}; }
      }
    }

    const out: AbOcrResult = { date: parsed?.date ?? null, raw: content };
    for (const a of ACCOUNTS) {
      const v = parsed?.[a];
      if (v != null && !isNaN(Number(v))) (out as any)[a] = Number(v);
    }
    return out;
  });
