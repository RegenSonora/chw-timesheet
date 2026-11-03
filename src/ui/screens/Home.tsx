// Home (SPEC §5, §6): source chip, "Not yet invoiced", My stats, Past invoices, Generate,
// Start, Record time, the 240-hour raise reminder, and the role's wording (decisions 0023, 0025,
// 0026, 0030, 0031, 0033).
import { useState } from 'preact/hooks';
import {
  formatDollars,
  fundingChoices,
  raiseStatus,
  sourceMyStats,
  rateStepReminder,
  uninvoicedEntries,
  uninvoicedSummary,
  type FundingSourceConfig,
  type RateStepReminder,
} from '../../core';
import { FUNDING_SOURCES } from '../../funding-sources';
import { phoneNow } from '../../storage';
import {
  EntryRow,
  ListPicker,
  Page,
  SettingsIcon,
  SourceChip,
  ToastBar,
  Warning,
} from '../components';
import { hoursLabel, localDateTime, plural, roleRaiseText } from '../format';
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

/** My stats (decision 0026): invoiced hours, and the hours still needed for the raise and for certification. */
export function MyStats({
  source,
  rateCents,
  waitingQuarters,
}: {
  source: FundingSourceConfig;
  rateCents: number | null;
  waitingQuarters: number;
}) {
  const { data, actions } = useApp();
  const stats = sourceMyStats(source, rateCents, data.invoices, waitingQuarters);
  const { pay, certification } = stats;
  return (
    <section class="stats-sec" aria-labelledby="stats-head">
      <h2 class="stats-head" id="stats-head">
        My stats
      </h2>
      <dl class="card stats">
        <div class="stat">
          <dt>
            Hours invoiced
            {stats.waiting_quarters > 0 && (
              <span class="stat-detail">
                + {hoursLabel(stats.waiting_quarters)} not yet invoiced
              </span>
            )}
          </dt>
          <dd>{hoursLabel(stats.invoiced_quarters)}</dd>
        </div>
        {pay?.state === 'counting' && (
          <div class="stat">
            <dt>
              Hrs needed for pay increase
              <span class="stat-detail">
                to {formatDollars(pay.rate_cents)}/hr at {hoursLabel(pay.after_quarters)}
              </span>
            </dt>
            <dd>{hoursLabel(pay.left_quarters)}</dd>
          </div>
        )}
        {pay?.state === 'reached' && (
          <div class="stat">
            <dt>
              Pay increase
              <span class="stat-detail">
                Reached. Change your rate to {formatDollars(pay.rate_cents)} in Settings.
              </span>
            </dt>
            <dd class="stat-done">Reached</dd>
          </div>
        )}
        {certification?.state === 'counting' && (
          <div class="stat">
            <dt>
              Hrs needed for {certification.name} eligibility
              <span class="stat-detail">at {hoursLabel(certification.after_quarters)}</span>
            </dt>
            <dd>{hoursLabel(certification.left_quarters)}</dd>
          </div>
        )}
        {certification?.state === 'eligible' && (
          <div class="stat">
            <dt>
              {certification.name} eligibility
              <span class="stat-detail">Press "Eligible" to generate your Work Hours Report</span>
            </dt>
            <dd>
              <button
                type="button"
                class="btn btn-small"
                onClick={() => {
                  actions.dismissToast();
                  actions.push('report');
                }}
              >
                Eligible
              </button>
            </dd>
          </div>
        )}
      </dl>
      <p class="hint">Counts invoices made on this phone.</p>
    </section>
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

export const NO_FUNDING = 'No active funding for your role. Ask the office.';

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
  const { data, selectedSource, role, actions } = useApp();
  const [picking, setPicking] = useState(false);
  const update = useUpdate();
  if (!selectedSource) return null;

  const rate = data.settings.find((s) => s.source_id === selectedSource.id)?.rate_cents ?? null;
  const open = uninvoicedEntries(data.entries, selectedSource.id).reverse();
  const summary = uninvoicedSummary(data.entries, selectedSource.id, rate);
  const employee = role?.employment === 'employee';
  const funding = role?.funding.find((f) => f.source_id === selectedSource.id);
  const reminder = role
    ? funding
      ? raiseStatus(funding, rate, data.invoices, summary.quarters)
      : null
    : rateStepReminder(selectedSource, rate, data.invoices, summary.quarters);
  const reminderText = reminder
    ? role
      ? roleRaiseText(reminder, employee)
      : rateStepText(reminder, selectedSource.code)
    : null;
  // Decision 0033: every source ended. Record time stays for dates inside a period.
  const noFunding =
    role !== null &&
    fundingChoices(role, FUNDING_SOURCES, localDateTime(phoneNow()).date).length === 0;

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
          {!noFunding && (
            <button type="button" class="btn btn-start" onClick={() => void actions.startTimer()}>
              Start timer
            </button>
          )}
          <button
            type="button"
            class="btn btn-start btn-green"
            onClick={() => void actions.startHandEntry()}
          >
            Record time
          </button>
        </>
      }
    >
      {noFunding && <Warning>{NO_FUNDING}</Warning>}
      {reminderText && <Warning>{reminderText}</Warning>}
      <div class="list-head">
        <h2>{employee ? 'Not yet submitted' : 'Not yet invoiced'}</h2>
        {summary.count > 0 && (
          <span class="summary">
            {plural(summary.count, 'entry', 'entries')} · {hoursLabel(summary.quarters)}
            {summary.amount_cents !== null && ` · ${formatDollars(summary.amount_cents)}`}
          </span>
        )}
      </div>
      {summary.count === 0 ? (
        <p class="empty">
          {noFunding
            ? 'Record time for dates your funding covered.'
            : 'Start timer and start working or record time.'}
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
      <MyStats source={selectedSource} rateCents={rate} waitingQuarters={summary.quarters} />
      {/* Decision 0019: Past invoices lives on Home, under the list. */}
      <button
        type="button"
        class="card nav-row home-invoices"
        onClick={() => {
          actions.dismissToast();
          actions.push('invoices');
        }}
      >
        <span>{employee ? 'Past timesheets' : 'Past invoices'}</span>
        <span class="nav-row-detail">
          {data.invoices.length > 0
            ? employee
              ? plural(data.invoices.length, 'timesheet', 'timesheets')
              : plural(data.invoices.length, 'invoice', 'invoices')
            : 'None yet'}
        </span>
      </button>
      {/* Decision 0026: under Past invoices, the same size, light green with dark gold text.
          Employees submit a timesheet instead (decision 0031). */}
      {summary.count > 0 && (
        <button
          type="button"
          class="card nav-row home-generate"
          onClick={() => void actions.openInvoicePreview(selectedSource.id)}
        >
          {employee ? 'Submit timesheet' : 'Generate Regen Invoice'}
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
