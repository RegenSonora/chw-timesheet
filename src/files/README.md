# src/files

The three invoice files (SPEC §7), hand-written. Pure like `src/core`: an invoice in, bytes out, no DOM and no storage (enforced by ESLint). The same invoice always gives the same bytes, so re-sharing a past invoice (SPEC §6) re-creates identical files.

`buildInvoiceFiles(invoice, source)` in `index.ts` returns the PDF, the timesheet CSV and the entry log CSV, named per SPEC §7 and decision 0006. `source` is the current funding source file, used only to order timesheet rows.

| File                    | What                                                                      | Spec                     |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `index.ts`              | `buildInvoiceFiles`                                                       | §7                       |
| `names.ts`              | File names                                                                | §7, decision 0006        |
| `text.ts`               | Printed dates without `Intl`, so output never depends on the phone        | §7                       |
| `csv/csv.ts`            | BOM, RFC 4180 quoting, CRLF, formula-injection guard                      | §7                       |
| `csv/timesheet-csv.ts`  | Timesheet CSV: header block, one block per PDF timesheet page             | §7, decision 0001        |
| `csv/entries-csv.ts`    | Entry log CSV: 22 fixed columns, one row per entry                        | §7, decision 0001        |
| `qr/payload.ts`         | QR payload v1, versioned and pinned by a golden test                      | §7, decision 0011        |
| `qr/matrix.ts`          | QR modules via `qrcode-generator` (MIT), error correction M               | §7                       |
| `pdf/writer.ts`         | Minimal PDF 1.4 writer: Helvetica in WinAnsi, lines, rectangles, squares  | §7                       |
| `pdf/fonts.ts`          | AFM widths, WinAnsi mapping (`?` for what Helvetica can't show), wrapping | §7                       |
| `pdf/invoice-page.ts`   | Page 1; drawn smaller when a long invoice doesn't fit                     | §6, §7                   |
| `pdf/timesheet-page.ts` | Landscape timesheet pages; shrink to 7 pt, then cut notes                 | §7, decisions 0003, 0013 |
| `pdf/invoice-pdf.ts`    | Page 1 plus one page per 7 dates worked                                   | §7                       |

Page 1 lists the five counts and the custom counts used this period (at most 6; the rest are in the entry log CSV), each with its all-time total for the source.

Tests in `tests/files/` open every PDF with pdf.js and decode the QR code with jsQR (both dev dependencies only).
