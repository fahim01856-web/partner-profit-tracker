
## লক্ষ্য

Application Management পেজে নতুন **"Customer Profiles"** ট্যাব যোগ করব, যেখানে প্রতিটি কাস্টমারের account number দিয়ে আলাদা profile থাকবে, এবং সেই profile-এর ভিতরে বিভিন্ন ধরনের application/form (Account Close, RTGS, EFT, Mobile Change, BEFTN, Others ইত্যাদি) আলাদা আলাদা ভাবে তৈরি ও সংরক্ষণ করা যাবে। প্রতিটা form type-এর জন্য editable template body থাকবে — ঠিক বর্তমান Application Templates module-এর মতো — এবং user নিজে নতুন form type তৈরি/edit করতে পারবে।

## কী কী তৈরি হবে

### ১. Database (নতুন ৩টা টেবিল)

- **`customer_profiles`** — account_number (unique), name, mobile, account_type, address, opening_date, notes
- **`customer_form_types`** — form type templates (name, code, body_template, fields_schema, is_system) — pre-seed: Account Close, RTGS (sender/receiver pair), EFT/BEFTN, Mobile Number Change, BACH/MSA to MSA Transfer, Others
- **`customer_documents`** — customer_profile_id, form_type_id, title, body (rich text), field_values (jsonb), attachments, created_at

RLS: সব authenticated user-এর জন্য full access (existing pattern অনুযায়ী)।

### ২. UI — Applications পেজে নতুন ট্যাব

বর্তমান tabs-এর পাশে নতুন **"কাস্টমার প্রোফাইল"** tab। ভিতরে:

**A. Customer list view**
- উপরে search box: account number বা name দিয়ে search
- "+ নতুন কাস্টমার" button → dialog (account number, name, mobile, account_type, address)
- Card grid: প্রতিটা customer-এর নাম, A/C number, mobile, কতগুলো document আছে

**B. Customer profile detail view** (card-এ click করলে)
- উপরে customer info (edit করা যাবে)
- নিচে "Documents/Forms" section — list of all forms created for this customer
- "+ নতুন ফর্ম" button → form type select করার dialog → template auto-load হবে customer info সহ pre-filled → edit → save
- প্রতিটা saved document-এ: View, Edit, Print/PDF download, Delete

**C. Form Types management** (profile view-এর উপরে একটা "ফর্ম টাইপ ম্যানেজ" button)
- Existing Application Templates editor-এর মতোই full editor: name, body template (rich text with `{{customer_name}}`, `{{account_number}}` ইত্যাদি placeholder), custom fields list
- নতুন type তৈরি, system types edit/clone করা যাবে

### ৩. Pre-seeded form types

মাইগ্রেশনেই এই default templates seed হবে (user পরে edit করতে পারবে):
1. একাউন্ট ক্লোজ আবেদন
2. RTGS ফর্ম (sender + receiver info সহ)
3. EFT/BEFTN ফর্ম
4. মোবাইল নাম্বার পরিবর্তন আবেদন
5. MSA to MSA ট্রান্সফার আবেদন
6. অন্যান্য আবেদন (blank template)

প্রতিটাতে relevant placeholder fields (sender A/C, receiver A/C, amount, reason, ইত্যাদি)।

## টেকনিক্যাল ডিটেইলস

- বর্তমান `application_templates` + `application_records` pattern সম্পূর্ণ reuse করব structurally, কিন্তু separate tables রাখব যাতে existing applications-এর সাথে conflict না হয়।
- Rich body editor: existing `RichBodyEditor` component reuse।
- Placeholder rendering: customer info থেকে auto-substitute (e.g. `{{name}}` → customer.name)।
- Print/PDF: existing applications-এর print logic reuse।
- File: নতুন route `_app/applications.tsx`-এ tab যোগ করব; বড় হলে আলাদা component file-এ ভাঙব।

## অনুমোদনের পরে

প্রথমে migration submit করব (আপনার approval লাগবে), তারপর UI implement করব।
