// Home (SPEC §5, §6): source chip, "Not yet invoiced", Past invoices, Generate, Start, Enter
// times, and the 240-hour raise reminder (decision 0023).
import { useState } from 'preact/hooks';
import {
  formatDollars,
  rateStepReminder,
  uninvoicedEntries,
  uninvoicedSummary,
  type RateStepReminder,
} from '../../core';
import {
  EntryRow,
  ListPicker,
  Page,
  SettingsIcon,
  SourceChip,
  ToastBar,
  Warning,
} from '../components';
import { hoursLabel, plural } from '../format';
import { sourceById, useApp } from '../store';
import { isMidEntry, useUpdate } from '../update';

/** How many entries Home lists before "Show all". */
export const HOME_ENTRIES = 3;

/** The header chip's list of funding sources. */
export function SourcePickerSheet({ onClose }: { onClose: () => void }) {
  const { data, selectedSource, actions } = useApp();
  const sources = data.settings.map((s) => sourceById(s.source_id));
  return (
    <ListPicker
      title="Funding source"
      items={sources}
      selected={selectedSource?.id ?? null}
      label={(s) => s.code}
      detail={(s) => (s.name === s.code ? null : s.name)}
      onPick={(s) => {
        void actions.selectSource(s.id);
        onClose();
      }}
      onClose={onClose}
      note="New entries go to this funding source. Add another in Settings."
    />
  );
}

/** The raise reminder's words (decision 0023). */
export function rateStepText(reminder: RateStepReminder, code: string): string {
  const hours = `${String(reminder.after_quarters / 4)} hours`;
  const rate = formatDollars(reminder.rate_cents);
  return reminder.invoice_first
    ? `You've reached ${hours}. Generate your ${code} invoice now, then change your rate to ${rate} in Settings.`
    : `You've billed ${hours}. Your rate goes up to ${rate}. Change it in Settings before your next invoice.`;
}

export function HomeHeaderAside({ onChip }: { onChip: () => void }) {
  const { actions } = useApp();
  return (
    <>
      <SourceChip onOpen={onChip} />
      <button
        type="button"
        class="icon"
        aria-label="Settings"
        onClick={() => {
          actions.dismissToast();
          actions.push('settings');
        }}
      >
        <SettingsIcon />
      </button>
    </>
  );
}

export function Home() {
  const { data, selectedSource, actions } = useApp();
  const [picking, setPicking] = useState(false);
  const update = useUpdate();
  if (!selectedSource) return null;

  const rate = data.settings.find((s) => s.source_id === selectedSource.id)?.rate_cents ?? null;
  const open = uninvoicedEntries(data.entries, selectedSource.id).reverse();
  const summary = uninvoicedSummary(data.entries, selectedSource.id, rate);
  const reminder = rateStepReminder(selectedSource, rate, data.invoices, summary.quarters);

  return (
    <Page
      title="Regen Time Tracking"
      aside={
        <HomeHeaderAside
          onChip={() => {
            setPicking(true);
          }}
        />
      }
      footer={
        <>
          {/* Decision 0014: offered only between entries, so a reload never loses work. */}
          {update && !isMidEntry(data.app) && (
            <button type="button" class="update-bar" onClick={update}>
              Updated, tap to reload
            </button>
          )}
          {summary.count > 0 && (
            // Decision 0025: billed to Regenerating Sonora, as big as Start timer, green.
            <button
              type="button"
              class="btn btn-start btn-green"
              onClick={() => void actions.openInvoicePreview(selectedSource.id)}
            >
              Generate Regen Invoice
            </button>
          )}
          <button type="button" class="btn btn-start" onClick={() => void actions.startTimer()}>
            Start timer
          </button>
          <button
            type="button"
            class="btn btn-start btn-green"
            onClick={() => void actions.startHandEntry()}
          >
            Hand enter time
          </button>
        </>
      }
    >
      {reminder && <Warning>{rateStepText(reminder, selectedSource.code)}</Warning>}
      <div class="list-head">
        <h2>Not yet invoiced</h2>
        {summary.count > 0 && (
          <span class="summary">
            {plural(summary.count, 'entry', 'entries')} · {hoursLabel(summary.quarters)}
            {summary.amount_cents !== null && ` · ${formatDollars(summary.amount_cents)}`}
          </span>
        )}
      </div>
      {summary.count === 0 ? (
        <p class="empty">Start timer and start working or hand enter times.</p>
      ) : (
        <ul class="entries">
          {open.slice(0, HOME_ENTRIES).map((e) => (
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
      )}
      {open.length > HOME_ENTRIES && (
        <button
          type="button"
          class="txt txt-left"
          onClick={() => {
            actions.dismissToast();
            actions.push('all');
          }}
        >
          Show all {plural(open.length, 'entry', 'entries')}
        </button>
      )}
      {/* Decision 0019: Past invoices lives on Home, under the list. */}
      <button
        type="button"
        class="card nav-row home-invoices"
        onClick={() => {
          actions.dismissToast();
          actions.push('invoices');
        }}
      >
        <span>Past invoices</span>
        <span class="nav-row-detail">
          {data.invoices.length > 0
            ? plural(data.invoices.length, 'invoice', 'invoices')
            : 'None yet'}
        </span>
      </button>
      <ToastBar />
      {picking && (
        <SourcePickerSheet
          onClose={() => {
            setPicking(false);
          }}
        />
      )}
    </Page>
  );
}
