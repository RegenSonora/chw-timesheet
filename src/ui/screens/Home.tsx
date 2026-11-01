// Home (SPEC §5, §6): source chip, "Not yet invoiced", Generate, Start, Enter times.
import { useState } from 'preact/hooks';
import { formatDollars, uninvoicedEntries, uninvoicedSummary } from '../../core';
import { EntryRow, Page, SettingsIcon, SourceChip, ToastBar, ListPicker } from '../components';
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

  return (
    <Page
      title="CHW Time Tracker"
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
            <button
              type="button"
              class="btn2"
              onClick={() => void actions.openInvoicePreview(selectedSource.id)}
            >
              Generate {selectedSource.code} invoice
            </button>
          )}
          <button type="button" class="btn btn-start" onClick={() => void actions.startTimer()}>
            Start timer
          </button>
          <button type="button" class="txt" onClick={() => void actions.startHandEntry()}>
            Enter times instead
          </button>
        </>
      }
    >
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
        <p class="empty">
          No {selectedSource.code} entries waiting. Tap Start timer when you begin work.
        </p>
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
