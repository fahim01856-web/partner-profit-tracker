import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

const dict = {
  // Brand / layout
  bankName: { bn: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি", en: "Islami Bank Bangladesh PLC" },
  bankShort: { bn: "ইসলামী ব্যাংক", en: "Islami Bank" },
  outlet: { bn: "এজেন্ট আউটলেট ১২১/১১", en: "Agent Outlet 121/11" },
  location: { bn: "ফকির বাজার, বুড়িচং", en: "Fakir Bazar, Burichang" },
  locationFull: { bn: "ফকির বাজার, বুড়িচং, কুমিল্লা", en: "Fakir Bazar, Burichang, Cumilla" },
  appTitle: { bn: "এজেন্ট ব্যাংক হিসাব", en: "Agent Bank Accounting" },
  inCharge: { bn: "ইনচার্জ: মো. ফাহিম", en: "In-charge: Md. Fahim" },
  approvedBy: { bn: "অনুমোদনকারী (মো. ফাহিম)", en: "Approved by (Md. Fahim)" },

  // Nav
  nav_dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  nav_income: { bn: "আয় এন্ট্রি", en: "Income" },
  nav_expense: { bn: "খরচ ভাউচার", en: "Expense Voucher" },
  nav_staff: { bn: "স্টাফ", en: "Staff" },
  nav_attendance: { bn: "হাজিরা", en: "Attendance" },
  nav_salary: { bn: "বেতন হিসাব", en: "Salary" },
  nav_partners: { bn: "পার্টনার শেয়ার", en: "Partner Share" },
  nav_reports: { bn: "রিপোর্ট", en: "Reports" },
  logout: { bn: "লগআউট", en: "Logout" },

  // Common
  loading: { bn: "লোড হচ্ছে...", en: "Loading..." },
  date: { bn: "তারিখ", en: "Date" },
  category: { bn: "ক্যাটাগরি", en: "Category" },
  description: { bn: "বিবরণ", en: "Description" },
  amount: { bn: "পরিমাণ", en: "Amount" },
  amountBDT: { bn: "পরিমাণ (৳)", en: "Amount (৳)" },
  total: { bn: "মোট", en: "Total" },
  add: { bn: "যোগ করুন", en: "Add" },
  save: { bn: "সংরক্ষণ", en: "Save" },
  delete: { bn: "মুছুন", en: "Delete" },
  edit: { bn: "এডিট", en: "Edit" },
  print: { bn: "প্রিন্ট", en: "Print" },
  printPdf: { bn: "প্রিন্ট / PDF", en: "Print / PDF" },
  printAll: { bn: "সব প্রিন্ট / PDF", en: "Print All / PDF" },
  noEntries: { bn: "কোনো এন্ট্রি নেই", en: "No entries" },
  deleted: { bn: "মুছে ফেলা হয়েছে", en: "Deleted" },

  // Dashboard
  dashboard_summary: { bn: "সারসংক্ষেপ", en: "Summary" },
  monthlyIncome: { bn: "মাসিক আয়", en: "Monthly Income" },
  monthlyExpense: { bn: "মাসিক ব্যয়", en: "Monthly Expense" },
  netProfit: { bn: "নেট প্রফিট", en: "Net Profit" },
  partners: { bn: "পার্টনার", en: "Partners" },
  persons: { bn: "জন", en: "" },
  partnerShareTitle: { bn: "পার্টনারদের চলতি মাসের শেয়ার (নেট প্রফিট থেকে)", en: "This Month's Partner Share (from Net Profit)" },
  share: { bn: "শেয়ার", en: "Share" },

  // Income
  income_title: { bn: "আয় এন্ট্রি", en: "Income Entry" },
  income_sub: { bn: "প্রত্যেক মাসের আয় এখানে এন্ট্রি করুন", en: "Record monthly income here" },
  income_new: { bn: "নতুন আয় যোগ করুন", en: "Add New Income" },
  income_list: { bn: "আয়ের তালিকা", en: "Income List" },
  income_added: { bn: "আয় যোগ হয়েছে", en: "Income added" },
  cat_commission: { bn: "কমিশন", en: "Commission" },
  cat_service: { bn: "সার্ভিস চার্জ", en: "Service Charge" },
  cat_other_income: { bn: "অন্যান্য আয়", en: "Other Income" },

  // Expense
  expense_title: { bn: "খরচ ভাউচার", en: "Expense Voucher" },
  expense_sub: { bn: "প্রত্যেক দিনের ভাউচার তৈরি, এডিট ও প্রিন্ট করুন", en: "Create, edit and print daily vouchers" },
  expense_new: { bn: "নতুন ভাউচার", en: "New Voucher" },
  voucher_no: { bn: "ভাউচার নং", en: "Voucher No." },
  paid_to: { bn: "প্রাপক", en: "Paid To" },
  note: { bn: "মন্তব্য", en: "Note" },
  create_voucher: { bn: "ভাউচার তৈরি করুন", en: "Create Voucher" },
  voucher_created: { bn: "ভাউচার তৈরি হয়েছে", en: "Voucher created" },
  voucher_list: { bn: "ভাউচার তালিকা", en: "Voucher List" },
  total_vouchers: { bn: "মোট ভাউচার", en: "Total Vouchers" },
  no_vouchers: { bn: "কোনো ভাউচার নেই", en: "No vouchers" },
  expense_voucher_doc: { bn: "খরচ ভাউচার", en: "Expense Voucher" },
  receiver_signature: { bn: "প্রাপকের স্বাক্ষর", en: "Receiver's Signature" },
  cat_electricity: { bn: "বিদ্যুৎ বিল", en: "Electricity Bill" },
  cat_internet: { bn: "ইন্টারনেট", en: "Internet" },
  cat_rent: { bn: "অফিস ভাড়া", en: "Office Rent" },
  cat_stationery: { bn: "স্টেশনারি", en: "Stationery" },
  cat_transport: { bn: "যাতায়াত", en: "Transport" },
  cat_repair: { bn: "মেরামত", en: "Repair" },
  cat_other: { bn: "অন্যান্য", en: "Other" },

  // Staff
  staff_title: { bn: "স্টাফ ব্যবস্থাপনা", en: "Staff Management" },
  staff_sub: { bn: "স্টাফদের তথ্য ও মাসিক বেতন সেটআপ করুন", en: "Manage staff info and monthly salary" },
  new_staff: { bn: "নতুন স্টাফ", en: "New Staff" },
  name: { bn: "নাম", en: "Name" },
  position: { bn: "পদবী", en: "Position" },
  phone: { bn: "মোবাইল", en: "Mobile" },
  monthly_salary: { bn: "মাসিক বেতন (৳)", en: "Monthly Salary (৳)" },
  salary_short: { bn: "বেতন", en: "Salary" },
  joining_date: { bn: "জয়েনিং তারিখ", en: "Joining Date" },
  joining: { bn: "জয়েনিং", en: "Joining" },
  staff_list: { bn: "স্টাফ তালিকা", en: "Staff List" },
  staff_added: { bn: "স্টাফ যোগ হয়েছে", en: "Staff added" },
  no_staff: { bn: "কোনো স্টাফ নেই", en: "No staff" },

  // Attendance
  attendance_title: { bn: "হাজিরা খাতা", en: "Attendance Sheet" },
  st_present: { bn: "উপস্থিত", en: "Present" },
  st_absent: { bn: "অনুপস্থিত", en: "Absent" },
  st_late: { bn: "দেরি", en: "Late" },
  st_leave: { bn: "ছুটি", en: "Leave" },
  add_staff_first: { bn: "প্রথমে স্টাফ যোগ করুন", en: "Add staff first" },

  // Salary
  salary_title: { bn: "বেতন হিসাব", en: "Salary" },
  base_salary: { bn: "মূল বেতন", en: "Base Salary" },
  deductions: { bn: "কর্তন", en: "Deductions" },
  bonus: { bn: "বোনাস", en: "Bonus" },
  net: { bn: "নেট", en: "Net" },
  paid: { bn: "প্রদত্ত", en: "Paid" },
  total_paid_salary: { bn: "মোট প্রদত্ত বেতন:", en: "Total Salary Paid:" },
  salary_saved: { bn: "বেতন রেকর্ড হয়েছে", en: "Salary recorded" },

  // Auth
  welcome: { bn: "স্বাগতম", en: "Welcome" },
  admin_login_msg: { bn: "অ্যাডমিন প্যানেলে প্রবেশ করুন", en: "Sign in to the admin panel" },
  login: { bn: "লগইন", en: "Login" },
  login_btn: { bn: "লগইন করুন", en: "Sign In" },
  new_account: { bn: "নতুন অ্যাকাউন্ট", en: "Sign Up" },
  create_account: { bn: "অ্যাকাউন্ট তৈরি করুন", en: "Create Account" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  password_min: { bn: "পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর)", en: "Password (min 6 chars)" },
  full_name: { bn: "পূর্ণ নাম", en: "Full Name" },
  login_success: { bn: "সফলভাবে লগইন হয়েছে", en: "Signed in successfully" },
  signup_success: { bn: "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল ভেরিফাই করে লগইন করুন।", en: "Account created. Verify email then sign in." },
  hero_title: { bn: "এজেন্ট ব্যাংক\nহিসাব ব্যবস্থাপনা", en: "Agent Bank\nAccounting System" },
  hero_sub: {
    bn: "আয়, ব্যয়, ভাউচার, স্টাফ হাজিরা, বেতন ও পার্টনার শেয়ার — সব এক প্ল্যাটফর্মে। স্মার্ট, নিরাপদ ও সম্পূর্ণ বাংলায়।",
    en: "Income, expenses, vouchers, attendance, salary and partner shares — all in one platform. Smart, secure and bilingual.",
  },

  // Partner Profit Management
  pp_title: { bn: "পার্টনার প্রফিট ম্যানেজমেন্ট", en: "Partner Profit Management" },
  pp_sub: { bn: "মাসিক প্রফিট এন্ট্রি ও পার্টনার শেয়ার হিসাব", en: "Monthly profit entry & partner share calculation" },
  pp_new_entry: { bn: "নতুন প্রফিট এন্ট্রি", en: "New Profit Entry" },
  pp_edit_entry: { bn: "এন্ট্রি এডিট করুন", en: "Edit Entry" },
  pp_month: { bn: "মাস", en: "Month" },
  pp_year: { bn: "বছর", en: "Year" },
  pp_total_profit: { bn: "মোট মাসিক প্রফিট (৳)", en: "Total Monthly Profit (৳)" },
  pp_partner1: { bn: "পার্টনার ১ এর নাম", en: "Partner 1 Name" },
  pp_partner2: { bn: "পার্টনার ২ এর নাম", en: "Partner 2 Name" },
  pp_percent: { bn: "শতকরা (%)", en: "Percentage (%)" },
  pp_notes: { bn: "মন্তব্য", en: "Notes" },
  pp_p1_share: { bn: "পার্টনার ১ এর অংশ", en: "Partner 1 Share" },
  pp_p2_share: { bn: "পার্টনার ২ এর অংশ", en: "Partner 2 Share" },
  pp_grand_total: { bn: "সর্বমোট", en: "Grand Total" },
  pp_save: { bn: "সংরক্ষণ করুন", en: "Save Entry" },
  pp_saved: { bn: "এন্ট্রি সংরক্ষণ হয়েছে", en: "Entry saved" },
  pp_updated: { bn: "এন্ট্রি আপডেট হয়েছে", en: "Entry updated" },
  pp_history: { bn: "প্রফিট হিস্ট্রি", en: "Profit History" },
  pp_no_entries: { bn: "কোনো এন্ট্রি নেই", en: "No entries yet" },
  pp_filter: { bn: "ফিল্টার", en: "Filter" },
  pp_all_months: { bn: "সকল মাস", en: "All Months" },
  pp_all_years: { bn: "সকল বছর", en: "All Years" },
  pp_search_partner: { bn: "পার্টনার নাম খুঁজুন", en: "Search partner name" },
  pp_total_profit_card: { bn: "মোট প্রফিট", en: "Total Profit" },
  pp_p1_total_card: { bn: "পার্টনার ১ মোট", en: "Partner 1 Total" },
  pp_p2_total_card: { bn: "পার্টনার ২ মোট", en: "Partner 2 Total" },
  pp_entries_count: { bn: "মোট এন্ট্রি", en: "Total Entries" },
  pp_monthly_chart: { bn: "মাসিক প্রফিট চার্ট", en: "Monthly Profit Chart" },
  pp_share_chart: { bn: "পার্টনার শেয়ার অনুপাত", en: "Partner Share Ratio" },
  pp_signature: { bn: "স্বাক্ষর", en: "Signature" },
  pp_report_title: { bn: "পার্টনার প্রফিট ডিস্ট্রিবিউশন রিপোর্ট", en: "Partner Profit Distribution Report" },
  pp_taka: { bn: "টাকা", en: "Taka" },
  pp_confirm_delete: { bn: "এই এন্ট্রি মুছে ফেলবেন?", en: "Delete this entry?" },
  pp_print_sheet: { bn: "শীট প্রিন্ট করুন", en: "Print Sheet" },
  cancel: { bn: "বাতিল", en: "Cancel" },
} as const;

export type DictKey = keyof typeof dict;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "en" || saved === "bn") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: DictKey) => dict[k]?.[lang] ?? String(k);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n must be inside I18nProvider");
  return c;
}

export const useT = () => useI18n().t;
