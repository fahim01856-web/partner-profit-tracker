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
      <div className={cn(
        "group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20",
        "bg-gradient-to-r from-primary/10 via-card/80 to-gold/10 backdrop-blur-md shadow-sm",
        "hover:shadow-md hover:border-primary/40 transition-all",
        className,
      )}>
        <span className="relative flex items-center justify-center w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
          <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
        </span>
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-xs font-bold tabular-nums tracking-wider bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">
          {time}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">{ampm}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl",
        "border border-primary/20 bg-gradient-to-br from-primary/10 via-card/90 to-gold/10",
        "backdrop-blur-md shadow-md hover:shadow-lg hover:border-primary/40 transition-all duration-300",
        "overflow-hidden",
        className,
      )}
    >
      {/* shimmer overlay */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shrink-0">
        <Clock className="w-5 h-5" />
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-2.5 h-2.5">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        </span>
      </div>
      <div className="leading-tight relative">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-lg font-extrabold tabular-nums tracking-wider bg-gradient-to-r from-primary via-primary to-gold bg-clip-text text-transparent">
            {time}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
            {ampm}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate font-medium mt-0.5">
          <span className="text-foreground/80 font-semibold">{weekday}</span>
          <span className="mx-1 opacity-50">•</span>
          {date}
        </div>
      </div>
    </div>
  );
}
