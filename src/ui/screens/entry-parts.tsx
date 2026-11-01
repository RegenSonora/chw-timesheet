// Pieces shared by the new-entry steps and Edit entry (SPEC §5).
import { useState } from 'preact/hooks';
import {
  carryPicks,
  taskChoices,
  type Counts,
  type Entry,
  type FundingSourceConfig,
} from '../../core';
import type { EntryDraft } from '../../storage';
import {
  COUNT_FIELDS,
  ErrorText,
  Field,
  ListPicker,
  Stepper,
  Warning,
  entryNames,
} from '../components';
import { checkDraftTimes, type TimesCheck } from '../draft';
import { dateLabel, durationLabel, hoursLabel, shortDateLabel, timeRangeLabel } from '../format';
import { sourceById, useApp } from '../store';

/** "Fri, Oct 30 · 9:12–10:37 AM", "Rounded from 1 h 25 min", "1.5 h". */
export function TimeCard({ draft, check }: { draft: EntryDraft; check: TimesCheck }) {
  if (!draft.start || !draft.stop || check.state !== 'ok') return null;
  return (
    <div class="card time-card">
      <div>
        <p class="time-card-when">
          {dateLabel(draft.start.slice(0, 10))} · {timeRangeLabel(draft.start, draft.stop)}
        </p>
        <p class="hint">Rounded from {durationLabel(check.seconds)}</p>
      </div>
      <p class="big-hours">{hoursLabel(check.quarters)}</p>
    </div>
  );
}

/** A row showing the current pick with Change (SPEC §5: "the task screen shows the source with Change"). */
export function ChangeRow({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string | null;
  onChange: () => void;
  error?: string | null;
}) {
  return (
    <div class="field">
      <p class="lab" id={`${label}-label`}>
        {label}
      </p>
      <button
        type="button"
        class={error ? 'change-row change-row-bad' : 'change-row'}
        aria-describedby={`${label}-label`}
        onClick={onChange}
      >
        <span class={value ? 'change-value' : 'change-value change-empty'}>
          {value ?? 'Not picked yet'}
        </span>
        <span class="change-link">{value ? 'Change' : 'Choose'}</span>
      </button>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/** Funding source and budget line rows with their pickers. */
export function SourceAndLine({
  draft,
  lineError,
}: {
  draft: EntryDraft;
  lineError?: string | null;
}) {
  const { data, actions } = useApp();
  const [picking, setPicking] = useState<null | 'source' | 'line'>(null);
  const source = sourceById(draft.source_id);
  const sources = data.settings.map((s) => sourceById(s.source_id));
  const line = source.budget_lines.find((l) => l.id === draft.budget_line_id);
  return (
    <>
      <ChangeRow
        label="Funding source"
        value={source.code}
        onChange={() => {
          setPicking('source');
        }}
      />
      <ChangeRow
        label="Budget line"
        value={line?.name ?? null}
        error={lineError ?? null}
        onChange={() => {
          setPicking('line');
        }}
      />
      {picking === 'source' && (
        <ListPicker
          title="Funding source"
          items={sources}
          selected={source.id}
          label={(s) => s.code}
          detail={(s) => (s.name === s.code ? null : s.name)}
          onPick={(s: FundingSourceConfig) => {
            setPicking(null);
            if (s.id === source.id) return;
            const lastLine = data.app.per_source[s.id]?.last_budget_line_id ?? null;
            const picks = carryPicks(s, draft.task_id, draft.budget_line_id ?? lastLine);
            void actions.updateDraft({ source_id: s.id, ...picks });
          }}
          onClose={() => {
            setPicking(null);
          }}
        />
      )}
      {picking === 'line' && (
        <ListPicker
          title="Budget line"
          items={source.budget_lines}
          selected={draft.budget_line_id}
          label={(l) => l.name}
          onPick={(l) => {
            setPicking(null);
            void actions.updateDraft({ budget_line_id: l.id });
          }}
          onClose={() => {
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

/** "What did you do?": recent tasks first, then the rest, as one radio group. */
export function TaskList({
  draft,
  error,
  onPicked,
}: {
  draft: EntryDraft;
  error?: string | null;
  onPicked?: () => void;
}) {
  const { data, actions } = useApp();
  const source = sourceById(draft.source_id);
  const { recent, all } = taskChoices(
    source,
    data.app.per_source[source.id]?.recent_task_ids ?? [],
  );
  const recentIds = new Set(recent.map((t) => t.id));
  const rest = all.filter((t) => !recentIds.has(t.id));
  const option = (t: (typeof all)[number]) => (
    <label key={t.id} class={draft.task_id === t.id ? 'row row-on' : 'row'}>
      <input
        type="radio"
        name="task"
        value={t.id}
        checked={draft.task_id === t.id}
        onChange={() => {
          void actions.updateDraft({ task_id: t.id });
          onPicked?.();
        }}
      />
      <span>
        <span class="row-name">{t.name}</span>
        {t.core_competency && <span class="row-detail">{t.core_competency}</span>}
      </span>
    </label>
  );
  return (
    <fieldset class="tasks" aria-invalid={error ? 'true' : undefined}>
      <legend class="lab">What did you do?</legend>
      {error && <ErrorText>{error}</ErrorText>}
      <div class="task-box">
        {recent.length > 0 && <p class="grp">Recent</p>}
        {recent.map(option)}
        <p class="grp">{recent.length > 0 ? 'Other tasks' : `All ${String(all.length)} tasks`}</p>
        {rest.map(option)}
      </div>
    </fieldset>
  );
}

/** Five counts, custom counts and notes with the no-names warning. */
export function CountsAndNotes({
  draft,
  countError,
}: {
  draft: EntryDraft;
  countError?: string | null;
}) {
  const { actions } = useApp();
  const counts = draft.counts;
  const set = (next: Counts) => void actions.updateDraft({ counts: next });
  return (
    <>
      <div>
        <h2 class="step-title">Counts</h2>
        <p class="hint">Optional. Leave at 0 if they don't apply.</p>
      </div>
      <div class="card counts">
        {COUNT_FIELDS.map((f) => (
          <Stepper
            key={f.key}
            label={f.label}
            noun={f.noun}
            value={counts[f.key]}
            onChange={(v) => {
              set({ ...counts, [f.key]: v });
            }}
          />
        ))}
        {counts.other.map((o, i) => (
          <div class="cnt cnt-custom" key={i}>
            <Field label={`Count ${String(i + 1)} name`}>
              {(p) => (
                <input
                  {...p}
                  class="inp"
                  placeholder="Like Food boxes"
                  value={o.label}
                  onInput={(e) => {
                    const other = counts.other.map((x, j) =>
                      j === i ? { ...x, label: e.currentTarget.value } : x,
                    );
                    set({ ...counts, other });
                  }}
                />
              )}
            </Field>
            <Stepper
              label="Number"
              noun={o.label.trim() || `count ${String(i + 1)}`}
              value={o.value}
              onChange={(v) => {
                const other = counts.other.map((x, j) => (j === i ? { ...x, value: v } : x));
                set({ ...counts, other });
              }}
            />
            <button
              type="button"
              class="txt txt-left"
              onClick={() => {
                set({ ...counts, other: counts.other.filter((_, j) => j !== i) });
              }}
            >
              Remove this count
            </button>
          </div>
        ))}
      </div>
      {countError && <ErrorText>{countError}</ErrorText>}
      <button
        type="button"
        class="txt txt-left"
        onClick={() => {
          set({ ...counts, other: [...counts.other, { label: '', value: 0 }] });
        }}
      >
        + Add another count
      </button>
      <Field label="Notes (optional)">
        {(p) => (
          <textarea
            {...p}
            class="inp inp-area"
            value={draft.notes}
            onInput={(e) => void actions.updateDraft({ notes: e.currentTarget.value })}
          />
        )}
      </Field>
      <Warning>Don't include client names. Notes appear on the timesheet.</Warning>
    </>
  );
}

/** The overlap message from the wireframe. */
export function overlapText(other: Entry): string {
  return `This overlaps your ${timeRangeLabel(other.start, other.stop)} entry on ${shortDateLabel(
    other.entry_date,
  )} (${entryNames(other).task}). Change the times to continue.`;
}

/** Date, start, end, the rounded hours and any problem with them (SPEC §5 "Enter times"). */
export function TimesFields({ draft }: { draft: EntryDraft }) {
  const { data, actions } = useApp();
  const hand = draft.hand ?? { date: '', start: '', end: '' };
  const check = checkDraftTimes(draft, data.entries);
  const bad = check.state === 'overlap' || check.state === 'too_short';
  const set = (patch: Partial<typeof hand>) =>
    void actions.updateDraft({ hand: { ...hand, ...patch } });
  const problem =
    check.state === 'overlap'
      ? overlapText(check.other)
      : check.state === 'too_short'
        ? "That's under 8 minutes, too short to bill. Change the times to continue."
        : null;
  return (
    <>
      <Field label="Date">
        {(p) => (
          <input
            {...p}
            class="inp inp-time"
            type="date"
            value={hand.date}
            onInput={(e) => {
              set({ date: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      <div class="two">
        <Field label="Start">
          {(p) => (
            <input
              {...p}
              {...(bad ? { 'aria-invalid': 'true', 'aria-describedby': 'times-problem' } : {})}
              class="inp inp-time"
              type="time"
              value={hand.start}
              onInput={(e) => {
                set({ start: e.currentTarget.value });
              }}
            />
          )}
        </Field>
        <Field label="End">
          {(p) => (
            <input
              {...p}
              {...(bad ? { 'aria-invalid': 'true', 'aria-describedby': 'times-problem' } : {})}
              class="inp inp-time"
              type="time"
              value={hand.end}
              onInput={(e) => {
                set({ end: e.currentTarget.value });
              }}
            />
          )}
        </Field>
      </div>
      {check.state === 'ok' && (
        <div class="card rounded-row">
          <span class="hint">
            {check.next_day ? 'Ends the next day. ' : ''}Rounded to the nearest quarter hour
          </span>
          <span class="big-hours">{hoursLabel(check.quarters)}</span>
        </div>
      )}
      {problem && <ErrorText id="times-problem">{problem}</ErrorText>}
      <p class="hint">End time earlier than the start? It's counted as ending the next day.</p>
    </>
  );
}

export const PROBLEM_TEXT = {
  task: 'Pick what you did.',
  budget_line: 'Pick a budget line.',
  count_label: 'Give each extra count a name, or remove it.',
  times: 'Check the times.',
} as const;
