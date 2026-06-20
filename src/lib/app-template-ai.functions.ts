import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  prompt: z.string().min(2),
  pasted: z.string().optional(),
});

const Schema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string(),
  body_html: z.string(),
});

const SYSTEM = `তুমি একজন বাংলাদেশী এজেন্ট ব্যাংকিং অ্যাপ্লিকেশন বিশেষজ্ঞ। ব্যবহারকারীর প্রম্পট বা পেস্ট করা টেক্সট থেকে একটি প্রফেশনাল বাংলা ব্যাংক অ্যাপ্লিকেশন তৈরি করো।

ফরম্যাট কাঠামো (অবশ্যই অনুসরণ করো):
তারিখ: {{date}}

বরাবর,
ব্যবস্থাপক
ইসলামী ব্যাংক বাংলাদেশ পিএলসি
এজেন্ট আউটলেট, ফকির বাজার, বুড়িচং

বিষয়: <স্পষ্ট বিষয়>

জনাব,

<মূল আবেদন — গ্রাহকের তথ্য সহ, প্লেসহোল্ডার ব্যবহার করে>

অতএব মহোদয়ের নিকট আমার বিনীত নিবেদন এই যে, ... প্রয়োজনীয় ব্যবস্থা গ্রহণে আপনার মর্জি হয়।

নিবেদক,
{{customer_name}}
হিসাব নং: {{account_number}}
এনআইডি: {{nid}}
মোবাইল: {{mobile}}

প্লেসহোল্ডার অবশ্যই {{key}} ফরম্যাটে রাখো। উপলব্ধ: customer_name, father_name, mother_name, address, account_number, account_type, nid, mobile, date, reason, old_mobile, new_mobile, old_address, new_address, amount, branch_name।
JSON আউটপুট: name (সংক্ষিপ্ত শিরোনাম), category (Account/Service/Loan/KYC/Other), description (এক লাইন), body_html (পুরো আবেদনপত্র টেক্সট)।`;

export const generateAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(key);
    const userMsg = data.pasted
      ? `নিচের পেস্ট করা আবেদন থেকে একটি পুনঃব্যবহারযোগ্য টেমপ্লেট তৈরি করো (নির্দিষ্ট নাম/নম্বরের জায়গায় প্লেসহোল্ডার বসাও):\n\n${data.pasted}\n\nঅতিরিক্ত নির্দেশনা: ${data.prompt}`
      : `নিচের বর্ণনা অনুযায়ী টেমপ্লেট তৈরি করো:\n\n${data.prompt}`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: SYSTEM,
      prompt: userMsg,
      experimental_output: Output.object({ schema: Schema }),
    });
    return experimental_output;
  });
