# Regen Time Tracking — product spec

_Decided with Chris on October 30–31, 2026; roles, counts per task, employee timesheets and grant periods added for 0.11.0 on November 3, 2026 (decisions 0027–0034, [roles plan](roles-plan.md)). Wireframes: https://claude.ai/artifact/92kpyaebTLS2Ht4Le6jDmP (private; share from its Share menu). Source form: `docs/source/CHW_Timesheet_and_Invoice_TISUPP.xlsx`, kept locally and not committed; this spec carries everything needed from it._

This file is the requirements source for the build. When it is silent or contradicts itself, stop and ask; do not invent product behavior. Record each new decision in `docs/decisions/`.

## 1. Purpose and users

A lightweight phone app for people who work for Regenerating Sonora, Inc.: Community Health Workers (CHWs) and other roles such as the Resilience Team Lead, as contractors or employees. A person logs time in the field, then generates an invoice (contractors) or a timesheet (employees) for one funding source, signs it, and emails it to a reviewer or supervisor, who signs and sends it to the office.

- **Contractor:** logs time, generates invoices, signs.
- **Employee:** logs time, submits timesheets, signs (decision 0031).
- **Reviewer:** signs "Services received" on a contractor's invoice outside the app. Usually the CHW Team Lead; when the Team Lead is the person invoicing, someone else signs under an internal policy the app does not know about.
- **Supervisor:** signs an employee's timesheet below the employee's signature, outside the app.
- **Office:** reviews, approves and pays on paper or later in another system.

The app is a separate product from the grant compliance platform. It shares no code with it.

## 2. Platform

| Topic | Decision |
|---|---|
| Phones | iPhone and Android. One CHW per phone. |
| Hosting | GitHub Pages at `https://regensonora.github.io/regen-time-tracking/`. A custom subdomain comes later (not now). |
| Repo | `RegenSonora/regen-time-tracking`, public |
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

- **Grant period (decision 0033):** each source has `period_start` and `period_end` (null for none). A source isn't offered for time dated outside its period; hours inside it can still be billed after it ends.
- **Certification texts (decision 0031):** `certification_text` for contractors and `employee_certification_text` for employees.
- **Budget line display name (decision 0028):** a line may carry a `display_name` shown in the app; its `name` prints on the files.

### TISUPP — Trauma-Informed Substance Use Prevention Program

- **Grant period:** October 1, 2026 to September 30, 2027.
- **Not-to-exceed (NTE):** yes for contractors, prefilled from the role (decision 0030); none on timesheets (decision 0031).
- **Rate:** $20.00 for the first 240 hours, then $23.00. With a role, the raise and the 480-hour CHW Certification goal come from the role (§3 Roles). The source file keeps `rate_step` and `certification_step` for phones set up before roles (decision 0032).
- **Employee certification text:** "I certify that the hours shown on this timesheet were worked on the dates listed for the TISUPP grant, the hours are accurate, no participant names are included, and these hours have not been reported under any other funding source."
- **Report funding line:** "Trauma-Informed Substance Use Prevention Program (TISUPP), funded by the Governor's Office of Youth, Faith and Family through Arizona State University. Contracted through Regenerating Sonora, Inc."
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
| 16 | Individual and community assessment | Individual & Community Assessment |
| 17 | Documentation | Professional Skills & Conduct |
| 18 | Data analysis and reporting | Evaluation & Research Skills |
| 19 | Developing tools/processes | Professional Skills & Conduct |
| 20 | Meetings | Professional Skills & Conduct |
| 21 | Training / continuing education | Professional Skills & Conduct |

- **Budget lines (13):** New CHWs: training, stipends, field hours · CHW referrals · Outreach and marketing · Listening sessions · Community Atlas · Family Tree · Family Resilience Workshops · Youth Leadership Academy · Green Thumb Warriors · Full Moon Garden Parties · Youth and family field trips · Quarterly partnership meetings · CHW experience hours (from the Gila port)

(The source spreadsheet combines "CHW referrals, outreach, marketing" into one line; Chris split it.)

### Regen General Operating

- **Grant period:** none.
- **NTE:** none. No contract tracking box on its invoices.
- **Tasks (37):** the 21 TISUPP tasks plus **Domestic support**, which have core competencies (Domestic support blank), plus 15 Resilience Team Lead tasks with none: Firewise assessing, Residential fuel reduction, Municipal fuel reduction, Dump runs, LEHR maintenance, Pinal garden maintenance, Regen lot clean and maintenance, Transport and supply runs, Plant propagation, Tree planting, Tree removal, Water harvesting, Garden support, Paid training, Other.
- **Budget lines (18):** the 12 TISUPP lines plus **Domestic support**, plus Fire risk reduction work, Maintenance labor, Resilient Home Services contracting, Team development, and Other contractors (shown in the app as "Other").
- **Certification text:** "I certify that the services listed were performed on the dates shown on the attached timesheet pages, the hours are accurate, and no participant names are included." The CHW always signs and certifies.

### Roles (decision 0027)

`src/roles/roles.json`, checked at build time against the funding sources. Each role lists its funding sources, the budget lines under each, and the tasks under each line with the counts each task shows (decision 0029). Roles never name a person.

- **Shared count list (decision 0029):** Contacts, Referrals given, Referral follow-ups, Rides provided, Applications completed, Client goals achieved, Quick wins provided, Screenings conducted, Applications approved (CHW Trainees); Trailer loads removed, Assessments completed, LEHR resets completed, Plants propagated, Trees planted, Trees removed, Water capacity added (gal), Grow space added (sq ft), Certifications earned (Resilience Team Lead). Ids never change; a count taken out of use is retired, not deleted.

| Code | Name | Type | `chw` | Funding | Rate | NTE | Raise | Certification |
|---|---|---|---|---|---|---|---|---|
| CHW-TC01 | CHW Trainee (Contractor) | Contractor | true | TISUPP · CHW experience hours, all 21 tasks | $20.00 | $10,320.00 | $23.00 after 240 hrs | 480 hrs |
| CHW-TE01 | CHW Trainee (Employee) | Employee | true | TISUPP · CHW experience hours, all 21 tasks | $20.00 | none | $23.00 after 240 hrs | 480 hrs |
| R-TL01 | Resilience Team Lead | Contractor | false | Regen General Operating · the 5 Team Lead lines and 15 tasks | $22.00 | none | none | none |

- **Office changes:** editing a role changes what everyone in it sees after the update; retiring it with `replaced_by` moves everyone in it; retiring it with no replacement stops new time (§5, decision 0027).

## 4. Profile and settings

- **Setup (decision 0027):** your details, then **Pick your role** (active roles by code and name), then a review of the role's sources, budget lines and tasks with a rate per source prefilled (decision 0030): **This is my role** or **Pick a different role**. Wording is neutral (decision 0034).
- **Your details:** name, initials, mailing address. No agreement # and no service area.
- **Role:** shown read-only in Settings, "Set at setup. Ask the office to change it." It can't be changed on the phone.
- **Per funding source of the role:** hourly rate (prefilled, editable) and, for contractors on a source with an NTE, the NTE amount (prefilled from the role, editable). Employees have no NTE field. There is no "Add a funding source"; the role's sources are set up at setup and after an office change.
- **Phones set up before roles (decision 0027):** keep working with no role and the 0.10.0 behavior until the app is cleared and set up again.
- **Initials:** used in invoice numbers. Changing them does not affect numbering.
- **Rate changes:** one rate per funding source. The rate in effect when an invoice is generated applies to every entry on it and is then frozen in that invoice. When the rate is edited while uninvoiced entries exist for that source, ask: "You have N entries not yet invoiced. They will be billed at the new rate." with **Create invoice first**, **Change rate now**, **Cancel**. Retroactive raises are handled by the office outside the app.
- **NTE edits:** allowed (agreement amendments). Each invoice prints the current amount.

## 5. Logging time

- **Funding source:** a chip in the header picks the source for new entries, from the role's sources. The chip is locked while a timer runs. The task screen shows the source with **Change**, offering only sources that take time on the entry's date (decision 0033).
- **Timer:** Start → large running clock with the largest button, **Stop**. The timer survives closing the app (the start time is stored). **Discard timer** needs a confirmation or Undo.
- **Record time** (decision 0025): date, start, end. An end earlier than the start means the next day.
- **Rounding:** each entry rounds to the nearest 0.25 h. Chris accepted that per-entry rounding can bill slightly more than raw time.
- **Too short:** an entry that rounds to 0 h (under 7.5 minutes) is blocked with a plain message; it is never saved.
- **Overlaps:** blocked, compared on raw start and stop times.
- **Entry date:** an entry belongs to its start date, including entries that cross midnight.
- **Entry flow (decision 0028):** Stop (or enter times) → budget line and tasks (the role's lines for the source; the line defaults to the last one used, or is picked for you when the role has only one; the role's tasks for that line, recent tasks first) → split your time (only when two or more tasks are checked) → counts and notes → Save. A typical entry is 4 taps.
- **Grant periods (decision 0033):** Enter times says "None of your funding takes time on this date. Ask the office." when no source of the role covers the date. When every source has ended, Home says "No active funding for your role. Ask the office.", hides Start timer, and keeps Record time for dates inside a period.
- **One option (decision 0028):** a funding source or budget line with only one choice is picked for you and shown as a plain label, never a control: "Billed to: TISUPP", or "Billed to: TISUPP · CHW experience hours" when both have one choice. With one funding source, Home shows the same label in place of the funding source chip.
- **Several tasks (decision 0024):** tasks are check boxes. With two or more checked, "Split your time" gives each a share in 0.25 h steps, starting with all hours on the first checked task, and shows what is left ("0.50 h left", "0.25 h too many", "All 1.50 h assigned"). Next is blocked until the shares add up to the entry's billed hours. A task left at 0 h is dropped. One checked task gets all the hours and skips the step.
- **Counts (all optional, default 0; decision 0029):** the counts of the checked tasks, in the shared list's order, with units, plus any count that already has a value, plus "Add another count" (label + number). An added label that matches one of the entry's counts, ignoring case and spaces, is refused: "Trees planted is already a count above. Use that one." Phones with no role show the five CHW counts.
- **Notes:** optional, with the warning "Don't include client names. Notes appear on the timesheet."
- **Editing:** entries can be edited or deleted until invoiced, then are locked. Save and delete show Undo. If the billed hours change, a one-task entry follows them; a split entry must be split again before saving.
- **Home:** "Not yet invoiced" ("Not yet submitted" for employees) list for the selected funding source with entry count, hours and amount. With nothing waiting it says "Start timer and start working or record time." Below it, **My stats**, then Past invoices (Past timesheets), then Generate Regen Invoice (Submit timesheet) (decisions 0026, 0031). Hour amounts read "hrs" ("4.5 hrs").
- **Raise reminder (decision 0030):** at 240 hours, "You've reached 240 hours. Generate your invoice now (Submit your timesheet now), then change your rate to $23.00 in Settings."; once billed, "Your rate is now $23.00. Change it in Settings before your next invoice (timesheet)."
- **My stats (decision 0032):** combined across the role's sources: hours invoiced or submitted with the hours still waiting; hrs needed for pay increase (roles with a raise); hrs needed for CHW Cert eligibility and the Eligible button (roles with certification); all-time totals of the role's counts above 0, or "No counts yet."; "Counts invoices and timesheets made on this phone." Phones with no role keep the source-based card of decision 0026.
- **Work Hours Report (decisions 0026, 0032):** for roles with certification (CHW Trainees), from Settings or the Eligible button. Invoiced or submitted hours of the past three years per core competency across the role's sources, in the order and wording of the ADHS CHW Hours Worked/Volunteered Attestation Form, with the dates completed; shared as PDF, PNG and CSV.
- **After an office change (decision 0027):** a replaced role switches on the next open, with a one-time notice "Your role was updated by the office: …" and any rate to check; an inactive role shows "Your role is no longer active. Ask the office." and takes no new time.

## 6. Invoices

- **One invoice per funding source and role.** It includes every uninvoiced entry for that source logged under one role: the role of the oldest waiting entry, so after an office change the old role's hours go out first (decision 0027). Employees **submit a timesheet** the same way, in the same single transaction (decision 0031).
- **Generate button:** shown only when the selected source has at least one uninvoiced entry; labelled "Generate Regen Invoice", or "Submit timesheet" when the next hours are an employee's (decisions 0025, 0031); a row under Past invoices, the same size, light green with dark gold text (decision 0026).
- **Invoice number:** `<INITIALS>-<YYYY>-<NNN>`, for example `CC-2026-004`; timesheets use the same counter ("Timesheet CC-2026-004"). One counter shared by all funding sources. It keeps counting across years and is never reset by changing initials. YYYY is the invoice date's year.
- **Invoice date:** the day it is generated. **Service period:** first entry date to last entry date.
- **Lines:** one per budget line: hours, rate, amount. Line amount = quarter-hours × rate in cents ÷ 4, rounded half up to the cent. Invoice total = sum of line amounts.
- **NTE tracker (TISUPP contractors only; none on timesheets):** NTE amount; billed before this invoice (sum of earlier invoices for this source on this phone); this invoice; remaining. Over the limit: a warning only ("OVER CONTRACT LIMIT: do not pay without an amendment" on the PDF), never a block. No NTE entered: "Enter your not-to-exceed amount in Settings."
- **Counts (decision 0029):** only counts with a value this period, each with its all-time total for this funding source on this phone (including this invoice). The record freezes the labels and units of its counts.
- **Role and kind:** the record freezes its role (id, code, name, employment, `chw`) and its kind, `invoice` or `timesheet`.
- **After generating:** the entries are locked. The app can re-create and re-share any past invoice from stored data.

## 7. Output files

One "Create invoice files" (or "Create timesheet files") action produces four files and shares them together through the phone's share sheet (download fallback where sharing is not supported).

| File | Name | Content |
|---|---|---|
| PDF | `<SOURCE>_<INVOICE#>_<first-date>_to_<last-date>.pdf` | Page 1 invoice (or timesheet summary); pages 2+ timesheet. Signed, unless the picture is signed instead. |
| Picture | `<SOURCE>_<INVOICE#>_invoice.png`, or `_timesheet.png` | Page 1 as a PNG, 200 dpi, for signing in a photo app (decision 0018). Sign the PDF or the picture, not both. |
| Timesheet CSV | `<SOURCE>_<INVOICE#>_timesheet.csv` | The timesheet grid, same content as the PDF pages |
| Entry log CSV | `<SOURCE>_<INVOICE#>_entries.csv` | One row per entry, raw start and stop times |

### PDF page 1 (invoice)

Title and funding source name; invoice #, invoice date, service period; From (contractor name, mailing address); Bill to (Regenerating Sonora, Inc., PO Box 154, Superior, AZ 85173); lines by budget line and amount due; counts with a value this period, with all-time totals and units (at most 10; decision 0029); NTE tracker (when the source has one); certification text; **Contractor** signature box and date (decision 0034); **Services received (reviewer)** printed name, title, signature box, date; office box: Reviewed by / Date, Approved by / Date, Payment date / Check or transaction #; QR code; fingerprint; "Page 1 of N".

### PDF page 1 (timesheet summary, employees; decision 0031)

"TIMESHEET" and funding source name; timesheet #, date, service period, **Pay rate**; From (employee), Employer; hours by budget line and **Total hours**, with no rates or amounts; counts as above; the employee certification text; **Employee** signature box and date, then **Supervisor signature** box, **Supervisor name** and **Date**, blank; office box: Reviewed by / Date, Approved by / Date; QR code; fingerprint; "Page 1 of N". No NTE box and no dollar amounts besides the pay rate.

### PDF timesheet pages

- Each page holds the next **7 unique dates that have entries**. Dates with no entries get no column.
- Rows are task + budget line pairs used on that page (a split entry adds each task share to its own row, and its notes to each of those rows); columns: Task, Core competency (CHW roles only, decision 0032), Budget line, one column per date, Total, Notes.
- Notes from the entries combined into a row are joined.
- Under the grid: total hours per date, subtotal by budget line for the page, page total.
- Footer: "Contractor initials" or "Employee initials" line (decision 0034), fingerprint, invoice #, "Page X of N".
- Header: "Dates worked A–B of C", date range, name, "Invoice # · Rate" or "Timesheet # · Pay rate".

### CSV rules

UTF-8 with byte-order mark; ISO dates; RFC 4180 quoting; any cell starting with `=`, `+`, `-` or `@` gets a leading apostrophe. Both CSVs carry the invoice # and full fingerprint. Hours have two decimals; the rate is in dollars with two decimals. Layouts approved by Chris on October 31, 2026 (decision 0001).

### Timesheet CSV layout (for people; mirrors the PDF pages)

A header block, a blank line, then one block per PDF timesheet page separated by blank lines. No dollar amounts. For employees the header block reads `Timesheet #`, `Employee` and `Pay rate` (decisions 0031, 0034); for roles with `chw: false` the Core competency column is left out (decision 0032).

```
Invoice #,CC-2026-004
Funding source,TISUPP
Contractor,Carmen Cruz
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

### Entry log CSV layout (one header row, one row per task share of each entry)

| Column | Example | Notes |
|---|---|---|
| `invoice_number` | CC-2026-004 | |
| `fingerprint` | 3f9a21c7… | Full 64-character value |
| `funding_source` | TISUPP | |
| `entry_id` | UUID | Repeats on each part of a split entry |
| `part` | 1 of 2 | Which task share of the entry this row is (decision 0024) |
| `entry_date` | 2026-10-30 | Start date |
| `start` | 2026-10-30T09:12:04-07:00 | ISO 8601 with offset |
| `stop` | 2026-10-30T10:37:10-07:00 | |
| `raw_duration` | 1:25:06 | h:mm:ss before rounding, for the whole entry |
| `billed_hours` | 1.00 | This row's task share, in 0.25 h; the column adds up to the invoice hours |
| `task` | Client check in | |
| `core_competency` | Interpersonal & Relationship-Building | Blank for Domestic support |
| `budget_line` | CHW referrals | |
| `rate` | 20.00 | The invoice's or timesheet's rate |
| one column per count id, e.g. `contacts`, … `certifications_earned` | 1 | Every count in the roles file, in list order, retired ones included; blank unless above 0 (decision 0029) |
| `other_counts` | Food boxes=2; Library cards=1 | Custom counts joined with "; " |
| `notes` | Met at the library table | |
| `created_at` | ISO 8601 with offset | |
| `updated_at` | ISO 8601 with offset | |

- No per-entry dollar amount: amounts are rounded once per budget line on the invoice.
- Start, stop and `raw_duration` repeat on every part of an entry. Counts, other counts and notes are on part 1 only, so the columns add up.
- Columns are the same for every invoice and timesheet, so files can be combined. New counts are added at the end of the count columns; past invoices shared again get the current columns.

### Fingerprint and QR code

- **Fingerprint:** SHA-256 over a canonical JSON form of the invoice (header, entries, lines, totals, rate). Shown short on the PDF (`3F9A-21C7`), full in both CSVs and the QR code. The canonical form is versioned and must never change silently. v1 has one task per entry; v2 (decision 0024) lists each entry's task shares; v3 (decision 0031) adds the kind, the role, the certification text and counts by id. Invoices keep the version they were made with.
- **QR code:** invoice #, period, hours and amount by budget line, fingerprint. Readable after printing or scanning so a later system can match paper to data.

## 8. Signatures (outside the app)

Option A, no in-app signing:

1. The CHW shares the files and emails them to themselves.
2. The CHW signs the PDF (iPhone Markup, or Adobe Acrobat Reader Fill & Sign on Android), or the picture of page 1 in a photo app (decision 0018).
3. The CHW emails the signed file and both CSVs to the reviewer.
4. The reviewer signs and sends everything to the office.

Employees (decision 0031): the employee signs the timesheet summary page (PDF or picture), emails it with both CSVs to their supervisor, and the supervisor signs the same page below the employee's signature and sends everything to the office.

Guardrails, written in a one-page procedure (`docs/signing-procedure.md`, CC BY 4.0): email only, never edit a signed file (corrections are a new invoice from the app), the office keeps the final PDF with its email thread. Office lines are signed on paper.

## 9. Screens

Install gate (iPhone) · Setup: details, Pick your role, Your role (review) · Home (with the role notice and the "No active funding" and "no longer active" messages) · Timer running · What did you do? (tasks and budget line) · Split your time · Counts and notes · Enter times · Invoice preview (New invoice / New timesheet) · Invoice created / Timesheet created (share) · Past invoices / Past timesheets · Settings · Rate change check · Work Hours Report · plus edit entry and "show all entries" (not drawn). See the wireframes.

## 10. Field usability and quality

- High contrast for sunlight; main actions in the bottom third; buttons at least 56 px tall, all targets at least 44 px.
- Large timer digits; Stop is the largest button.
- Lists instead of dropdowns; typing only for notes, custom counts and hand-entered times.
- Every step saves immediately; interruptions never lose a half-entered record.
- Clear confirmation after Save; errors in plain words next to the field; Undo after Save and Delete.
- Follows the phone's light or dark setting.
- WCAG 2.1 AA.
- Neutral styling: gray tones with one accent color (blue `#1f5fc8`). On Home, Record time is as big as Start timer, green with dark brown text (decision 0025); Generate Regen Invoice is light green `#dcefd0` with dark gold `#7a5800` text (decision 0026).

## 11. Out of scope

Expenses or mileage (time only) · "nature of the activity" field · service area · agreement # · backup and restore · server, sync or push notifications · in-app signatures · Excel export · Spanish · logo (slot only) · supplemental invoices for retroactive raises · contractor onboarding documents.

## 12. Open questions (ask Chris before building the affected part)

None as of November 3, 2026.
