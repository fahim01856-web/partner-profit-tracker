import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPT = `You are an AI assistant for "M/S FEED HOUSE" — Islami Bank Agent Outlet 121/11, Buricong, Comilla. The manager is Md. Fahim. The business has 2 partners sharing profit 80/20.

The internal app this assistant lives in has these modules: Dashboard, Monthly Income & Expense Register, Daily Income, Total Deposit Position (daily deposit tracking), Expense Voucher, Staff, Employee Attendance (with In/Out time, leave, holidays), Salary, Salary Sheet, Partner Profit (80/20), Reports (Foreign Remittance, Account Opening, Report Center), Pending Works, SMS Sending, Targets & Achievement, Document Management.

Help the user with:
- Agent banking operations (account opening, remittance, cheque book, ATM, DPS, MSS).
- Accounting math: profit = income − expense; partner share = profit × percent.
- Drafting Bangla/English SMS to customers (cheque book ready, DPS reminder, balance info).
- Navigating this app: tell the user which module/page to open.
- Bilingual: reply in the same language the user writes in (Bangla or English). Keep numbers clear.

Format answers with markdown. Be concise and practical.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supaUrl = process.env.SUPABASE_URL!;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supa = createClient(supaUrl, supaKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await supa.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { data: isAdmin, error: roleErr } = await supa.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (roleErr || !isAdmin) return new Response("Forbidden", { status: 403 });


        const body = (await request.json()) as { messages: UIMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages : [];

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Persist the latest user message
        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          const text = last.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("")
            .trim();
          if (text) {
            await supa.from("chat_messages").insert({ user_id: userId, role: "user", content: text });
          }
        }

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway("google/gemini-2.5-flash");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            const assistant = finalMessages[finalMessages.length - 1];
            if (assistant && assistant.role === "assistant") {
              const text = assistant.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")
                .trim();
              if (text) {
                await supa
                  .from("chat_messages")
                  .insert({ user_id: userId, role: "assistant", content: text });
              }
            }
          },
        });
      },
    },
  },
});
