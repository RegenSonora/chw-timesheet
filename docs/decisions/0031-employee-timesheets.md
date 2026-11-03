# 0031 — Employee (W2) timesheets

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §6, §7, §8
- **Plan:** [roles plan](../roles-plan.md), milestones R3–R5

## Decision

1. **A role's `employment` is `"contractor"` or `"employee"`.** Employees don't invoice; they **submit a timesheet**.
2. **Submitting uses the same single IndexedDB transaction as invoicing:** lock entries, save, advance the counter. The record has `kind: "timesheet"`.
3. **Files:**
   - Timesheet PDF pages and a picture of the first page for signing.
   - Both CSVs, with no dollar amounts anywhere.
   - The rate prints: "Pay rate" in the timesheet CSV header block and on the first PDF page. The entry log keeps its `rate` column.
   - QR code and fingerprint as for invoices.
4. **Numbering:** the same counter and format as invoices, labeled "Timesheet CC-2026-004".
5. **Certification statement:** the source file holds two, `certification_text` for contractors and `employee_certification_text` for employees. A role may override either. The build fails when an employee role has no employee text from its source or itself. TISUPP's employee text:
   > I certify that the hours shown on this timesheet were worked on the dates listed for the TISUPP grant, the hours are accurate, no participant names are included, and these hours have not been reported under any other funding source.
6. **Supervisor approval** on the first page and its picture, below the employee's signature: "Supervisor signature" (a box), "Supervisor name" and "Date", all blank. The employee signs first, then sends it to their supervisor to sign the same page.
7. **NTE:** kept on every role and source for annual budget numbers later. Employee roles leave it blank, Settings shows no NTE field for them, and timesheets print no NTE box.

## Decided during the build

- **Page 1 is a portrait "TIMESHEET" summary page** (Chris, November 3), laid out like the invoice page, with hours only:
  - "Timesheet #", date, service period and "Pay rate $20.00/hr"
  - "From (employee)" and "Employer"
  - hours by budget line and "Total hours"
  - counts (decision 0029)
  - the employee certification
  - the employee signature and date, then the supervisor approval
  - an office box with "Reviewed by" and "Approved by"
  - the QR code

  The landscape timesheet pages follow. The picture for signing is this page, named `…_timesheet.png`.
- **The QR code uses payload v1, the same as invoices**, including amounts per budget line (Chris, November 3).
- **Timesheets track no not-to-exceed amount.** The rule sets the NTE status to "none" for employee roles, so no contract box appears on the page or the preview.
- **Fingerprint canonical form v3** seals the kind, the frozen role (id, code, name, employment, `chw`), the certification text and each entry's counts by id (nonzero values). Forms v1 and v2 are unchanged and older invoices still verify (CLAUDE.md rule 8).
- **Screens:** employees see "Not yet submitted", **Submit timesheet**, "New timesheet", **Create timesheet files**, "Timesheet created" with supervisor signing steps, and **Past timesheets**, where each timesheet shows its hours instead of an amount.

## Why

Employees are paid through payroll, not by invoice, and their timesheets need a supervisor's approval. Keeping the same records, counter, fingerprint and files lets the office handle both with one procedure.
