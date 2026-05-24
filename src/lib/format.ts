// Bangla number conversion
const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
export const toBn = (n: number | string) =>
  String(n).replace(/\d/g, (d) => bnDigits[Number(d)]);

export const fmtBDT = (n: number) => `৳ ${toBn(Math.round(n).toLocaleString('en-IN'))}`;

export const bnMonths = [
  'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন',
  'জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'
];

export const fmtBnDate = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${toBn(dt.getDate())} ${bnMonths[dt.getMonth()]} ${toBn(dt.getFullYear())}`;
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
