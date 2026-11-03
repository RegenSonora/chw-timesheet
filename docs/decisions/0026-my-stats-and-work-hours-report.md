# 0026 — My stats, the Work Hours Report, "hrs", and Generate under Past invoices

- **Status:** Accepted, November 2, 2026
- **Spec:** SPEC §3 (TISUPP), §5 (Home), §6 (Generate button), §9 (screens), §10 (styling); changes decision 0025's Generate button

## Decision

### Home

1. **My stats**, a card between "Not yet invoiced" and Past invoices. It counts the **invoiced** hours of the selected source on this phone, which matches the office's records and the NTE tracker.
   - **Hours invoiced:** for example "152.5 hrs", with "+ 4.5 hrs not yet invoiced" under it when entries are waiting.
   - **Hrs needed for pay increase:** the source's `rate_step` hours minus hours invoiced, with "to $23.00/hr at 240 hrs" under it.
     - At or past 240 hrs with the rate still lower, it says "Reached. Change your rate to $23.00 in Settings."
     - It disappears once hours invoiced are at least 240 **and** the rate is at least $23.00.
     - If the rate was raised early, the countdown stays until 240 hrs.
   - **Hrs needed for CHW Cert eligibility:** the source's `certification_step` hours (480) minus hours invoiced.
     - At or past 480 hrs, the row is labelled "CHW Cert eligibility". It shows an **Eligible** button, with the text: Press "Eligible" to generate your Work Hours Report.
   - **Footnote:** "Counts invoices made on this phone."
2. **Generate Regen Invoice** moves out of the bottom bar to just under Past invoices, at the same size as that row. It is light green `#dcefd0` with dark gold `#7a5800` text (5.4:1, AA) and a `#4c8f37` border. It still shows only when entries are waiting.
   - This goes against SPEC §10's "main actions in the bottom third": with many entries waiting, the CHW may need to scroll to reach it.
3. **"hrs" replaces "h"** after hour amounts everywhere in the app ("4.5 hrs"). PDFs and CSVs already print plain numbers.

### Work Hours Report

It helps the CHW fill in the ADHS **Community Health Worker Hours Worked/Volunteered Attestation Form** (revised 06.16.2025). It can be run any time from **Settings › Work Hours Report**, and from the **Eligible** button.

- **Rows:** the form's 11 core competencies, in the form's order and with its wording. Each row has the number of hours and the dates completed, as a comma-separated list (`10/20/2026, 10/22/2026`). A total follows the rows. Competencies with no hours still get a row.
  - Which of the source's competency names count toward which form row is data: `src/reports/adhs-chw-attestation.json`.
- **Hours counted:** invoiced hours of the source, from task shares (decision 0024), only for dates within the past three years, as the form requires.
- **Header:** the applicant's first and last name (split from the name in Settings: first word, then the rest), the organization (Regenerating Sonora, Inc.), the source's funding line, and the period covered.
- **Funding line:** "Trauma-Informed Substance Use Prevention Program (TISUPP), funded by the Governor's Office of Youth, Faith and Family through Arizona State University. Contracted through Regenerating Sonora, Inc." It is stored in the source file as `report_funding_line`.
- **Files:** **Share report** shares a PDF, a picture (PNG) of the page and a CSV together. There is no fingerprint, because this is not an invoice. The authorized representative still fills in and signs the ADHS form itself.

## Why

CHWs asked to see their progress toward the raise and toward CHW certification, and to have the hours for the certification form added up for them. Counting invoiced hours keeps the figures in line with what the office has paid.

## Known limits

- Hours count only invoices made on this phone, the same as the NTE tracker.
- The report has one organization. The ADHS form asks for one page per organization, so hours worked elsewhere need their own form.
