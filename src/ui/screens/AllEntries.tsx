// All entries (decision 0007): every not-yet-invoiced entry for the chip's source, by date.
import { formatDollars, uninvoicedEntries, uninvoicedSummary } from '../../core';
import { EntryRow, Page } from '../components';
import { dateLabel, hoursLabel, plural } from '../format';
import { useApp } from '../store';

export function AllEntries() {
  const { data, selectedSource, actions } = useApp();
  if (!selectedSource) return null;
  const open = uninvoicedEntries(data.entries, selectedSource.id).reverse();
  const rate = data.settings.find((s) => s.source_id === selectedSource.id)?.rate_cents ?? null;
  const summary = uninvoicedSummary(data.entries, selectedSource.id, rate);
  const dates = [...new Set(open.map((e) => e.entry_date))];
  return (
    <Page title={`${selectedSource.code} entries`} back>
      <div class="list-head">
        <h2>Not yet invoiced</h2>
        <span class="summary">
          {plural(summary.count, 'entry', 'entries')} · {hoursLabel(summary.quarters)}
          {summary.amount_cents !== null && ` · ${formatDollars(summary.amount_cents)}`}
        </span>
      </div>
      {open.length === 0 && <p class="empty">No entries waiting.</p>}
      {dates.map((date) => (
        <section key={date} aria-label={dateLabel(date)}>
          <ul class="entries">
            {open
              .filter((e) => e.entry_date === date)
              .map((e) => (
                <li key={e.id}>
                  <EntryRow
                    entry={e}
                    onOpen={() => {
                      actions.editEntry(e);
                    }}
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}
