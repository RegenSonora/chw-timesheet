# CHW Time Tracker — product spec

_Decided with Chris on October 30–31, 2026. Wireframes: https://claude.ai/artifact/92kpyaebTLS2Ht4Le6jDmP (private; share from its Share menu). Source form: `docs/source/CHW_Timesheet_and_Invoice_TISUPP.xlsx`, kept locally and not committed; this spec carries everything needed from it._

This file is the requirements source for the build. When it is silent or contradicts itself, stop and ask; do not invent product behavior. Record each new decision in `docs/decisions/`.

## 1. Purpose and users

A lightweight phone app for Community Health Workers (CHWs) who work as contractors for Regenerating Sonora, Inc. A CHW logs time in the field, then generates an invoice and timesheet for one funding source, signs it, and emails it to a reviewer, who signs and sends it to the office.

- **CHW:** logs time, generates invoices, signs.
- **Reviewer:** signs "Services received" outside the app. Usually the CHW Team Lead; when the Team Lead is the CHW, someone else signs under an internal policy the app does not know about.
- **Office:** reviews, approves and pays on paper or later in another system.

The app is a separate product from the grant compliance platform. It shares no code with it.

## 2. Platform

| Topic | Decision |
|---|---|
| Phones | iPhone and Android. One CHW per phone. |
| Hosting | GitHub Pages at `https://regensonora.github.io/chw-timesheet/`. A custom subdomain comes later (not now). |
| Repo | `RegenSonora/chw-timesheet`, public |
| License | Code: Apache 2.0. Docs, task lists and certification text: CC BY 4.0 |
| Install | Home Screen web app. iPhone: setup is blocked until the app is opened from the Home Screen (Safari and the Home Screen app keep separate storage). Android: Chrome offers Install; setup is not blocked. |
| Offline | Works with no signal after the first load |
| Server | None. No data ever leaves the phone except the invoice files the CHW shares. |
| Storage | On the phone only (IndexedDB). Request persistent storage; show its status in Settings. |
| Backup | None. Invoiced work is safe in email; uninvoiced entries are lost with the phone. Settings tells the CHW to invoice often. |
| Language | English only |
| Logo | None now. Keep an optional, empty logo setting so one can be added without redesign. |
| Notifications | None. The only timer reminder is the always-visible running clock. |

**Subdomain move:** phone data belongs to the web address. Before switching to a custom subdomain, every CHW must invoice all open entries; the old address shows a one-time "We moved" notice.

**Erasing risk:** removing the app from the Home Screen (iPhone) or clearing site data (Android) erases all entries not yet invoiced. Setup and the procedure doc must say so.

## 3. Funding sources

Each funding source is a JSON file in the repo, validated against a JSON Schema at build time. Task lists are static; a new funding source is a new file plus a release. The format must allow loading a source by link or QR code later without rework.

### TISUPP — Trauma-Informed Substance Use Prevention Program

- **Not-to-exceed (NTE):** yes, entered by the CHW in Settings.
- **Certification text:** "I certify that the services listed were performed on the dates shown on the attached timesheet pages for the TISUPP grant, the hours are accurate, no participant names are included, and these hours have not been billed to Regenerating Sonora under any other funding source or to any other funder."
- **Tasks (21) and core competencies:**

| # | Task | Core competency |
|---|---|---|
| 1 | Outreach | Outreach |
| 2 | Interview and intake | Individual & Community Assessment |
| 3 | Screening and referrals | Individual & Community Assessment |
| 4 | Resource research | Knowledge Base |
| 5 | Resource acquisition | Service Coordination & Navigation |
| 6 | Application assistance | Service Coordination & Navigation |
| 7 | Transportation | Service Coordination & Navigation |
| 8 | Advocacy | Advocacy |
| 9 | Conversational support | Communication Skills |
| 10 | Supporting client self-efficacy | Capacity-Building |
| 11 | Technical assistance | Education & Facilitation |
| 12 | Client or community workshops | Education & Facilitation |
| 13 | Client check in | Interpersonal & Relationship-Building |
| 14 | Client follow up | Service Coordination & Navigation |
| 15 | Re-screening | Individual & Community Assessment |
| 16 | Planning and conducting surveys | Individual & Community Assessment |
| 17 | Documentation | Professional Skills & Conduct |
| 18 | Data analysis and reporting | Evaluation & Research Skills |
| 19 | Developing tools/processes | Professional Skills & Conduct |
| 20 | Meetings | Professional Skills & Conduct |
| 21 | Training / continuing education | Professional Skills & Conduct |

- **Budget lines (12):** New CHWs: training, stipends, field hours · CHW referrals · Outreach and marketing · Listening sessions · Community Atlas · Family Tree · Family Resilience Workshops · Youth Leadership Academy · Green Thumb Warriors · Full Moon Garden Parties · Youth and family field trips · Quarterly partnership meetings

(The source spreadsheet combines "CHW referrals, outreach, marketing" into one line; Chris split it.)

### Regen General Operating

- **NTE:** none. No contract tracking box on its invoices.
- **Tasks (22):** the 21 TISUPP tasks plus **Domestic support**, which has no core competency (blank).
- **Budget lines (13):** the 12 TISUPP lines plus **Domestic support**.
- **Certification text:** "I certify that the services listed were performed on the dates shown on the attached timesheet pages, the hours are accurate, and no participant names are included." The CHW always signs and certifies.

## 4. CHW profile and settings

- **Your details:** name, initials, mailing address. No agreement # and no service area.
- **Per funding source the CHW works under:** hourly rate (from the agreement; TISUPP prefilled at $20.00) and, for TISUPP, the NTE amount. Setup asks for the rate; the NTE is entered later in Settings.
- **Initials:** used in invoice numbers. Changing them does not affect numbering.
- **Rate changes:** one rate per funding source. The rate in effect when an invoice is generated applies to every entry on it and is then frozen in that invoice. When the rate is edited while uninvoiced entries exist for that source, ask: "You have N entries not yet invoiced. They will be billed at the new rate." with **Create invoice first**, **Change rate now**, **Cancel**. Retroactive raises are handled by the office outside the app.
- **NTE edits:** allowed (agreement amendments). Each invoice prints the current amount.

## 5. Logging time

- **Funding source:** a chip in the header picks the source for new entries. The chip is locked while a timer runs. The task screen shows the source with **Change**.
- **Timer:** Start → large running clock with the largest button, **Stop**. The timer survives closing the app (the start time is stored). **Discard timer** needs a confirmation or Undo.
- **Enter times instead:** date, start, end. An end earlier than the start means the next day.
- **Rounding:** each entry rounds to the nearest 0.25 h. Chris accepted that per-entry rounding can bill slightly more than raw time.
- **Too short:** an entry that rounds to 0 h (under 7.5 minutes) is blocked with a plain message; it is never saved.
- **Overlaps:** blocked, compared on raw start and stop times.
- **Entry date:** an entry belongs to its start date, including entries that cross midnight.
- **Entry flow:** Stop (or enter times) → task and budget line (budget line defaults to the last one used; recent tasks first) → counts and notes → Save. A typical entry is 4 taps.
- **Counts (all optional, default 0):** Contacts, Referrals given, Referral follow-ups, Rides provided, Applications completed, plus "Add another count" (label + number).
- **Notes:** optional, with the warning "Don't include client names. Notes appear on the timesheet."
- **Editing:** entries can be edited or deleted until invoiced, then are locked. Save and delete show Undo.
- **Home:** "Not yet invoiced" list for the selected funding source with entry count, hours and amount.

## 6. Invoices

- **One invoice per funding source.** It includes every uninvoiced entry for that source.
- **Generate button:** shown only when the selected source has at least one uninvoiced entry; labelled with the source ("Generate TISUPP invoice").
- **Invoice number:** `<INITIALS>-<YYYY>-<NNN>`, for example `CC-2026-004`. One counter shared by all funding sources. It keeps counting across years and is never reset by changing initials. YYYY is the invoice date's year.
- **Invoice date:** the day it is generated. **Service period:** first entry date to last entry date.
- **Lines:** one per budget line: hours, rate, amount. Line amount = quarter-hours × rate in cents ÷ 4, rounded half up to the cent. Invoice total = sum of line amounts.
- **NTE tracker (TISUPP only):** NTE amount; billed before this invoice (sum of earlier invoices for this source on this phone); this invoice; remaining. Over the limit: a warning only ("OVER CONTRACT LIMIT: do not pay without an amendment" on the PDF), never a block. No NTE entered: "Enter your not-to-exceed amount in Settings."
- **Counts:** this period and all time for this funding source on this phone (including this invoice).
- **After generating:** the entries are locked. The app can re-create and re-share any past invoice from stored data.

## 7. Output files

One "Create invoice files" action produces three files and shares them together through the phone's share sheet (download fallback where sharing is not supported).

| File | Name | Content |
|---|---|---|
| Invoice PDF | `<SOURCE>_<INVOICE#>_<first-date>_to_<last-date>.pdf` | Page 1 invoice; pages 2+ timesheet. The only file that is signed. |
| Timesheet CSV | `<SOURCE>_<INVOICE#>_timesheet.csv` | The timesheet grid, same content as the PDF pages |
| Entry log CSV | `<SOURCE>_<INVOICE#>_entries.csv` | One row per entry, raw start and stop times |

### PDF page 1 (invoice)

Title and funding source name; invoice #, invoice date, service period; From (CHW name, mailing address); Bill to (Regenerating Sonora, Inc., PO Box 154, Superior, AZ 85173); lines by budget line and amount due; counts (this period and all time); NTE tracker (when the source has one); certification text; **Contractor (CHW)** signature box and date; **Services received (reviewer)** printed name, title, signature box, date; office box: Reviewed by / Date, Approved by / Date, Payment date / Check or transaction #; QR code; fingerprint; "Page 1 of N".

### PDF timesheet pages

- Each page holds the next **7 unique dates that have entries**. Dates with no entries get no column.
- Rows are task + budget line pairs used on that page; columns: Task, Core competency, Budget line, one column per date, Total, Notes.
- Notes from the entries combined into a row are joined.
- Under the grid: total hours per date, subtotal by budget line for the page, page total.
- Footer: CHW initials line, fingerprint, invoice #, "Page X of N".
- Header: "Dates worked A–B of C", date range, CHW name, invoice #, rate.

### CSV rules

UTF-8 with byte-order mark; ISO dates; RFC 4180 quoting; any cell starting with `=`, `+`, `-` or `@` gets a leading apostrophe. Both CSVs carry the invoice # and full fingerprint. Hours have two decimals; the rate is in dollars with two decimals. Layouts approved by Chris on October 31, 2026 (decision 0001).

### Timesheet CSV layout (for people; mirrors the PDF pages)

A header block, a blank line, then one block per PDF timesheet page separated by blank lines. No dollar amounts.

```
Invoice #,CC-2026-004
Funding source,TISUPP
CHW,Carmen Cruz
Service period,2026-10-20,2026-10-30
Rate,20.00
Fingerprint,<64 hex characters>

Page 2 of 3
Task,Core competency,Budget line,2026-10-20,2026-10-22,2026-10-23,2026-10-26,2026-10-27,2026-10-28,2026-10-29,Total hours,Notes
Outreach,Outreach,Outreach and marketing,0.50,,,1.00,,1.50,,3.00,Library table
Client follow up,Service Coordination & Navigation,CHW referrals,,,,,,,1.75,1.75,By phone
Training / continuing education,Professional Skills & Conduct,"New CHWs: training, stipends, field hours",,0.50,0.50,,2.00,,,3.00,CHW module 3
Total hours,,,0.50,0.50,0.50,1.00,2.00,1.50,1.75,7.75,

Page 3 of 3
Task,Core competency,Budget line,2026-10-30,Total hours,Notes
Client check in,Interpersonal & Relationship-Building,CHW referrals,1.50,1.50,
Total hours,,,1.50,1.50,
```

- Page numbers, dates and rows match the PDF timesheet pages exactly; only dates worked get a column, at most 7 per page.
- Notes from entries combined into one row are joined with "; ".

### Entry log CSV layout (one header row, one row per entry)

| Column | Example | Notes |
|---|---|---|
| `invoice_number` | CC-2026-004 | |
| `fingerprint` | 3f9a21c7… | Full 64-character value |
| `funding_source` | TISUPP | |
| `entry_id` | UUID | |
| `entry_date` | 2026-10-30 | Start date |
| `start` | 2026-10-30T09:12:04-07:00 | ISO 8601 with offset |
| `stop` | 2026-10-30T10:37:10-07:00 | |
| `raw_duration` | 1:25:06 | h:mm:ss before rounding |
| `billed_hours` | 1.50 | Rounded to 0.25 |
| `task` | Client check in | |
| `core_competency` | Interpersonal & Relationship-Building | Blank for Domestic support |
| `budget_line` | CHW referrals | |
| `rate` | 20.00 | The invoice's rate |
| `contacts` | 1 | |
| `referrals_given` | 1 | |
| `referral_followups` | 0 | |
| `rides_provided` | 0 | |
| `applications_completed` | 0 | |
| `other_counts` | Food boxes=2; Library cards=1 | Custom counts joined with "; " |
| `notes` | Met at the library table | |
| `created_at` | ISO 8601 with offset | |
| `updated_at` | ISO 8601 with offset | |

- No per-entry dollar amount: amounts are rounded once per budget line on the invoice.
- Columns are the same for every invoice, so files from different invoices can be combined.

### Fingerprint and QR code

- **Fingerprint:** SHA-256 over a canonical JSON form of the invoice (header, entries, lines, totals, rate). Shown short on the PDF (`3F9A-21C7`), full in both CSVs and the QR code. The canonical form is versioned and must never change silently.
- **QR code:** invoice #, period, hours and amount by budget line, fingerprint. Readable after printing or scanning so a later system can match paper to data.

## 8. Signatures (outside the app)

Option A, no in-app signing:

1. The CHW shares the files and emails them to themselves.
2. The CHW signs the PDF (iPhone Markup, or Adobe Acrobat Reader Fill & Sign on Android).
3. The CHW emails the signed PDF and both CSVs to the reviewer.
4. The reviewer signs and sends everything to the office.

Guardrails, written in a one-page procedure (`docs/signing-procedure.md`, CC BY 4.0): email only, never edit a signed file (corrections are a new invoice from the app), the office keeps the final PDF with its email thread. Office lines are signed on paper.

## 9. Screens

Install gate (iPhone) · Setup · Home · Timer running · New entry: task and budget line · New entry: counts and notes · Enter times · Invoice preview · Invoice created (share) · Settings · Rate change check · plus edit entry and "show all entries" (not drawn). See the wireframes.

## 10. Field usability and quality

- High contrast for sunlight; main actions in the bottom third; buttons at least 56 px tall, all targets at least 44 px.
- Large timer digits; Stop is the largest button.
- Lists instead of dropdowns; typing only for notes, custom counts and hand-entered times.
- Every step saves immediately; interruptions never lose a half-entered record.
- Clear confirmation after Save; errors in plain words next to the field; Undo after Save and Delete.
- Follows the phone's light or dark setting.
- WCAG 2.1 AA.
- Neutral styling: gray tones with one accent color (blue `#1f5fc8`).

## 11. Out of scope

Expenses or mileage (time only) · "nature of the activity" field · service area · agreement # · backup and restore · server, sync or push notifications · in-app signatures · Excel export · Spanish · logo (slot only) · supplemental invoices for retroactive raises · contractor onboarding documents.

## 12. Open questions (ask Chris before building the affected part)

None as of October 31, 2026.
