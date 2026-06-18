import logo from "@/assets/islami-bank-logo.png";
import { cn } from "@/lib/utils";

export function BankLogo({ className, alt = "Islami Bank Bangladesh PLC" }: { className?: string; alt?: string }) {
  return (
    <img
      src={logo}
      alt={alt}
      loading="lazy"
      width={512}
      height={512}
      className={cn("object-contain", className)}
    />
  );
}
