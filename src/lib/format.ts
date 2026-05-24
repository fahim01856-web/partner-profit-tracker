import { useI18n, type Lang } from "./i18n";

const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
export const toBn = (n: number | string) =>
  String(n).replace(/\d/g, (d) => bnDigits[Number(d)]);

export const toEn = (n: number | string) => String(n);

export const fmtNum = (n: number | string, lang: Lang = "bn") =>
  lang === "bn" ? toBn(n) : String(n);

export const fmtBDT = (n: number, lang: Lang = "bn") => {
  const formatted = Math.round(n).toLocaleString('en-IN');
  return `৳ ${lang === "bn" ? toBn(formatted) : formatted}`;
};

export const bnMonths = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'
];
export const enMonths = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export const monthsOf = (lang: Lang) => (lang === "bn" ? bnMonths : enMonths);

export const fmtBnDate = (d: string | Date, lang: Lang = "bn") => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const months = monthsOf(lang);
  const day = dt.getDate();
  const year = dt.getFullYear();
  return lang === "bn"
    ? `${toBn(day)} ${months[dt.getMonth()]} ${toBn(year)}`
    : `${day} ${months[dt.getMonth()]} ${year}`;
};

export const monthKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const monthRange = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export const genVoucherNo = () => {
  const d = new Date();
  return `V-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
};

/** Hook that returns locale-aware formatters tied to current language. */
export function useFmt() {
  const { lang } = useI18n();
  return {
    lang,
    num: (n: number | string) => fmtNum(n, lang),
    bdt: (n: number) => fmtBDT(n, lang),
    date: (d: string | Date) => fmtBnDate(d, lang),
    months: monthsOf(lang),
  };
}
