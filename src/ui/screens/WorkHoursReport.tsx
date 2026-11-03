// Work Hours Report (decision 0026): invoiced hours per core competency with the dates worked,
// for the ADHS CHW hours attestation form. Shares a PDF, its picture and a CSV. With a role it
// combines every source the role bills (decision 0032); with none, the selected source.
import { useMemo, useState } from 'preact/hooks';
import { workHoursReport, type FundingSourceConfig, type ReportForm } from '../../core';
import {
  buildWorkHoursFiles,
  datesText,
  reportBaseName,
  usDate,
  workHoursPageShapes,
  type InvoiceFile,
  type ReportDetails,
} from '../../files';
import adhs from '../../reports/adhs-chw-attestation.json';
import { phoneNow } from '../../storage';
import { sourceById } from '../store';
import { Page } from '../components';
import { hoursLabel, localDateTime, plural } from '../format';
import { pagePng } from '../page-image';
import { shareFiles, toFiles, type ShareOutcome } from '../share';
import { useApp } from '../store';

const FORM: ReportForm = adhs;

const STATUS: Record<ShareOutcome, string> = {
  shared: 'Report shared.',
  cancelled: 'Not shared yet.',
  downloaded: 'Report saved to your downloads.',
};

export function WorkHoursReport() {
  const { data, selectedSource, role } = useApp();
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  // Built when the screen opens, so a tap on Share keeps its gesture for the share sheet.
  const built = useMemo(() => {
    if (!selectedSource || !data.profile) return null;
    const now = phoneNow();
    const ids = role
      ? [
          ...new Set([
            ...role.funding.map((f) => f.source_id),
            ...data.invoices.map((i) => i.source.id),
          ]),
        ]
      : [selectedSource.id];
    const report = workHoursReport(FORM, data.invoices, ids, localDateTime(now).date);
    // The sources with hours in the report name it; with none, the first one asked for.
    const withHours = ids.filter((id) =>
      data.invoices.some((i) => i.source.id === id && report.invoice_numbers.includes(i.number)),
    );
    const named: FundingSourceConfig[] = (withHours.length ? withHours : ids.slice(0, 1)).map(
      sourceById,
    );
    const details: ReportDetails = {
      chw_name: data.profile.name,
      source_code: named.map((s) => s.code).join('+'),
      funding_line: named.map((s) => s.report_funding_line ?? s.name).join('; '),
      made_at: now,
    };
    const [pdf, csv] = buildWorkHoursFiles(FORM, report, details);
    const png = pagePng(workHoursPageShapes(FORM, report, details));
    const files: InvoiceFile[] = [
      ...(pdf ? [pdf] : []),
      ...(png
        ? [
            {
              name: `${reportBaseName(details, report)}.png`,
              type: 'image/png' as const,
              bytes: png,
            },
          ]
        : []),
      ...(csv ? [csv] : []),
    ];
    return { report, files };
  }, [data.invoices, data.profile, selectedSource, role]);

  if (!built) return null;
  const { report, files } = built;
  const rows = report.other.quarters > 0 ? [...report.rows, report.other] : report.rows;

  const share = async () => {
    setOutcome(await shareFiles(toFiles(files), 'CHW Work Hours Report'));
  };

  return (
    <Page
      title="Work Hours Report"
      back
      footer={
        <button type="button" class="btn" onClick={() => void share()}>
          Share report
        </button>
      }
    >
      <div class="card report-head">
        <p class="report-total">{hoursLabel(report.total_quarters)} worked</p>
        <p class="hint">
          {role
            ? 'Invoiced or submitted hours, all your funding sources,'
            : `Invoiced ${selectedSource?.code ?? ''} hours,`}{' '}
          {usDate(report.window_start)} – {usDate(report.made_on)} (past 3 years),{' '}
          {role?.employment === 'employee'
            ? plural(report.invoice_numbers.length, 'timesheet', 'timesheets')
            : plural(report.invoice_numbers.length, 'invoice', 'invoices')}
          .
        </p>
      </div>
      <p class="hint">
        For the ADHS Community Health Worker Hours Worked/Volunteered Attestation Form. Copy each
        line onto the form; your organization's representative fills in and signs the rest.
      </p>
      <table class="card report-table">
        <caption class="sr-only">Hours and dates by core competency</caption>
        <thead>
          <tr>
            <th scope="col">Core competency</th>
            <th scope="col" class="report-hrs">
              Hrs
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} class={r.quarters === 0 ? 'report-none' : undefined}>
              <th scope="row">
                {r.name}
                {r.dates.length > 0 && <span class="report-dates">{datesText(r.dates)}</span>}
              </th>
              <td class="report-hrs">{hoursLabel(r.quarters).replace(/ hrs?$/, '')}</td>
            </tr>
          ))}
          <tr class="report-sum">
            <th scope="row">Total</th>
            <td class="report-hrs">{hoursLabel(report.total_quarters).replace(/ hrs?$/, '')}</td>
          </tr>
        </tbody>
      </table>
      <p class="hint">
        Shares {files.map((f) => f.name.split('.').pop()?.toUpperCase()).join(', ')}: the report
        page, a picture of it, and a spreadsheet.
      </p>
      <p class="share-status" role="status">
        {outcome && STATUS[outcome]}
      </p>
    </Page>
  );
}
