## লক্ষ্য
Sidebar-এ নতুন গ্রুপ **"M.S. KYC. Task"** যোগ করব ৩টা সাব-মেনু সহ। পুরোনো **Documents, Signature Cards, Pending Works** এই গ্রুপের ভিতরে চলে আসবে (ডেটা loss নেই — শুধু route + sidebar reorganize)।

---

## ১. Meeting Schedule (`/meetings`)
Smart Meeting + Follow-up System।

**ফিচার:**
- Meeting create/edit/delete (Date, Time, Title, Type: Weekly/Monthly/Emergency/Review, Location, Chairperson)
- **Agenda** (multi-item: topic, presenter, time-slot)
- **Problem Tracking** (issue, raised by, status: Open/Resolved, resolution)
- **Target Management** (target, assigned to, due date, achievement %)
- **Action Plan** (action, responsible, deadline, status)
- **Previous Meeting Review** (গত meeting-এর pending action auto-show)
- **Progress Tracking** dashboard (completed vs pending)
- Reminder badge (upcoming meetings within 7 days)
- PDF Export + Print
- Attendee list (staff থেকে select)

**Tables:** `meetings`, `meeting_agendas`, `meeting_problems`, `meeting_targets`, `meeting_actions`, `meeting_attendees`

---

## ২. KYC Documents (`/kyc`)
পুরো KYC + Document + Signature Card management একত্রে।

**ফিচার:**
- Customer KYC Profile (name, NID, phone, address, account no, photo, occupation, source of income, risk level: Low/Medium/High)
- Document upload (NID copy, photo, trade license, etc.) — Supabase storage
- Document expiry tracking + alert badge
- Signature Card management (existing `signature_cards` table-এর সাথে integrate)
- **KYC Verification Checklist** (10 points: NID verified, photo, address proof, signature, nominee, risk assessment, etc.)
- Pending KYC list (incomplete checklist)
- Approval workflow: Pending → Verified → Approved (with verifier/approver name)
- **Compliance Dashboard** (Total KYC, Pending, Approved, Expired docs, High-risk)
- Search + filters (status, risk, date range)
- Audit integration — audit findings থেকে KYC issue link করা যাবে
- PDF report per customer + bulk report

**Tables:** `kyc_profiles`, `kyc_documents`, `kyc_checklist_items`
পুরোনো `documents` + `signature_cards` table reuse + এই page থেকেও access।

---

## ৩. Task Management (`/tasks`)
Smart Task System (পুরোনো `pending_works` data এই module-এ migrate/link)।

**ফিচার:**
- Task create/edit/delete
- Assign to staff (multi-assignee support)
- Category (Daily/Audit/Meeting/Compliance/KYC/Other) + Priority (Low/Med/High/Urgent)
- Deadline + reminder (overdue auto-flag)
- Status: Pending → In Progress → Completed → Verified
- Completion note + file upload (evidence)
- **Dashboard:** stats cards (Total/Pending/Overdue/Completed) + Pie chart (by status) + Bar chart (by staff)
- Staff-wise performance (completion rate, on-time %)
- Meeting integration — meeting action plan auto-create task
- Audit integration — audit task থেকেও pull
- Task history log (status change timeline)
- Filters: staff, status, priority, category, date range
- PDF report

**Tables:** `tasks`, `task_assignees`, `task_history` (existing `pending_works` কে এই page-এ display + নতুন `tasks` table প্রধান)

---

## Sidebar পরিবর্তন (`src/components/AppLayout.tsx`)
নতুন গ্রুপ:
```
M.S. KYC. Task
  ├─ Meeting Schedule  (/meetings)
  ├─ KYC Documents     (/kyc)         [Documents + Signature Cards এখানে]
  └─ Task Management   (/tasks)        [Pending Works এখানে]
```
পুরোনো top-level Documents/Signature Cards/Pending Works মেনু item সরিয়ে এই গ্রুপের ভিতরে নেস্ট হবে (route থাকবে, শুধু sidebar reorganize)।

---

## Technical Plan

**Migration (১টা single migration):**
- `meetings`, `meeting_agendas`, `meeting_problems`, `meeting_targets`, `meeting_actions`, `meeting_attendees`
- `kyc_profiles`, `kyc_documents`, `kyc_checklist_items`
- `tasks`, `task_assignees`, `task_history`
- প্রতিটায় GRANT + RLS (`authenticated` full access, owner-based যেখানে দরকার)
- `updated_at` trigger
- Storage bucket: `kyc-documents` (private), `task-attachments` (private), `meeting-files` (private)

**Routes তৈরি:**
- `src/routes/_app/meetings.tsx` (list) + `meetings.$id.tsx` (detail with tabs)
- `src/routes/_app/kyc.tsx` (list) + `kyc.$id.tsx` (profile detail with tabs)
- `src/routes/_app/tasks.tsx` (dashboard + list)

**Library:** existing shadcn (Card/Tabs/Dialog/Table/Select/Badge), `recharts` (charts), `react-to-print` বা browser print CSS (PDF)।

**Mobile responsive:** Tailwind `grid-cols-1 md:grid-cols-2/3/4`, sticky filter bar।

---

## ক্রম
1. Migration (DB schema + storage buckets) — approval দরকার
2. Sidebar reorganize
3. Meetings module (list + detail + agenda/problem/target/action tabs)
4. KYC module (profile list + detail tabs)
5. Tasks module (dashboard + CRUD + charts)
6. Verification (Playwright smoke test প্রতিটা page)

প্রথমে migration submit করব — approve হলে কোড লেখা শুরু।