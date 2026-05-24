// Indian/Bangladeshi numbering: thousand, lakh, crore.
const enOnes = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const enTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const bnOnes = ["", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ"];
const bnTens = ["", "", "বিশ", "ত্রিশ", "চল্লিশ", "পঞ্চাশ", "ষাট", "সত্তর", "আশি", "নব্বই"];

function under100(n: number, ones: string[], tens: string[]): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10), o = n % 10;
  return tens[t] + (o ? " " + ones[o] : "");
}

function under1000(n: number, ones: string[], tens: string[], hundredWord: string): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ones[h] + " " + hundredWord);
  if (r) parts.push(under100(r, ones, tens));
  return parts.join(" ");
}

function intToWords(num: number, lang: "en" | "bn"): string {
  const ones = lang === "bn" ? bnOnes : enOnes;
  const tens = lang === "bn" ? bnTens : enTens;
  const hundredWord = lang === "bn" ? "শত" : "Hundred";
  const thousandWord = lang === "bn" ? "হাজার" : "Thousand";
  const lakhWord = lang === "bn" ? "লক্ষ" : "Lakh";
  const croreWord = lang === "bn" ? "কোটি" : "Crore";

  if (num === 0) return lang === "bn" ? "শূন্য" : "Zero";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  const remainder = num % 1000;

  const parts: string[] = [];
  if (crore) parts.push(under1000(crore, ones, tens, hundredWord) + " " + croreWord);
  if (lakh) parts.push(under100(lakh, ones, tens) + " " + lakhWord);
  if (thousand) parts.push(under100(thousand, ones, tens) + " " + thousandWord);
  if (remainder) parts.push(under1000(remainder, ones, tens, hundredWord));
  return parts.join(" ").trim();
}

export function amountInWords(amount: number, lang: "en" | "bn" = "en"): string {
  const rounded = Math.round(amount);
  const taka = intToWords(Math.abs(rounded), lang);
  if (lang === "bn") return `${taka} টাকা মাত্র`;
  return `Taka ${taka} Only`;
}
