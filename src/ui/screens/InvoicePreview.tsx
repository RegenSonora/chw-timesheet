// Invoice preview (SPEC §6, §9, wireframe Invoice): what the invoice will say, then
// "Create invoice files", which locks the entries.
import { useState } from 'preact/hooks';
import {
  buildInvoiceDraft,
  COUNT_FIELDS,
  formatDollars,
  formatQuarters,
  paginateTimesheet,
  type NteStatus,
} from '../../core';
import { dateRange, longDate } from '../../files/text';
import { phoneNow } from '../../storage';
import { ErrorText, Page, Warning } from '../components';
import { plural, shortDateLabel } from '../format';
import { useApp } from '../store';

function ContractLimit({ nte }: { nte: NteStatus }) {
  const { actions } = useApp();
  if (nte.state === 'none') return null;
  if (nte.state === 'not_entered') {
    return (
      <>
        <h2 class="sec">Contract limit</h2>
        <Warning>Enter your not-to-exceed amount in Settings.</Warning>
        <button
          type="button"
          class="txt txt-left"
          onClick={() => {
            actions.push('settings');
          }}
        >
          Open Settings
        </button>
      </>
    );
  }
  const rows: [string, number][] = [
    ['Not-to-exceed', nte.nte_cents],
    ['Billed before', nte.billed_before_cents],
    ['This invoice', nte.this_invoice_cents],
  ];
  const over = Math.min(nte.this_invoice_cents, -nte.remaining_cents);
  return (
    <>
      <h2 class="sec">Contract limit</h2>
      <div class={nte.over ? 'card nte nte-over' : 'card nte'}>
        {nte.over && (
          <>
            <p class="nte-title">Over the contract limit</p>
            <p class="nte-text">
              This invoice is {formatDollars(over)} over your not-to-exceed amount. You can still
              create it. The office decides whether to pay.
            </p>
          </>
        )}
        <dl class="nte-rows">
          {rows.map(([label, cents]) => (
            <div key={label} class="nte-row">
              <dt>{label}</dt>
              <dd>{formatDollars(cents)}</dd>
            </div>
          ))}
          <div class="nte-row nte-row-total">
            <dt>Remaining</dt>
            <dd>{formatDollars(nte.remaining_cents)}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

export function InvoicePreview() {
  const { data, selectedSource, actions } = useApp();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const source = selectedSource;
  const profile = data.profile;
  if (!source || !profile) return null;

  const settings = data.settings.find((s) => s.source_id === source.id);
  const now = phoneNow();
  const draft = settings
    ? buildInvoiceDraft({
        id: 'preview',
        now,
        invoice_date: now.slice(0, 10),
        source,
        settings,
        profile,
        counter: data.counter,
        entries: data.entries,
        prior_invoices: data.invoices,
      })
    : null;

  if (!draft?.ok) {
    const reason = draft ? draft.reason : 'no_rate';
    return (
      <Page title="New invoice" back aside={<span class="bar-code">{source.code}</span>}>
        <p class="empty">
          {reason === 'no_entries'
            ? `No ${source.code} entries waiting to be invoiced.`
            : "This invoice can't be made yet. Check your details and rate in Settings."}
        </p>
      </Page>
    );
  }

  const invoice = draft.invoice;
  const dates = new Set(invoice.entries.map((e) => e.entry_date)).size;
  const pages = paginateTimesheet(invoice, source).length;
  const count = invoice.entries.length;
  const counts = [
    ...COUNT_FIELDS.map((f) => ({ label: f.label, value: invoice.counts_period[f.key] })),
    ...invoice.counts_period.other,
  ];

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const result = await actions.createInvoice(source.id);
    // On success this screen is replaced; only a problem comes back here.
    setProblem(result);
    setBusy(false);
  };

  return (
    <Page
      title="New invoice"
      back
      aside={<span class="bar-code">{source.code}</span>}
      footer={
        <>
          <button
            type="button"
            class="btn"
            aria-disabled={busy ? 'true' : undefined}
            onClick={() => void create()}
          >
            {busy ? 'Creating files…' : 'Create invoice files'}
          </button>
          <p class="foot-note">These {plural(count, 'entry', 'entries')} will be locked.</p>
        </>
      }
    >
      {problem && <ErrorText>{problem}</ErrorText>}
      <dl class="card kv">
        <div class="kv-row">
          <dt>Invoice #</dt>
          <dd>{invoice.number}</dd>
        </div>
        <div class="kv-row">
          <dt>Invoice date</dt>
          <dd>{longDate(invoice.invoice_date)}</dd>
        </div>
        <div class="kv-row">
          <dt>Period</dt>
          <dd>{dateRange(invoice.period_start, invoice.period_end)}</dd>
        </div>
        <div class="kv-row">
          <dt>Entries</dt>
          <dd>
            {count} on {plural(dates, 'date', 'dates')} (
            {plural(pages, 'timesheet page', 'timesheet pages')})
          </dd>
        </div>
        <div class="kv-row">
          <dt>Rate</dt>
          <dd>{formatDollars(invoice.rate_cents)} / h</dd>
        </div>
      </dl>

      <h2 class="sec">Amount by budget line</h2>
      <table class="card lines">
        <caption class="sr-only">
          Hours and amount by budget line, {shortDateLabel(invoice.period_start)} to{' '}
          {shortDateLabel(invoice.period_end)}
        </caption>
        <thead class="sr-only">
          <tr>
            <th scope="col">Budget line</th>
            <th scope="col">Hours</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.budget_line_id}>
              <th scope="row">{l.budget_line_name}</th>
              <td class="lines-hours">{formatQuarters(l.quarters)} h</td>
              <td class="lines-amount">{formatDollars(l.amount_cents)}</td>
            </tr>
          ))}
          <tr class="lines-total">
            <th scope="row">Total</th>
            <td class="lines-hours">{formatQuarters(invoice.total_quarters)} h</td>
            <td class="lines-amount">{formatDollars(invoice.total_cents)}</td>
          </tr>
        </tbody>
      </table>

      <ContractLimit nte={invoice.nte} />

      <h2 class="sec">Counts this period</h2>
      <dl class="card kv">
        {counts.map((c) => (
          <div key={c.label} class="kv-row">
            <dt>{c.label}</dt>
            <dd>{c.value}</dd>
          </div>
        ))}
      </dl>
    </Page>
  );
}
