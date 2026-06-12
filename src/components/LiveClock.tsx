import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtBnDate, toBn } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  compact?: boolean;
}

export function LiveClock({ className, compact }: Props) {
  const { lang } = useI18n();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours();
  const h12 = ((h + 11) % 12) + 1;
  const ampm = h >= 12
    ? (lang === "bn" ? "অপরাহ্ণ" : "PM")
    : (lang === "bn" ? "পূর্বাহ্ণ" : "AM");
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(h12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const time = lang === "bn" ? toBn(timeStr) : timeStr;
  const date = fmtBnDate(now, lang);
  const weekdays = lang === "bn"
    ? ["রবিবার","সোমবার","মঙ্গলবার","বুধবার","বৃহস্পতিবার","শুক্রবার","শনিবার"]
    : ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const weekday = weekdays[now.getDay()];

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card/60 backdrop-blur text-xs", className)}>
        <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />
        <span className="font-mono font-semibold tabular-nums">{time}</span>
        <span className="opacity-70">{ampm}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm",
        "bg-gradient-to-r from-primary/10 via-card to-gold/10 backdrop-blur",
        className,
      )}
    >
      <div className="w-9 h-9 rounded-lg grid place-items-center bg-primary/15 text-primary shrink-0">
        <Clock className="w-4.5 h-4.5 animate-pulse" />
      </div>
      <div className="leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-base font-bold tabular-nums text-primary">{time}</span>
          <span className="text-[10px] font-semibold opacity-70">{ampm}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {weekday}, {date}
        </div>
      </div>
    </div>
  );
}
