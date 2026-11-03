// Invoice created (SPEC §6–§8, wireframe Share): the four files, Share, and the signing steps.
// The same screen re-shares a past invoice, re-creating its files from stored data. A timesheet
// shows hours, not dollars, and its steps add the supervisor's signature (decision 0031).
import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { formatDollars, paginateTimesheet, shortFingerprint } from '../../core';
import { buildInvoiceFiles, invoicePageShapes, pngName, type InvoiceFile } from '../../files';
import { dateRange } from '../../files/text';
import { findFundingSource } from '../../funding-sources';
import { CheckIcon, Confirm, Page } from '../components';
import { hoursLabel, plural } from '../format';
import { pagePng } from '../page-image';
import { shareFiles, toFiles, type ShareOutcome } from '../share';
import { COUNT_DEFS } from '../../roles';
import { useApp } from '../store';

const STATUS: Record<ShareOutcome, string> = {
  shared: 'Files shared.',
  cancelled: 'Not shared yet.',
  downloaded: 'Files saved to your downloads. Attach them to an email to yourself.',
};

export function InvoiceReady() {
  const { data, viewing, actions } = useApp();
  const invoice = data.invoices.find((i) => i.id === viewing?.invoice_id);
  const created = viewing?.created ?? false;
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [asking, setAsking] = useState(false);
  const shared = outcome === 'shared' || outcome === 'downloaded';

  // Built when the screen opens, so a tap on Share keeps its gesture for the share sheet.
  const files = useMemo(() => {
    if (!invoice) return null;
    const source = findFundingSource(invoice.source.id) ?? { tasks: [], budget_lines: [] };
    const pages = paginateTimesheet(invoice, source).length;
    const [pdf, timesheet, entries] = buildInvoiceFiles(invoice, source, COUNT_DEFS);
    const png = pagePng(invoicePageShapes(invoice, source));
    const first = invoice.kind === 'timesheet' ? 'Timesheet summary' : 'Invoice';
    const list: { file: InvoiceFile; tag: string; detail: string }[] = [];
    if (pdf) {
      list.push({
        file: pdf,
        tag: 'PDF',
        detail: `${first} + ${plural(pages, 'timesheet page', 'timesheet pages')}. Sign this or the picture.`,
      });
    }
    // The picture of page 1, for signing in a photo app (decision 0018).
    if (png) {
      list.push({
        file: { name: pngName(invoice), type: 'image/png', bytes: png },
        tag: 'PNG',
        detail: `Picture of the ${first.toLowerCase()} page, for signing in a photo app`,
      });
    }
    if (timesheet) {
      list.push({ file: timesheet, tag: 'CSV', detail: 'Timesheet table, 7 dates per page' });
    }
    if (entries) {
      list.push({ file: entries, tag: 'CSV', detail: 'Every entry with start and stop times' });
    }
    return list;
  }, [invoice]);

  // A new invoice's files must leave the phone: ask before the back gesture leaves unshared.
  // Layout effect: set before paint, so a fast back gesture can't slip past.
  useLayoutEffect(() => {
    actions.setGuard(
      created && !shared
        ? () => ({
            title: 'Leave without sharing?',
            body: `You can share the files later from Past ${invoice?.kind === 'timesheet' ? 'timesheets' : 'invoices'} on Home.`,
            confirm: 'Leave without sharing',
            cancel: 'Stay',
          })
        : null,
    );
    return () => {
      actions.setGuard(null);
    };
  }, [actions, created, shared]);

  if (!invoice || !files) return null;
  const timesheet = invoice.kind === 'timesheet';
  const Noun = timesheet ? 'Timesheet' : 'Invoice';

  const share = async () => {
    setAsking(false);
    setOutcome(await shareFiles(toFiles(files.map((f) => f.file)), `${Noun} ${invoice.number}`));
  };

  const done = () => {
    if (created && !shared) setAsking(true);
    else actions.home();
  };

  return (
    <Page
      title={created ? `${Noun} created` : `${Noun} ${invoice.number}`}
      back={!created}
      footer={
        <>
          <button type="button" class="btn" onClick={() => void share()}>
            Share files
          </button>
          <button type="button" class="btn2" onClick={done}>
            Done
          </button>
        </>
      }
    >
      <div class="ready-head">
        {created && <CheckIcon />}
        <div>
          <h2 class="ready-title">
            {created ? `${Noun} ${invoice.number} is ready` : invoice.source.code}
          </h2>
          <p class="hint">
            {created
              ? `${plural(invoice.entries.length, 'entry is', 'entries are')} now locked.`
              : `${dateRange(invoice.period_start, invoice.period_end)} · ${
                  timesheet
                    ? hoursLabel(invoice.total_quarters)
                    : formatDollars(invoice.total_cents)
                }`}
          </p>
        </div>
      </div>

      <ul class="card files" aria-label={`${Noun} files`}>
        {files.map(({ file, tag, detail }) => (
          <li key={file.name} class="file">
            <span class="file-tag" aria-hidden="true">
              {tag}
            </span>
            <span class="file-text">
              <span class="file-name">{file.name}</span>
              <span class="file-detail">{detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 class="sec">Next steps</h2>
      <ol class="next-steps">
        <li>Share the files and email them to yourself.</li>
        <li>
          Sign the PDF (Markup on iPhone, or Adobe Acrobat Fill &amp; Sign on Android), or sign the
          picture in your photo app. Sign one, not both.
        </li>
        {timesheet ? (
          <>
            <li>Email the signed file and both CSV files to your supervisor.</li>
            <li>Your supervisor signs the same page and sends everything to the office.</li>
          </>
        ) : (
          <>
            <li>Email the signed file and both CSV files to your reviewer.</li>
            <li>Your reviewer signs and sends everything to the office.</li>
          </>
        )}
      </ol>
      <p class="hint">Fingerprint {shortFingerprint(invoice.fingerprint)}</p>

      <p class="share-status" role="status">
        {outcome && STATUS[outcome]}
      </p>

      {asking && (
        <Confirm
          title="Share the files first?"
          body={
            <p>
              You can share them later from Past {timesheet ? 'timesheets' : 'invoices'} on Home.
            </p>
          }
          confirm="Share files"
          second={{
            label: 'Done anyway',
            onClick: () => {
              actions.home();
            },
          }}
          cancel="Cancel"
          onConfirm={() => void share()}
          onCancel={() => {
            setAsking(false);
          }}
        />
      )}
    </Page>
  );
}
