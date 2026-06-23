import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, X, HelpCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveVoiceIntent } from "@/lib/voice-intent.functions";


/**
 * Voice Command Dashboard
 *
 * Uses browser-native Web Speech API (bn-BD / en-US) — no API cost.
 * Matches spoken Bangla/English commands to routes and actions
 * across the entire branch banking app.
 */

type CommandAction =
  | { type: "navigate"; to: string }
  | { type: "scroll"; selector: string }
  | { type: "callback"; run: () => void };

interface VoiceCommand {
  /** Stable id used for AI fallback matching */
  id: string;
  /** Bangla + English keyword patterns (lowercased, normalized) */
  patterns: string[];
  /** What to do when matched */
  action: CommandAction;
  /** Short label shown in help panel */
  label: string;
  /** Group in help panel */
  group: string;
}


// ───────────────────────────────────────────────────────────
// Command catalogue — tailored to ACTUAL routes in this app
// ───────────────────────────────────────────────────────────
function buildCommands(): VoiceCommand[] {
  const list: Omit<VoiceCommand, "id">[] = [

    // 📊 Dashboard
    { group: "📊 ড্যাশবোর্ড", label: "ড্যাশবোর্ড দেখাও", patterns: ["ড্যাশবোর্ড", "ড্যাসবোর্ড", "dashboard", "হোম", "home", "মূল পাতা"], action: { type: "navigate", to: "/dashboard" } },
    { group: "📊 ড্যাশবোর্ড", label: "BI ড্যাশবোর্ড / আজকের সারাংশ", patterns: ["bi ড্যাশবোর্ড", "বি আই", "bi dashboard", "আজকের সারাংশ", "আজকের ব্যবসা", "summary", "business intelligence", "এআই বিশ্লেষণ"], action: { type: "navigate", to: "/bi-dashboard" } },
    { group: "📊 ড্যাশবোর্ড", label: "মাসিক রিপোর্ট", patterns: ["মাসিক রিপোর্ট", "monthly report", "মাসের রিপোর্ট"], action: { type: "navigate", to: "/monthly-report" } },
    { group: "📊 ড্যাশবোর্ড", label: "সকল রিপোর্ট", patterns: ["সব রিপোর্ট", "রিপোর্ট দেখাও", "reports", "report", "বার্ষিক রিপোর্ট", "annual report"], action: { type: "navigate", to: "/reports" } },

    // 💰 Deposit / Investment / Banking
    { group: "💰 আর্থিক", label: "দৈনিক ডিপোজিট", patterns: ["আজকের ডিপোজিট", "ডিপোজিট", "daily deposit", "জমা", "deposit", "মাসিক ডিপোজিট", "সঞ্চয়"], action: { type: "navigate", to: "/daily-deposit" } },
    { group: "💰 আর্থিক", label: "এজেন্ট ব্যাংক ইনভেস্টমেন্ট", patterns: ["ইনভেস্টমেন্ট", "investment", "বিনিয়োগ", "এজেন্ট ব্যাংক ইনভেস্ট"], action: { type: "navigate", to: "/agent-bank-investment" } },
    { group: "💰 আর্থিক", label: "এজেন্ট ব্যাংকিং প্রফিট", patterns: ["এজেন্ট ব্যাংকিং", "agent banking", "প্রফিট", "profit", "মুনাফা", "লাভ"], action: { type: "navigate", to: "/agent-banking" } },
    { group: "💰 আর্থিক", label: "ক্যাশ বই / ক্যাশ ব্যালেন্স", patterns: ["ক্যাশ বই", "cash book", "ক্যাশ", "cash", "বর্তমান ক্যাশ", "ক্যাশ ব্যালেন্স", "ক্যাশ রিপোর্ট", "নগদ"], action: { type: "navigate", to: "/cash-book" } },
    { group: "💰 আর্থিক", label: "ব্যয় / খরচ", patterns: ["খরচ", "ব্যয়", "expense", "expenses", "expenditure"], action: { type: "navigate", to: "/expense" } },
    { group: "💰 আর্থিক", label: "লোন লেজার", patterns: ["লোন", "loan", "ঋণ", "loan ledger", "লোন লেজার", "ঋণ গ্রহীতা"], action: { type: "navigate", to: "/loan-ledger" } },
    { group: "💰 আর্থিক", label: "আসন্ন পেমেন্ট", patterns: ["আসন্ন পেমেন্ট", "upcoming payment", "পেমেন্ট", "payment", "বকেয়া"], action: { type: "navigate", to: "/upcoming-payments" } },

    // 👤 KYC / Customer
    { group: "👤 গ্রাহক / KYC", label: "KYC ডকুমেন্ট", patterns: ["kyc", "কেওয়াইসি", "kyc document", "গ্রাহক", "customer", "সব গ্রাহক", "নতুন গ্রাহক", "vip গ্রাহক", "নিষ্ক্রিয় গ্রাহক", "গ্রাহকের প্রোফাইল", "গ্রাহকের হিস্টোরি", "kyc রিপোর্ট"], action: { type: "navigate", to: "/kyc" } },
    { group: "👤 গ্রাহক / KYC", label: "ডকুমেন্ট", patterns: ["ডকুমেন্ট", "document", "documents", "মেয়াদ শেষ ডকুমেন্ট", "গ্রাহকের ডকুমেন্ট"], action: { type: "navigate", to: "/documents" } },
    { group: "👤 গ্রাহক / KYC", label: "সিগনেচার কার্ড", patterns: ["সিগনেচার", "signature", "সিগনেচার কার্ড", "signature card", "স্বাক্ষর", "atm কার্ড", "চেকবই", "cheque", "card"], action: { type: "navigate", to: "/signature-cards" } },

    // 👨‍💼 Staff / HR
    { group: "👨‍💼 স্টাফ / HR", label: "স্টাফ তালিকা", patterns: ["স্টাফ", "staff", "সব স্টাফ", "কর্মচারী", "employee", "স্টাফ র‍্যাংকিং", "সেরা কর্মচারী", "স্টাফ পারফরম্যান্স", "top performer"], action: { type: "navigate", to: "/staff" } },
    { group: "👨‍💼 স্টাফ / HR", label: "উপস্থিতি", patterns: ["উপস্থিতি", "attendance", "হাজিরা", "employee attendance", "উপস্থিতি রিপোর্ট"], action: { type: "navigate", to: "/employee-attendance" } },
    { group: "👨‍💼 স্টাফ / HR", label: "বেতন", patterns: ["বেতন", "salary", "মাইনে"], action: { type: "navigate", to: "/salary" } },
    { group: "👨‍💼 স্টাফ / HR", label: "বেতন শীট", patterns: ["বেতন শীট", "salary sheet", "পে শীট", "pay sheet"], action: { type: "navigate", to: "/salary-sheet" } },

    // 🎯 Target / Performance
    { group: "🎯 টার্গেট", label: "মাসিক টার্গেট", patterns: ["টার্গেট", "target", "মাসিক টার্গেট", "লক্ষ্য", "টার্গেট অর্জন", "কে টার্গেট পূরণ"], action: { type: "navigate", to: "/targets" } },

    // 📅 Meeting / Task
    { group: "📅 মিটিং / কাজ", label: "মিটিং সিডিউল", patterns: ["মিটিং", "meeting", "সভা", "মিটিং সিডিউল", "meeting schedule"], action: { type: "navigate", to: "/meetings" } },
    { group: "📅 মিটিং / কাজ", label: "টাস্ক ম্যানেজমেন্ট", patterns: ["টাস্ক", "task", "tasks", "কাজ", "task management", "গুরুত্বপূর্ণ কাজ"], action: { type: "navigate", to: "/tasks" } },
    { group: "📅 মিটিং / কাজ", label: "পেন্ডিং কাজ / অভিযোগ", patterns: ["পেন্ডিং", "pending", "পেন্ডিং কাজ", "অভিযোগ", "complaint", "complaints", "সমাধানকৃত অভিযোগ", "ডেলিভারি বাকি", "পেন্ডিং ওয়ার্ক"], action: { type: "navigate", to: "/pending-works" } },
    { group: "📅 মিটিং / কাজ", label: "আবেদন / অ্যাপ্লিকেশন", patterns: ["আবেদন", "এপ্লিকেশন", "অ্যাপ্লিকেশন", "application", "applications", "টেমপ্লেট", "template"], action: { type: "navigate", to: "/applications" } },

    // 🤝 Partners
    { group: "🤝 অংশীদার", label: "পার্টনার / মালিক", patterns: ["পার্টনার", "partner", "partners", "অংশীদার", "মালিক", "শেয়ার"], action: { type: "navigate", to: "/partners" } },

    // 📦 Inventory
    { group: "📦 ইনভেন্টরি", label: "ইনভেন্টরি", patterns: ["ইনভেন্টরি", "inventory", "স্টক", "stock", "মালামাল"], action: { type: "navigate", to: "/inventory" } },

    // 📨 SMS / Communication
    { group: "📨 যোগাযোগ", label: "SMS পাঠানো", patterns: ["sms", "এসএমএস", "এস এম এস", "মেসেজ", "message", "sms পাঠাও", "sms sending"], action: { type: "navigate", to: "/sms-sending" } },

    // 🛡️ Audit / Monitor
    { group: "🛡️ অডিট", label: "অডিট রিপোর্ট", patterns: ["অডিট", "audit", "audit report", "অডিট রিপোর্ট", "নিরীক্ষা", "compliance", "অডিট লগ"], action: { type: "navigate", to: "/audit-report" } },
    { group: "🛡️ অডিট", label: "সিস্টেম মনিটর", patterns: ["সিস্টেম", "system", "system monitor", "মনিটর", "monitor", "ব্যাকআপ", "backup", "ব্যবহারকারী", "user list"], action: { type: "navigate", to: "/system-monitor" } },

    // ⏮️ Navigation helpers
    { group: "⚙️ নেভিগেশন", label: "পেছনে যাও", patterns: ["পেছনে যাও", "back", "ফিরে যাও", "পিছনে", "পূর্বে যাও"], action: { type: "callback", run: () => window.history.back() } },
    { group: "⚙️ নেভিগেশন", label: "সামনে যাও", patterns: ["সামনে যাও", "forward", "এগিয়ে যাও"], action: { type: "callback", run: () => window.history.forward() } },
    { group: "⚙️ নেভিগেশন", label: "রিফ্রেশ করো", patterns: ["রিফ্রেশ", "refresh", "reload", "আবার লোড"], action: { type: "callback", run: () => window.location.reload() } },
    { group: "⚙️ নেভিগেশন", label: "প্রিন্ট করো", patterns: ["প্রিন্ট", "print", "ছাপাও"], action: { type: "callback", run: () => window.print() } },
    { group: "⚙️ নেভিগেশন", label: "উপরে যাও", patterns: ["উপরে", "scroll up", "top", "উপরে যাও"], action: { type: "callback", run: () => window.scrollTo({ top: 0, behavior: "smooth" }) } },
    { group: "⚙️ নেভিগেশন", label: "নিচে যাও", patterns: ["নিচে", "scroll down", "bottom", "নিচে যাও"], action: { type: "callback", run: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }) } },
  ];
  return list.map((c, i) => ({ ...c, id: `cmd_${i}` }));
}


// Normalize: lowercase, trim, remove punctuation, collapse spaces
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[।,.?!;:'"()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCommand(transcript: string, commands: VoiceCommand[]): VoiceCommand | null {
  const t = normalize(transcript);
  if (!t) return null;
  // Score: longest matching pattern wins
  let best: { cmd: VoiceCommand; score: number } | null = null;
  for (const cmd of commands) {
    for (const p of cmd.patterns) {
      const np = normalize(p);
      if (!np) continue;
      if (t.includes(np)) {
        const score = np.length;
        if (!best || score > best.score) best = { cmd, score };
      }
    }
  }
  return best?.cmd ?? null;
}

export function VoiceCommand() {
  const router = useRouter();
  const commands = useMemo(() => buildCommands(), []);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const resolveIntent = useServerFn(resolveVoiceIntent);
  const resolveIntentRef = useRef(resolveIntent);
  resolveIntentRef.current = resolveIntent;

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const recogRef = useRef<any>(null);

  function runActionRef(action: CommandAction) {
    if (action.type === "navigate") {
      router.navigate({ to: action.to });
    } else if (action.type === "scroll") {
      document.querySelector(action.selector)?.scrollIntoView({ behavior: "smooth" });
    } else if (action.type === "callback") {
      action.run();
    }
  }
  const runActionRefStable = useRef(runActionRef);
  runActionRefStable.current = runActionRef;

  async function handleFinal(finalText: string, alternatives: string[]) {
    const cmds = commandsRef.current;
    // 1) Fast local keyword match across alternatives
    let matched: VoiceCommand | null = null;
    for (const a of alternatives) {
      matched = matchCommand(a, cmds);
      if (matched) break;
    }
    if (matched) {
      toast.success(`✅ ${matched.label}`, { description: finalText });
      runActionRefStable.current(matched.action);
      return;
    }

    // 2) AI fallback — let Lovable AI pick the best command id
    setThinking(true);
    try {
      const result = await resolveIntentRef.current({
        data: {
          transcript: finalText,
          options: cmds.map((c) => ({ id: c.id, label: c.label, group: c.group })),
        },
      });
      const picked = result?.id ? cmds.find((c) => c.id === result.id) : null;
      if (picked) {
        toast.success(`🤖 ${picked.label}`, { description: finalText });
        runActionRefStable.current(picked.action);
      } else {
        toast.error("কমান্ড বুঝতে পারিনি", {
          description: `"${finalText}" — অন্যভাবে বলুন বা ❓ আইকনে ক্লিক করুন`,
        });
      }
    } catch (err: any) {
      toast.error("AI বুঝতে পারল না", {
        description: err?.message ?? "আবার চেষ্টা করুন",
      });
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.lang = "bn-BD";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 3;

    r.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript(finalText || interim);

      if (finalText) {
        const alternatives: string[] = [];
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            for (let j = 0; j < e.results[i].length; j++) {
              alternatives.push(e.results[i][j].transcript);
            }
          }
        }
        void handleFinal(finalText.trim(), alternatives);
      }
    };

    r.onend = () => setListening(false);
    r.onerror = (e: any) => {
      setListening(false);
      if (e.error === "not-allowed") {
        toast.error("মাইক্রোফোন অনুমতি দিন");
      } else if (e.error === "no-speech") {
        toast.message("কোনো শব্দ শোনা যায়নি");
      } else if (e.error !== "aborted") {
        toast.error(`Voice error: ${e.error}`);
      }
    };

    recogRef.current = r;

    return () => {
      try { r.abort(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function start() {
    if (!recogRef.current || listening) return;
    setTranscript("");
    try {
      recogRef.current.start();
      setListening(true);
    } catch {
      // already started
    }
  }
  function stop() {
    try { recogRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }

  const grouped = useMemo(() => {
    const m = new Map<string, VoiceCommand[]>();
    for (const c of commands) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    return Array.from(m.entries());
  }, [commands]);

  const handleMicClick = () => {
    if (!supported) {
      toast.error("এই ব্রাউজারে Voice সাপোর্ট নেই", {
        description: "Chrome / Edge ব্যবহার করুন",
      });
      return;
    }
    listening ? stop() : start();
  };

  return (
    <>
      {/* Floating control */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 no-print">
        {(listening || thinking) && (transcript || thinking) && (
          <div className="max-w-[260px] bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
            <div className="opacity-60 mb-1 flex items-center gap-1">
              {thinking ? (
                <>
                  <Sparkles className="w-3 h-3" /> AI বুঝছে…
                </>
              ) : (
                <>🎙️ শুনছি…</>
              )}
            </div>
            {transcript && <div className="font-medium truncate">{transcript}</div>}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-muted transition"
            title="Voice কমান্ড তালিকা"
            aria-label="Voice commands help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            onClick={handleMicClick}
            className={cn(
              "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ring-4 ring-primary/20",
              listening
                ? "bg-red-500 text-white animate-pulse scale-110"
                : "bg-primary text-primary-foreground hover:scale-105"
            )}
            title={listening ? "শুনছি… থামাতে ক্লিক করুন" : "🎙️ Voice কমান্ড"}
            aria-label="Toggle voice command"
          >
            {listening ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Help drawer */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-card w-full sm:max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="font-bold text-base">🎙️ Voice Command তালিকা</div>
                <div className="text-xs opacity-70">যেকোনো একটি বললেই কাজ হবে (বাংলা/English)</div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 rounded-md hover:bg-muted"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {grouped.map(([group, items]) => (
                <div key={group}>
                  <div className="font-semibold text-sm mb-2">{group}</div>
                  <div className="grid gap-1.5">
                    {items.map((c) => (
                      <div
                        key={c.label}
                        className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
                      >
                        <div className="font-medium">{c.label}</div>
                        <div className="opacity-70 mt-0.5 truncate">
                          {c.patterns.slice(0, 4).map((p) => `"${p}"`).join(" • ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-xs opacity-60 pt-2 border-t">
                💡 টিপস: পরিষ্কার করে বাংলা/ইংরেজিতে কমান্ডটি বলুন। প্রথমবার মাইক্রোফোনের অনুমতি দিতে হবে।
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
