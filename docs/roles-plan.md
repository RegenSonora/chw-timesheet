# Plan: roles, counts per task, Employee timesheets, and the Gila features — Regen Time Tracking

- **Status:** Done, November 3, 2026, version 0.11.0. Decisions [0027–0034](decisions/) hold the final rules, including what was decided during the build; this file is the build plan as written.
- **App:** Regen Time Tracking (`RegenSonora/regen-time-tracking`, https://regensonora.github.io/regen-time-tracking/), version 0.10.0 → **0.11.0**
- **Base:** a new branch from `regen-split`. Gila's committed work is brought over first by cherry-pick, then roles are built on top.
  - Don't work in the Gila worktree under `.claude\worktrees`. It belongs to the other app (`chw-gila-river-contractors`), which stays as it is.
  - Don't use the Historic copy. It's frozen.
- **Estimate:** 35–47 hours of coding-tool work (about 4.5–6 days), plus testing on real phones
- **Spec sections touched:** SPEC §3, §4, §5, §6, §7, §9, §10

## Version and decision numbers

| | Gila port | This plan |
|---|---|---|
| Stored data format | v3 (task shares) | **v4** (roles, counts per task, timesheets) |
| Fingerprint canonical form | v2 (task shares) | **v3** (role, kind, counts per task) |
| Decision records | 0023 (single-choice part only), 0024, 0025, 0026, keeping Gila's numbers | **0027–0034** |

Regen's own records end at 0021. Regen has no 0022; that number is Gila's copy decision and isn't ported.

---

## Part 1 — Decisions

### Ported from Gila (records keep Gila's numbers)

| Record | What comes over | Change for Regen |
|---|---|---|
| 0023 (part) | A choice with one option is picked automatically | **Shown as a label**, never hidden: "Billed to: TISUPP · CHW experience hours". Gila's TISUPP-only source, single budget line, NTE prefill and source-level raise step are **not** ported (roles replace them) |
| 0024 | Several tasks per entry: check boxes, a "Split your time" step in quarter hours, task shares, entry log `part` column, data v3, fingerprint v2 | All checked tasks belong to the one budget line picked for the entry |
| 0025 | "Record time" (green, as big as Start timer), Home text "Start timer and start working or record time." | None |
| 0026 | My stats card, Work Hours Report, "hrs" everywhere, Generate under Past invoices (light green, dark gold text) | My stats is combined across sources and depends on the role (0032). The Work Hours Report is for CHW Trainee roles only (0032). Employees see "Submit timesheet" styled like Generate |

### New decisions

**0027 — Roles first**

1. Logic follows how Regen staffs work: people hold roles, and funding sources pay for roles.
2. **`src/roles/roles.json`** holds the roles. Each role lists its funding sources, the budget lines under each source, and the tasks under each line. Duplicate tasks across lines and roles are fine.
3. **One role per person.**
4. **Setup:** the person types their own name, initials and mailing address, then picks their role. The funding sources come from the role, so there are no source checkboxes.
   - A review screen shows the role's sources, budget lines and tasks, with "This is my role" and "Pick a different role".
   - The rate is prefilled (0030), and the role can be changed until setup is finished.
5. **The role is locked after setup.** The office changes what people see by editing a role (affects everyone in it) or by retiring a role with `replaced_by` (moves everyone in it).
6. **No change code.** A wrong pick is fixed one of two ways:
   - The person invoices or submits any waiting hours, then clears the app's data and sets up again. On iPhone that means removing the app from the Home Screen and reinstalling; on Android, clearing the site's data in Chrome.
   - Or the office retires the role and points it at the right one, which moves everyone in it.
7. Roles never name a person, so nothing personal ships in the public page.
8. No one has real entries yet, so nothing on phones needs migrating.

**0028 — Entry flow and labels**

1. **The flow:** funding source → budget line → tasks for that line (check boxes) → split your time (when two or more tasks are checked) → counts for the checked tasks, plus notes.
2. **Any step with one option is picked automatically and shown as a plain label**, never a greyed-out control. For example, at the top of the task step: "Billed to: **TISUPP · CHW experience hours**". The same label shows on each entry in the Home list and on the review screen.
3. **Budget line display names.** A budget line may carry a `display_name` shown in the app, while its `name` prints on invoices, timesheets and CSVs. Example: the app shows "Other"; the files show "Other contractors". Without a `display_name`, `name` is used everywhere.
4. **No time splits across sources.** Each entry is billed to one source.

**0029 — Counts per task**

1. **One shared count list** at the top of `roles.json`. Each task in a role lists the counts it shows (`count_ids`), and a task can list none.
   - Count ids use underscores (`trailer_loads_removed`) because they become entry log column names. Task and budget line ids use hyphens.
   - Count ids never change and are never reused.
2. **Units:** a count may carry a unit (`"unit": "gal"`, `"sq ft"`). Values are whole numbers.
3. **"Add another count" stays on every role and task.** If a typed label matches one of the entry's counts (ignoring letter case and spaces), the app points the person to that count instead of adding a duplicate.
4. **Split entries:** the person sees the combined counts of every checked task, entered once. The entry log puts them on part 1 (Gila decision 0024).
5. **Invoice and timesheet page:** lists only counts with a value in the period, each with its all-time total beside it. Example: "Trees planted: 6 (all time: 41)".
6. **Entry log CSV:** one column for every count in the roles file, in list order, blank where not used. New counts go at the end of the list.
   - A count taken out of every task is marked `"retired": true`, not deleted, and keeps its column.
   - "Add another count" values stay in the single `other_counts` column, joined with "; ".

**0030 — Rates and the pay raise**

1. **Rate prefill at setup, per source.** The first of these that's set is used:
   - the role's funding entry `rate_cents`
   - the role's `suggested_rate_cents`
   - the source's `default_rate_cents`
2. **The person can still change a rate in Settings**, which covers the rare person paid more or less than their role's rate.
3. **The pay raise is a reminder, not a calculation** (as in Gila). It lives on the role's funding entry as `rate_step` and counts that source's invoiced or submitted hours. Only roles whose agreement has a raise get one: today, the CHW Trainee roles on TISUPP.
4. **Reminder wording** at 240 hours:
   - Contractor: "You've reached 240 hours. Generate your invoice now, then change your rate to $23.00 in Settings."
   - Employee: "You've reached 240 hours. Submit your timesheet now, then change your rate to $23.00 in Settings."
   - Once the hours are invoiced or submitted, Home says the rate is now $23.00 and asks for the change in Settings before the next invoice or timesheet.

**0031 — Employee (W2) timesheets**

1. A role's `employment` is `"contractor"` or `"employee"`. Employees don't invoice; they **submit a timesheet**.
2. Submitting uses the same single IndexedDB transaction as invoicing: lock entries, save, advance the counter. The record has `kind: "timesheet"`.
3. **Files:**
   - Timesheet PDF pages and a picture of the first page for signing.
   - Both CSVs, with no dollar amounts anywhere.
   - The rate prints: "Pay rate" in the timesheet CSV header block and on the first PDF page. The entry log keeps its `rate` column.
   - QR code and fingerprint as for invoices.
4. **Numbering:** the same counter and format as invoices, labeled "Timesheet CC-2026-004".
5. **Certification statement:** the source file holds two, `certification_text` for contractors and `employee_certification_text` for employees. A role may override either. TISUPP's employee text:
   > I certify that the hours shown on this timesheet were worked on the dates listed for the TISUPP grant, the hours are accurate, no participant names are included, and these hours have not been reported under any other funding source.
6. **Supervisor approval line** on the first timesheet page and its picture, below the employee's signature: "Supervisor signature", "Supervisor name", "Date", all blank. The employee signs first, then sends it to their supervisor to sign the same page.
7. **NTE:** kept on every role and source for annual budget numbers later. Employee roles leave it blank, and timesheets print no NTE box.

**0032 — CHW-specific behavior and My stats by role**

1. A role setting **`chw: true`** turns on:
   - the core competency column on timesheet pages and in the timesheet CSV
   - task core competencies feeding the Work Hours Report (where the role also has `certification_step`)
2. With **`chw: false`** (for example the Resilience Team Lead), the core competency column is left off the timesheet PDF and timesheet CSV. The entry log keeps the column, blank, so files stack.
3. **Certification** lives on the role (`certification_step`, 480 hours), only on CHW Trainee roles.
   - It counts the role's invoiced or submitted hours. CHW Trainees bill TISUPP only, so these are TISUPP hours.
   - My stats counts down to it. At 480 hours it shows the **Eligible** button, which opens the Work Hours Report.
4. **Work Hours Report** (Gila decision 0026):
   - **CHW Trainee roles:** available from Settings and the Eligible button.
   - **Certified CHW roles:** hidden for now.
   - **Non-CHW roles:** not shown; their own report comes later.
   - Combines all sources, though in practice CHW Trainees have only TISUPP.
   - For employees, "invoiced hours" means submitted timesheet hours.
5. **My stats**, combined across all of the person's sources:
   - **Every role:** hours invoiced (contractors) or submitted (employees), with "+ X hrs not yet invoiced/submitted" under it.
   - **Roles with a `rate_step`:** "Hrs needed for pay increase".
   - **Roles with a `certification_step`:** "Hrs needed for CHW Cert eligibility".
   - **Every role:** all-time totals of their counts, for example trees planted, or screenings conducted.
   - Footnote: "Counts invoices and timesheets made on this phone."

**0033 — Grant periods**

1. Each source file gets `period_start` and `period_end`. A role's funding entry may set its own earlier `ends`.
2. A source isn't offered for time dated outside its period. Hours dated inside the period can still be logged and invoiced or submitted after it ends.
3. If every source on a role has ended, Home says: "No active funding for your role. Ask the office."
4. **TISUPP:** October 1, 2026 to September 30, 2027. **Regen General Operating:** no end date.

**0034 — "Contractor" and "Employee" wording**

Where Gila says "CHW", files and screens use the role's type:

| Where | Contractor | Employee |
|---|---|---|
| Invoice or timesheet caption (was "Contractor (CHW)") | Contractor | Employee |
| Timesheet initials label (was "CHW initials") | Contractor initials | Employee initials |
| Timesheet CSV header row (was "CHW") | Contractor | Employee |
| Setup, Settings and README copy | Neutral ("you", "your name") | Neutral |

---

## Part 2 — Starting content

### Shared count list

| id | Label | Unit | Used by |
|---|---|---|---|
| `contacts` | Contacts | | CHW Trainee |
| `referrals_given` | Referrals given | | CHW Trainee |
| `referral_followups` | Referral follow-ups | | CHW Trainee |
| `rides_provided` | Rides provided | | CHW Trainee |
| `applications_completed` | Applications completed | | CHW Trainee |
| `client_goals_achieved` | Client goals achieved | | CHW Trainee |
| `quick_wins_provided` | Quick wins provided | | CHW Trainee |
| `screenings_conducted` | Screenings conducted | | CHW Trainee |
| `applications_approved` | Applications approved | | CHW Trainee |
| `trailer_loads_removed` | Trailer loads removed | | R-TL01 |
| `assessments_completed` | Assessments completed | | R-TL01 |
| `lehr_resets_completed` | LEHR resets completed | | R-TL01 |
| `plants_propagated` | Plants propagated | | R-TL01 |
| `trees_planted` | Trees planted | | R-TL01 |
| `trees_removed` | Trees removed | | R-TL01 |
| `water_capacity_added` | Water capacity added | gal | R-TL01 |
| `grow_space_added` | Grow space added | sq ft | R-TL01 |
| `certifications_earned` | Certifications earned | | R-TL01 |

The five original CHW counts keep their existing ids, so the v3 → v4 data upgrade maps them directly.

### Roles

| Code | Name | Type | `chw` | Funding | Rate | NTE | Raise | Certification |
|---|---|---|---|---|---|---|---|---|
| CHW-TC01 | CHW Trainee (Contractor) | Contractor | true | TISUPP | $20.00 | $10,320.00 | $23.00 after 240 hrs | 480 hrs |
| CHW-TE01 | CHW Trainee (Employee) | Employee | true | TISUPP | $20.00 | blank | $23.00 after 240 hrs | 480 hrs |
| R-TL01 | Resilience Team Lead | Contractor | false | Regen General Operating | $22.00 | none (source has no NTE) | none | none |

Placeholders, defined later: Certified CHW (CHW-C01 contractor, CHW-E01 employee; TISUPP and Regen GO; no raise, no certification) and Resilience Contractor (R-C01).

### CHW Trainee roles (CHW-TC01 and CHW-TE01, identical tasks and counts)

TISUPP · budget line **CHW experience hours** · all 21 current TISUPP tasks, unchanged. Counts as saved in the counts grid on November 3, 2026:

| Task | Core competency | Counts |
|---|---|---|
| Outreach | Outreach | Contacts |
| Interview and intake | Individual & Community Assessment | Screenings conducted, Applications completed |
| Screening and referrals | Individual & Community Assessment | Referrals given, Screenings conducted, Referral follow-ups, Applications completed |
| Resource research | Knowledge Base | Referral follow-ups, Contacts |
| Resource acquisition | Service Coordination & Navigation | Quick wins provided, Applications approved, Client goals achieved, Applications completed, Rides provided, Referral follow-ups, Referrals given, Contacts |
| Application assistance | Service Coordination & Navigation | Applications completed, Applications approved, Referrals given, Client goals achieved, Quick wins provided |
| Transportation | Service Coordination & Navigation | Rides provided, Quick wins provided, Client goals achieved, Applications completed |
| Advocacy | Advocacy | Quick wins provided, Referral follow-ups, Referrals given, Client goals achieved, Screenings conducted, Applications approved |
| Conversational support | Communication Skills | Contacts, Quick wins provided, Referrals given |
| Supporting client self-efficacy | Capacity-Building | Client goals achieved, Referrals given, Applications completed, Quick wins provided, Applications approved |
| Technical assistance | Education & Facilitation | Client goals achieved, Quick wins provided |
| Client or community workshops | Education & Facilitation | Contacts |
| Client check in | Interpersonal & Relationship-Building | Client goals achieved, Quick wins provided, Referrals given, Referral follow-ups, Applications completed |
| Client follow up | Service Coordination & Navigation | Referral follow-ups, Client goals achieved, Applications approved, Quick wins provided, Applications completed, Referrals given |
| Re-screening | Individual & Community Assessment | Referrals given, Screenings conducted, Contacts |
| Individual and community assessment | Individual & Community Assessment | Contacts, Screenings conducted, Referrals given |
| Documentation | Professional Skills & Conduct | none |
| Data analysis and reporting | Evaluation & Research Skills | none |
| Developing tools/processes | Professional Skills & Conduct | none |
| Meetings | Professional Skills & Conduct | none |
| Training / continuing education | Professional Skills & Conduct | none |

On screen, counts show in the shared list's order, not the order above.

### Resilience Team Lead (R-TL01)

Regen General Operating · `chw: false`

| Budget line (file name / app name) | Task | Counts |
|---|---|---|
| Fire risk reduction work | Firewise assessing | Assessments completed, Trailer loads removed |
| | Residential fuel reduction | Trailer loads removed |
| | Municipal fuel reduction | Trailer loads removed |
| | Dump runs | Trailer loads removed |
| Maintenance labor | LEHR maintenance | LEHR resets completed |
| | Pinal garden maintenance | none |
| | Regen lot clean and maintenance | none |
| | Transport and supply runs | none |
| Resilient Home Services contracting | Plant propagation | Plants propagated |
| | Tree planting | Trees planted |
| | Tree removal | Trees removed |
| | Water harvesting | Water capacity added (gal) |
| | Garden support | Grow space added (sq ft) |
| Team development | Paid training | Certifications earned |
| Other contractors / **Other** | Other | none |

Regen General Operating's source file gains these 5 budget lines and 15 tasks (no core competency). Its existing 13 CHW budget lines and 22 tasks stay for the certified CHW roles.

### Funding source file changes

- **TISUPP:**
  - version bump
  - `period_start: 2026-10-01`, `period_end: 2027-09-30`
  - `employee_certification_text`
  - `report_funding_line` (from Gila)
  - a new budget line, **CHW experience hours** (`chw-experience-hours`, from Gila), alongside Regen's existing 12 TISUPP lines
- **Regen General Operating:** version bump, the R-TL01 budget lines and tasks, `display_name` on "Other contractors".
- **Removed from source files:** the source-level `rate_step`, `certification_step` and `default_nte_cents` from Gila. They live on roles now.

---

## Part 3 — Milestones

For every milestone: tests come first, commits are small and cite the spec (`Refs: SPEC §5`), and `pnpm check` and the browser tests (e2e) pass before moving on.

### P0 — Prep (30 min)

1. Confirm the Gila branches are fully committed.
   - As of November 3, no file in the Gila worktree's `src` was changed after the last `gila-my-stats` commit.
   - Check that `gila-my-stats` contains the `gila-task-split` and `gila-record-time` commits. If those branches weren't merged in, cherry-pick them in order.
2. In the `chw-timesheet` folder, create `roles` from `regen-split`.

### P1 — Port Gila (8–12 h)

1. Cherry-pick with `-x`, in order:
   - **`gila-contractors-simplify`:** only the single-choice commits (`feat(core)` and `feat(ui)` for hiding pickers). Drop the TISUPP-only source change and the 240-hour logic, which return in R2 as role data.
   - **`gila-task-split`:** all commits.
   - **`gila-record-time`:** all commits.
   - **`gila-my-stats`:** all commits.
2. Resolve conflicts in Regen's favor where they touch sources: keep both Regen sources and their budget lines.
3. Change the hidden single-choice rows to "Billed to" labels (0028).
4. Copy decision records 0023 (single-choice part only, with a note on what wasn't ported), 0024, 0025 and 0026 into Regen's `docs/decisions/`, noting "Ported from chw-gila-river-contractors".
5. Release-ready checkpoint: Regen runs with task splits, Record time, My stats and "hrs", on data v3 and fingerprint v2.

### R1 — Roles file and source files (3–4 h)

1. `schemas/roles.schema.json` and `src/roles/roles.json` with the count list and the three roles above.
2. Source file changes listed in Part 2.
3. **Build checks** (extend `scripts/check-funding-sources.mjs`). The build fails, with a plain message naming the role and field, when:
   - an id or code is duplicated, or a retired id is reused
   - a count id is reused, or a retired count reappears under a different label
   - a role names a source, budget line, task or count that doesn't exist
   - a role has no funding, a funding entry has no budget lines, or a budget line has no tasks
   - `replaced_by` points to a missing or retired role, or forms a loop
   - a money field isn't a whole number of cents, or an NTE is set on a source without one
   - a `display_name` is blank
   - `period_end` comes before `period_start`, or a funding entry's `ends` is outside its source's period
   - a `chw: false` role sets `certification_step`
4. A test for every failing case, and the shipped files passing.

### R2 — Rules core (4–5 h)

New or extended pure functions in `src/core/`:

- `roleChoices(roles)`, `resolveRole(roles, id)` (follows `replaced_by`)
- `fundingChoices(role, sources, date)`: drops sources outside their period
- `budgetLineChoices(role, source)`, `taskChoices(role, source, lineId, recentIds)`
- `countChoices(role, source, lineId, taskIds)`: the union of the checked tasks' counts, in list order
- `prefillRate(role, fundingEntry, source)` (0030)
- `raiseStatus(role, fundingEntry, hours)`, `certificationStatus(role, hours)`, from Gila's `rate-change.ts` and `stats.ts`
- `myStats(entries, invoices, role)`: combined across sources (0032)
- `duplicateCountLabel(label, counts)` (0029)
- `invoiceCounts(period, allTime)`: only counts with a value, each paired with its all-time total

### R3 — Storage, data v4 (2–3 h)

- **Profile:** gains `role_id`. Source settings come from the role; each keeps an editable `rate_cents` and `nte_cents`.
- **Entry:**
  - gains `role_id`
  - `counts` becomes `{ values: { [count_id]: number }, other: OtherCount[] }`
  - the v3 → v4 upgrade moves the five fixed fields into `values` under the same ids
- **Invoice record:**
  - gains `kind` (`"invoice"` | `"timesheet"`)
  - freezes the role's `id`, `code`, `name`, `employment` and `chw`
  - freezes the count labels and units used
- Upgrades from v1, v2 and v3 stay tested (CLAUDE.md rule 7), including a v3 entry with task shares.

### R4 — Screens (5–6 h)

1. **Setup:**
   - name, initials and mailing address
   - **Pick your role:** a list of active roles by code and name
   - review screen
   - rates prefilled per source
2. **Entry flow** (0028): source, budget line, task check boxes, split your time, counts and notes. Each one-option step shows as a "Billed to" label. Counts follow `countChoices`, and "Add another count" runs the duplicate check.
3. **Home:**
   - "Generate Regen Invoice" (contractors) or "Submit timesheet" (employees), styled per Gila decision 0026
   - raise reminder wording per 0030
   - "No active funding for your role" when every source has ended
4. **Settings:**
   - Role shown read-only, as "CHW-TC01 · CHW Trainee (Contractor)", with the note "Set at setup. Ask the office to change it."
   - Rates and NTE editable per source.
   - Work Hours Report entry only when the role has `certification_step`.
   - "Add a funding source" removed.
5. **Past invoices** reads "Past timesheets" for employees.

### R5 — Files (6–8 h)

1. **Invoice page:** counts with a value in the period, each with its all-time total (0029). The caption reads "Contractor" (0034).
2. **Timesheet pages:**
   - core competency column only when `chw: true` (0032), with the other columns re-spaced
   - "Contractor initials" or "Employee initials"
3. **Employee timesheet:**
   - no invoice page and no amounts
   - "Pay rate" printed
   - employee certification text
   - supervisor approval line (0031)
   - picture of the first page, including the supervisor line
4. **Timesheet CSV:** "Contractor" or "Employee" row, "Pay rate" for employees, "Timesheet #" label for employees.
5. **Entry log CSV:** a column for every count in list order, retired counts kept, `other_counts` unchanged, split entries with counts on part 1.
6. **Fingerprint canonical form v3** adds `kind`, the role id and the count map. v1 and v2 invoices must still verify (rule 8).
7. PDFs open with selectable text, CSVs parse, QR codes decode; golden files updated.

### R6 — My stats and reports by role (3–4 h)

1. My stats per 0032: combined hours, raise row, certification row, count totals.
2. The Work Hours Report only for roles with `certification_step`. It counts invoiced or submitted hours from task shares, across all sources, for the past three years.
3. Non-CHW roles: no report entry yet (their report comes later).

### R7 — Office changes after setup (1–2 h)

- **Role edited:**
  - New choices show after the update.
  - An entry using a removed budget line, task or count keeps it and can still be invoiced; editing it asks for a new pick.
  - A count removed from a task stays on entries that already have a value.
- **Role retired with `replaced_by`:**
  - The phone switches on its next open, and Home shows "Your role was updated by the office: R-TL02 · …" once.
  - Hours already waiting keep their old role.
  - Rates aren't changed automatically; the notice shows the new suggested rate if it differs.
- **Role retired with no replacement:** waiting hours can still be invoiced or submitted, and new time is blocked with "Your role is no longer active. Ask the office."
- **Contractor/Employee switch** through a replacement role: waiting hours are invoiced or submitted under the old type first.
- **A source's period ends:** handled by 0033.

### R8 — Docs and release (2 h)

- **SPEC:** §3–§7, §9 and §10 updated. Decision records 0027–0034 added.
- **README:**
  - "Editing roles" for office staff: adding a role, changing what a role sees, adding a count, retiring a role or a count, grant dates, and what the build-failure messages mean.
  - Install and daily use rewritten for role-based setup, with neutral wording.
- **Signing procedure:** an Employee section covering the employee's and the supervisor's signatures.
- **Release checklist**, on one iPhone and one Android phone:
  - setup with each of the three roles
  - a split entry with counts
  - a contractor invoice and an employee timesheet, each signed
  - My stats for a CHW Trainee and for R-TL01
  - the Work Hours Report
  - a role edit reaching the phone through "Updated, tap to reload"
- Version 0.11.0.

| Milestone | Hours |
|---|---|
| P0 Prep | 0.5 |
| P1 Port Gila | 8–12 |
| R1 Roles and source files | 3–4 |
| R2 Rules core | 4–5 |
| R3 Storage v4 | 2–3 |
| R4 Screens | 5–6 |
| R5 Files | 6–8 |
| R6 My stats and reports | 3–4 |
| R7 Office changes | 1–2 |
| R8 Docs and release | 2 |
| **Total** | **34.5–46.5** |

---

## Later (not in this plan)

- Certified CHW roles (CHW-C01, CHW-E01) and the Resilience Contractor (R-C01)
- The activity report for non-CHW roles
- The Work Hours Report for certified CHW roles
- Display names for tasks (like budget lines)
- Roster privacy beyond roles (not needed while roles name no one)
- Merging Regen and Gila into one app
