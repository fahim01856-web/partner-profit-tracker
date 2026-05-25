## লক্ষ্য

সাইটের প্রত্যেক মেনু/পেইজে যেখানে ডাটা এন্ট্রি করা হয় (টাকার পরিমাণ, তারিখ, বিবরণ ইত্যাদি), সেখানে **Edit** এবং **Delete** অপশন যুক্ত করব যাতে ভুল হলে সহজেই সংশোধন করা যায়।

## কোন কোন পেইজে এডিট অপশন যুক্ত হবে

বর্তমানে যেসব পেইজে এডিট নাই বা অসম্পূর্ণ:

1. **Income** (`income.tsx`) — আয় এন্ট্রি এডিট/ডিলিট
2. **Expense** (`expense.tsx`) — ব্যয় ভাউচার এডিট/ডিলিট
3. **Monthly Report** (`monthly-report.tsx`) — Income/Expense লাইন আইটেম এডিট/ডিলিট
4. **Salary Sheet** (`salary-sheet.tsx`) — বেতন রেকর্ড এডিট/ডিলিট
5. **Salary** (`salary.tsx`) — পুরাতন পেমেন্ট এডিট/ডিলিট
6. **Staff** (`staff.tsx`) — স্টাফ তথ্য এডিট/ডিলিট
7. **Attendance** (`attendance.tsx`) — হাজিরা এডিট
8. **Targets** (`targets.tsx`) — মাসিক টার্গেট এডিট/ডিলিট
9. **SMS Sending** (`sms-sending.tsx`) — টেমপ্লেট/হিস্ট্রি এডিট
10. **Dashboard** এর নিচে quick edit লিংক (অপশনাল)

যেসব পেইজে এডিট আগেই আছে (verify করে missing field গুলো ঠিক করব):
- Daily Deposit, Documents, Employee Attendance, Partners, Pending Works, Reports (Remittance, Account Opening)

## UI প্যাটার্ন (সবার জন্য একই থাকবে)

প্রতিটা row/card-এ ডান পাশে দুটো আইকন বাটন:
- ✏️ **Pencil** (Edit) → একই form-এ pre-fill হয়ে dialog/modal খুলবে → Save করলে update
- 🗑️ **Trash** (Delete) → confirmation dialog → confirm করলে delete

কারিগরি দিক:
- Supabase `.update().eq('id', id)` ও `.delete().eq('id', id)` ব্যবহার
- একই form component reuse করব (insert/update mode টগল)
- TanStack Query invalidate করে real-time refresh
- বাংলা/ইংরেজি দুই ভাষায় toast মেসেজ ("সফলভাবে আপডেট হয়েছে" / "Updated successfully")
- shadcn `AlertDialog` দিয়ে delete confirmation
- শুধু admin role এর জন্য কাজ করবে (RLS আগেই সেট করা আছে)

## কাজের ধাপ

1. একটি reusable `EditDeleteActions` কম্পোনেন্ট তৈরি (`src/components/EditDeleteActions.tsx`) — যেকোনো row-এ ব্যবহারযোগ্য
2. উপরের ১০টি পেইজে এই কম্পোনেন্ট যুক্ত করা ও edit dialog wire করা
3. বিদ্যমান edit ফিচার গুলো verify ও polish করা
4. Translation keys যোগ ("সম্পাদনা", "মুছে ফেলুন", confirm dialog ইত্যাদি)

কোনো ডাটাবেস migration লাগবে না — শুধু frontend আপডেট।