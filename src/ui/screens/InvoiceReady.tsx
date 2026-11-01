// Invoice created (SPEC §6–§8, wireframe Share): the three files, Share, and the signing steps.
// The same screen re-shares a past invoice, re-creating its files from stored data.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatDollars, paginateTimesheet, shortFingerprint } from '../../core';
import { buildInvoiceFiles } from '../../files';
import { dateRange } from '../../files/text';
import { findFundingSource } from '../../funding-sources';
import { CheckIcon, Confirm, Page } from '../components';
import { plural } from '../format';
import { shareFiles, toFiles, type ShareOutcome } from '../share';
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
    return {
      list: buildInvoiceFiles(invoice, source),
      pages: paginateTimesheet(invoice, source).length,
    };
  }, [invoice]);

  // A new invoice's files must leave the phone: ask before the back gesture leaves unshared.
  useEffect(() => {
    actions.setGuard(
      created && !shared
        ? () => ({
            title: 'Leave without sharing?',
            body: 'You can share the files later from Settings › Past invoices.',
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

  const share = async () => {
    setAsking(false);
    setOutcome(await shareFiles(toFiles(files.list), `Invoice ${invoice.number}`));
  };

  const done = () => {
    if (created && !shared) setAsking(true);
    else actions.home();
  };

  const describe = [
    `Invoice + ${plural(files.pages, 'timesheet page', 'timesheet pages')}. This is the one you sign.`,
    'Timesheet table, 7 dates per page',
    'Every entry with start and stop times',
  ];

  return (
    <Page
      title={created ? 'Invoice created' : `Invoice ${invoice.number}`}
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
            {created ? `Invoice ${invoice.number} is ready` : invoice.source.code}
          </h2>
          <p class="hint">
            {created
              ? `${plural(invoice.entries.length, 'entry is', 'entries are')} now locked.`
              : `${dateRange(invoice.period_start, invoice.period_end)} · ${formatDollars(invoice.total_cents)}`}
          </p>
        </div>
      </div>

      <ul class="card files" aria-label="Invoice files">
        {files.list.map((f, i) => (
          <li key={f.name} class="file">
            <span class="file-tag" aria-hidden="true">
              {f.type === 'application/pdf' ? 'PDF' : 'CSV'}
            </span>
            <span class="file-text">
              <span class="file-name">{f.name}</span>
              <span class="file-detail">{describe[i]}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 class="sec">Next steps</h2>
      <ol class="next-steps">
        <li>Share the files and email them to yourself.</li>
        <li>Sign the PDF: Markup on iPhone, or Adobe Acrobat Fill &amp; Sign on Android.</li>
        <li>Email the signed PDF and both CSV files to your reviewer.</li>
        <li>Your reviewer signs and sends everything to the office.</li>
      </ol>
      <p class="hint">Fingerprint {shortFingerprint(invoice.fingerprint)}</p>

      <p class="share-status" role="status">
        {outcome && STATUS[outcome]}
      </p>

      {asking && (
        <Confirm
          title="Share the files first?"
          body={<p>You can share them later from Settings › Past invoices.</p>}
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
