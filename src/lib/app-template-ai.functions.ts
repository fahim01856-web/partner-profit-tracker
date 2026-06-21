import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  prompt: z.string().optional(),
  pasted: z.string().optional(),
  image: z.string().optional(), // data:image/...;base64,...
});

const Schema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string(),
  body_html: z.string(),
});

const SYSTEM = `তুমি একজন বাংলাদেশী এজেন্ট ব্যাংকিং অ্যাপ্লিকেশন বিশেষজ্ঞ। ব্যবহারকারীর প্রম্পট, পেস্ট করা টেক্সট, অথবা আপলোড করা ছবি থেকে একটি প্রফেশনাল বাংলা ব্যাংক অ্যাপ্লিকেশন টেমপ্লেট তৈরি করো।

ছবি দেওয়া হলে (অত্যন্ত গুরুত্বপূর্ণ):
- ছবিতে যা দেখছো হুবহু ১০০% সেম ফরম্যাটে HTML বানাও — একই হেডিং, একই টেবিল কাঠামো, একই সারি/কলাম, একই ক্রম, একই লেবেল।
- ফর্মের প্রতিটি field/cell একটি <table> এর <td> হিসেবে রাখো (border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:SolaimanLipi,serif").
- যেখানে গ্রাহকের নির্দিষ্ট তথ্য আছে (নাম, হিসাব নং, NID, মোবাইল, ঠিকানা, অ্যামাউন্ট, তারিখ, রাউটিং, ব্যাংক, শাখা ইত্যাদি) সেখানে {{placeholder}} বসাও — যাতে এডিট করা যায়।
- চেকবক্স/ডিজিট-বক্স থাকলে একই রকম রেন্ডার করো (<span style="border:1px solid #000;display:inline-block;width:18px;height:22px;margin:0 1px"></span>)।
- কোনো লেআউট পরিবর্তন করবে না — যেমন আছে তেমন রাখো।

প্লেসহোল্ডার অবশ্যই {{key}} ফরম্যাটে: customer_name, father_name, mother_name, address, account_number, account_title, account_type, nid, mobile, date, day, month, year, reason, amount, total_amount, branch_name, bank_name, routing_no, cheque_no, cheque_date, sender_name, receiver_name, receiver_account, commission, vat ইত্যাদি।

JSON আউটপুট: name (সংক্ষিপ্ত শিরোনাম), category (Account/Service/Loan/KYC/Remittance/Other), description (এক লাইন), body_html (পুরো HTML — টেবিল সহ)।`;

export const generateAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    if (!data.prompt && !data.pasted && !data.image) throw new Error("prompt, pasted বা image যেকোনো একটি দিন");
    const gateway = createLovableAiGatewayProvider(key);

    const textParts: string[] = [];
    if (data.image) {
      textParts.push("নিচের ছবিতে যে অ্যাপ্লিকেশন ফর্ম আছে সেটি হুবহু ১০০% সেম HTML টেবিল ফরম্যাটে রূপান্তর করো — কোনো কিছু বাদ দিও না, কোনো কিছু বদলিও না। শুধু গ্রাহকের নির্দিষ্ট তথ্যের জায়গায় {{placeholder}} বসাও।");
    }
    if (data.pasted) textParts.push(`পেস্ট করা আবেদন:\n${data.pasted}`);
    if (data.prompt) textParts.push(`অতিরিক্ত নির্দেশনা: ${data.prompt}`);

    const content: any[] = [{ type: "text", text: textParts.join("\n\n") }];
    if (data.image) {
      content.push({ type: "image", image: data.image });
    }

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: SYSTEM,
      messages: [{ role: "user", content }],
      experimental_output: Output.object({ schema: Schema }),
    });
    return experimental_output;
  });
