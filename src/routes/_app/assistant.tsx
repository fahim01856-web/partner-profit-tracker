import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Send, Loader2, Trash2, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
});

type Row = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

function toUIMessages(rows: Row[]): UIMessage[] {
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      parts: [{ type: "text", text: r.content }],
    }));
}

function AssistantPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(url, { ...init, headers });
        },
      }),
    [],
  );

  // Load history
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) {
        setInitial([]);
        return;
      }
      setInitial(toUIMessages((data ?? []) as Row[]));
    })();
  }, [user]);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    messages: initial ?? [],
    onError: (e) => toast.error(e.message || "AI error"),
  });

  // Sync initial after load
  useEffect(() => {
    if (initial && messages.length === 0 && initial.length > 0) {
      setMessages(initial);
    }
  }, [initial, messages.length, setMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const loading = status === "submitted" || status === "streaming";

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await sendMessage({ text });
  };

  const handleClear = async () => {
    if (!user) return;
    if (!confirm(lang === "bn" ? "সব চ্যাট মুছে ফেলবেন?" : "Delete all chat?")) return;
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages([]);
    toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Cleared");
  };

  const suggestions = lang === "bn"
    ? [
        "এই মাসের আয়-ব্যয় কীভাবে এন্ট্রি করব?",
        "৮০/২০ পার্টনার শেয়ার কীভাবে হিসাব হয়?",
        "চেক বই রেডি SMS এর বাংলা টেমপ্লেট দাও",
        "DPS রিমাইন্ডার মেসেজ লিখে দাও",
      ]
    : [
        "How do I enter this month's income & expense?",
        "How is 80/20 partner share calculated?",
        "Give me a Bangla SMS template for cheque book ready",
        "Write a DPS reminder message",
      ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{lang === "bn" ? "এআই অ্যাসিস্ট্যান্ট" : "AI Assistant"}</h1>
            <p className="text-xs text-muted-foreground">{lang === "bn" ? "ব্যাংকিং, হিসাব ও SMS এ সাহায্য" : "Banking, accounting & SMS help"}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={messages.length === 0}>
          <Trash2 className="w-4 h-4 mr-1.5" /> {lang === "bn" ? "মুছুন" : "Clear"}
        </Button>
      </div>

      <Card className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{lang === "bn" ? "কীভাবে সাহায্য করতে পারি?" : "How can I help?"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "bn" ? "এজেন্ট ব্যাংকিং, হিসাব, SMS — যেকোনো কিছু জিজ্ঞেস করুন" : "Ask anything about agent banking, accounts, SMS"}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-2xl mt-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left text-sm p-3 rounded-lg border hover:bg-muted transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-primary text-primary-foreground">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={isUser ? "max-w-[80%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground" : "max-w-[85%]"}>
                {isUser ? (
                  <div className="whitespace-pre-wrap text-sm">{text}</div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground">
                    <ReactMarkdown>{text || "…"}</ReactMarkdown>
                  </div>
                )}
              </div>
              {isUser && (
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-muted">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-primary text-primary-foreground">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "bn" ? "ভাবছি..." : "Thinking..."}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </Card>

      <div className="mt-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={lang === "bn" ? "আপনার প্রশ্ন লিখুন..." : "Type your question..."}
          rows={2}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="h-[60px] w-12">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
        {t("appTitle")} · AI {lang === "bn" ? "ভুল করতে পারে, যাচাই করুন" : "may make mistakes, verify important info"}
      </p>
    </div>
  );
}
