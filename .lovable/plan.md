## Dashboard-এ নতুন স্ট্যাটস কার্ড যোগ

`src/routes/_app/dashboard.tsx`-এ বিদ্যমান ৪টি কার্ডের পাশে আরও ৩টি কার্ড যোগ করব (previous month-এর জন্য, dashboard ইতিমধ্যেই previous month দেখাচ্ছে):

### নতুন কার্ডসমূহ

1. **ফরেন রেমিটেন্স (গত মাস)** — `remittance_entries` থেকে previous month-এর সব এন্ট্রির:
   - মোট সংখ্যা: `sum(quantity)` (entries-এর সংখ্যা নয়, quantity ফিল্ডের যোগফল)
   - মোট অ্যামাউন্ট: `sum(amount)` — `৳` ফরম্যাটে
   - একটি কার্ডে দুটি লাইনে দেখাব (count + amount)

2. **নতুন অ্যাকাউন্ট (গত মাস)** — `account_opening_entries` থেকে previous month-এর `sum(num_accounts)`

3. **গতকালের ডিপোজিট** — `daily_deposits` টেবিল থেকে গতকালের তারিখের (`yesterday = today - 1 day`) `sum(amount)`। যদি গতকাল কোনো এন্ট্রি না থাকে, `৳ 0` দেখাবে।

### Query পরিবর্তন

বিদ্যমান `useQuery` এর `queryFn`-এ `Promise.all`-এ আরও তিনটি Supabase কল যোগ করব:
```ts
supabase.from("remittance_entries").select("quantity,amount").gte("date", start).lte("date", end)
supabase.from("account_opening_entries").select("num_accounts").gte("date", start).lte("date", end)
supabase.from("daily_deposits").select("amount").eq("date", yesterdayISO)
```
এবং রিটার্ন অবজেক্টে `remitCount`, `remitAmount`, `accountCount`, `yesterdayDeposit` ফিল্ড যোগ করব।

### Realtime

`useEffect`-এর realtime channel-এ আরও তিনটি টেবিল subscribe করব: `remittance_entries`, `account_opening_entries`, `daily_deposits` — যাতে এন্ট্রি যোগ হলে dashboard সাথে সাথে আপডেট হয়।

### i18n

`src/lib/i18n.tsx`-এ ৪টি নতুন key যোগ:
- `foreignRemittance` — "ফরেন রেমিটেন্স" / "Foreign Remittance"
- `newAccounts` — "নতুন অ্যাকাউন্ট" / "New Accounts"
- `yesterdayDeposit` — "গতকালের ডিপোজিট" / "Yesterday's Deposit"
- `count` — "সংখ্যা" / "Count"

### Layout

Grid `grid-cols-2 lg:grid-cols-4` রেখে দিব — ৭টি কার্ড সুন্দরভাবে wrap করবে (mobile: 2 cols, desktop: 4 cols)। আইকন: `Send` (remittance), `UserPlus` (accounts), `PiggyBank` (deposit) — lucide-react থেকে।

### পরিবর্তিত ফাইল

- `src/routes/_app/dashboard.tsx`
- `src/lib/i18n.tsx`