# 0032 — CHW-specific behavior and My stats by role

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §5 (My stats, Work Hours Report), §7 (core competency column)
- **Plan:** [roles plan](../roles-plan.md), milestones R5, R6
- **Changes:** decision 0026's My stats and Work Hours Report, for phones with a role

## Decision

1. **A role setting `chw: true` turns on:**
   - the core competency column on timesheet pages and in the timesheet CSV
   - task core competencies feeding the Work Hours Report (where the role also has `certification_step`)
2. **With `chw: false`** (for example the Resilience Team Lead), the core competency column is left off the timesheet PDF and timesheet CSV, and the task and budget line columns get its space. The entry log keeps the column, blank, so files stack.
3. **Certification** lives on the role (`certification_step`, 480 hours), only on CHW Trainee roles.
   - It counts the role's invoiced or submitted hours, across the person's sources.
   - My stats counts down to it. At 480 hours it shows the **Eligible** button, which opens the Work Hours Report.
4. **Work Hours Report** (decision 0026):
   - **CHW Trainee roles:** available from Settings and the Eligible button.
   - **Certified CHW roles:** hidden for now.
   - **Non-CHW roles:** not shown; their own report comes later.
   - Combines all of the role's sources. The report is named after the sources with hours in it (codes joined with "+"), though in practice CHW Trainees have only TISUPP.
   - For employees, "invoiced hours" means submitted timesheet hours.
5. **My stats**, combined across all of the person's sources:
   - **Every role:** "Hours invoiced" (contractors) or "Hours submitted" (employees), with "+ X hrs not yet invoiced/submitted" under it.
   - **Roles with a `rate_step`:** "Hrs needed for pay increase".
   - **Roles with a `certification_step`:** "Hrs needed for CHW Cert eligibility".
   - **Every role:** all-time totals of their counts, for example trees planted or screenings conducted.
   - Footnote: "Counts invoices and timesheets made on this phone."

## Decided during the build

- **Count rows show only totals above 0**, in list order with units ("250 gal"). Before any count has a total, the card says "No counts yet." (Chris, November 3).
- **No "Add another count" totals in My stats** (Chris, November 3). They stay on each page and in the entry log.
- **TISUPP's source-level `rate_step` and `certification_step` stay in `tisupp.json`** while phones with no role exist, because those phones still use them (Chris, November 3). Remove them once every phone has a role.
- **Phones with no role keep 0026's source-based card and report.**

## Why

What counts as progress depends on the job: CHW Trainees work toward a raise and certification, the Team Lead toward work completed. Tying both to the role shows each person the measures that matter to them.
