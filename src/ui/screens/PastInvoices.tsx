// Past invoices (SPEC §6, decisions 0007, 0012, 0031): every invoice or timesheet on the phone,
// newest first. Tapping one re-creates its files to share again.
import { formatDollars } from '../../core';
import { hoursLabel, paperWord } from '../format';
import { dateRange } from '../../files/text';
import { Page } from '../components';
import { useApp } from '../store';

export function PastInvoices() {
  const { data, role, actions } = useApp();
  const invoices = [...data.invoices].reverse();
  const paper = paperWord(role);
  return (
    <Page title={`Past ${paper}s`} back>
      {invoices.length === 0 ? (
        <p class="empty">No {paper}s yet.</p>
      ) : (
        <>
          <p class="hint">
            Tap {paper === 'invoice' ? 'an invoice' : 'a timesheet'} to share its files again.
          </p>
          <ul class="entries">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  class="entry"
                  onClick={() => {
                    actions.openPastInvoice(inv.id);
                  }}
                >
                  <span class="entry-top">
                    <span>{inv.source.code}</span>
                    <span class="entry-hours">
                      {/* Timesheets show no dollar amounts (decision 0031). */}
                      {inv.kind === 'timesheet'
                        ? hoursLabel(inv.total_quarters)
                        : formatDollars(inv.total_cents)}
                    </span>
                  </span>
                  <span class="entry-task">{inv.number}</span>
                  <span class="entry-detail">{dateRange(inv.period_start, inv.period_end)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
