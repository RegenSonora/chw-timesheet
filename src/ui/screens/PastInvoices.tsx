// Past invoices (SPEC §6, decisions 0007, 0012): every invoice on the phone, newest first.
// Tapping one re-creates its files to share again.
import { formatDollars } from '../../core';
import { dateRange } from '../../files/text';
import { Page } from '../components';
import { useApp } from '../store';

export function PastInvoices() {
  const { data, actions } = useApp();
  const invoices = [...data.invoices].reverse();
  return (
    <Page title="Past invoices" back>
      {invoices.length === 0 ? (
        <p class="empty">No invoices yet.</p>
      ) : (
        <>
          <p class="hint">Tap an invoice to share its files again.</p>
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
                    <span class="entry-hours">{formatDollars(inv.total_cents)}</span>
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
