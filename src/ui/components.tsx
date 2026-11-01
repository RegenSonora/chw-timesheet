// Shared pieces for every screen (SPEC §10: main actions low, big targets, plain words).
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { Counts, Entry, FundingSourceConfig } from '../core';
import { checkEntryTimes } from '../core';
import { dateLabel, hoursLabel, timeRangeLabel } from './format';
import { sourceById, useApp } from './store';

// --- Icons (stroke SVG, hidden from screen readers) -----------------------------------------

const svg = (children: ComponentChildren, size = 24) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const BackIcon = () => svg(<path d="M15 18l-6-6 6-6" />);
export const ChevronIcon = () => svg(<path d="M6 9l6 6 6-6" />, 16);
export const LockIcon = () =>
  svg(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>,
    16,
  );
export const CheckIcon = () => svg(<path d="M5 12l5 5 9-10" />, 20);
export const InfoIcon = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16v.5" />
    </>,
    20,
  );
export const SettingsIcon = () =>
  svg(
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>,
  );

// --- Page layout ------------------------------------------------------------------------------

interface PageProps {
  title: string;
  /** Shows a Back button that leaves this screen. */
  back?: boolean;
  /** Right side of the header: chip, settings, "Step 1 of 2". */
  aside?: ComponentChildren;
  footer?: ComponentChildren;
  children: ComponentChildren;
  mainClass?: string;
}

/** One screen: header with the screen's h1 (focused on arrival), scrolling main, footer. */
export function Page({ title, back, aside, footer, children, mainClass }: PageProps) {
  const { actions } = useApp();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div class="screen">
      <header class={back ? 'bar bar-back' : 'bar'}>
        {back && (
          <button type="button" class="icon" aria-label="Back" onClick={actions.back}>
            <BackIcon />
          </button>
        )}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {aside}
      </header>
      <main class={mainClass ?? 'content'}>{children}</main>
      {footer && <footer class="actions">{footer}</footer>}
    </div>
  );
}

// --- Dialog (native <dialog>: focus trap, Escape, aria-modal) ----------------------------------

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} class="sheet-title">
        {title}
      </h2>
      {children}
    </dialog>
  );
}

/**
 * A question with a main choice, an optional second one, and an optional text "cancel".
 * Escape and the cancel button both call onCancel, so make that the safe choice.
 */
export function Confirm({
  title,
  body,
  confirm,
  cancel,
  second,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: ComponentChildren;
  confirm: string;
  cancel?: string;
  second?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title={title} onClose={onCancel}>
      {body}
      <div class="sheet-actions">
        <button type="button" class="btn" onClick={onConfirm}>
          {confirm}
        </button>
        {second && (
          <button type="button" class="btn2" onClick={second.onClick}>
            {second.label}
          </button>
        )}
        {cancel && (
          <button type="button" class="txt" onClick={onCancel}>
            {cancel}
          </button>
        )}
      </div>
    </Dialog>
  );
}

/** Pick one from a list (SPEC §10: lists instead of dropdowns). */
export function ListPicker<T extends { id: string }>({
  title,
  items,
  selected,
  label,
  detail,
  onPick,
  onClose,
  note,
}: {
  title: string;
  items: readonly T[];
  selected: string | null;
  label: (item: T) => string;
  detail?: (item: T) => string | null;
  onPick: (item: T) => void;
  onClose: () => void;
  note?: string;
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <ul class="pick-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              class="pick"
              aria-current={item.id === selected ? 'true' : undefined}
              onClick={() => {
                onPick(item);
              }}
            >
              <span class="pick-text">
                <span class="pick-name">{label(item)}</span>
                {detail?.(item) && <span class="pick-detail">{detail(item)}</span>}
              </span>
              {item.id === selected && <CheckIcon />}
            </button>
          </li>
        ))}
      </ul>
      {note && <p class="hint">{note}</p>}
      <div class="sheet-actions">
        <button type="button" class="txt" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

// --- Header chip ------------------------------------------------------------------------------

export function SourceChip({ onOpen }: { onOpen: () => void }) {
  const { selectedSource, data } = useApp();
  if (!selectedSource) return null;
  if (data.app.running_timer) {
    return (
      <button
        type="button"
        class="chip chip-locked"
        disabled
        aria-label={`Funding source ${selectedSource.code}, locked while the timer runs`}
      >
        {selectedSource.code} <LockIcon />
      </button>
    );
  }
  return (
    <button
      type="button"
      class="chip"
      aria-label={`Funding source ${selectedSource.code}. Change`}
      onClick={onOpen}
    >
      {selectedSource.code} <ChevronIcon />
    </button>
  );
}

// --- Messages ---------------------------------------------------------------------------------

export function ErrorText({ id, children }: { id?: string; children: ComponentChildren }) {
  return (
    <p id={id} class="error" role="alert">
      <InfoIcon />
      <span>{children}</span>
    </p>
  );
}

export function Warning({ children }: { children: ComponentChildren }) {
  return (
    <p class="warning">
      <InfoIcon />
      <span>{children}</span>
    </p>
  );
}

/** "Saved" with Undo. Stays until the next action or dismiss: no time limit (WCAG 2.2.1). */
export function ToastBar() {
  const { toast, actions } = useApp();
  return (
    <div class="toast-slot" role="status">
      {toast && (
        <div class="toast" key={toast.id}>
          <span>{toast.text}</span>
          {toast.undo ? (
            <button type="button" class="toast-btn" onClick={() => void actions.undoToast()}>
              Undo
            </button>
          ) : (
            <button
              type="button"
              class="toast-btn"
              onClick={() => {
                actions.dismissToast();
              }}
            >
              OK
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Form pieces ------------------------------------------------------------------------------

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null | undefined;
  children: (props: {
    id: string;
    'aria-invalid'?: 'true';
    'aria-describedby'?: string;
  }) => JSX.Element;
}

/** Label, input, hint and an error in plain words next to the field (SPEC §10). */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div class="field">
      <label class="lab" for={id}>
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': 'true' as const } : {}),
        ...(described ? { 'aria-describedby': described } : {}),
      })}
      {hint && (
        <p class="hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  noun,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** For the button names: "Fewer contacts", "More contacts". */
  noun: string;
}) {
  const id = useId();
  return (
    <div class="cnt">
      <span id={id}>{label}</span>
      <div class="cnt-ctl" role="group" aria-labelledby={id}>
        <button
          type="button"
          class="stp"
          aria-label={`Fewer ${noun}`}
          disabled={value === 0}
          onClick={() => {
            onChange(Math.max(0, value - 1));
          }}
        >
          −
        </button>
        <span class="val" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          class="stp"
          aria-label={`More ${noun}`}
          onClick={() => {
            onChange(value + 1);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export const COUNT_FIELDS: readonly {
  key: Exclude<keyof Counts, 'other'>;
  label: string;
  noun: string;
}[] = [
  { key: 'contacts', label: 'Contacts', noun: 'contacts' },
  { key: 'referrals_given', label: 'Referrals given', noun: 'referrals given' },
  { key: 'referral_followups', label: 'Referral follow-ups', noun: 'referral follow-ups' },
  { key: 'rides_provided', label: 'Rides provided', noun: 'rides provided' },
  {
    key: 'applications_completed',
    label: 'Applications completed',
    noun: 'applications completed',
  },
];

// --- Entries ----------------------------------------------------------------------------------

export function entryNames(
  entry: Entry,
  source: FundingSourceConfig = sourceById(entry.source_id),
) {
  return {
    task: source.tasks.find((t) => t.id === entry.task_id)?.name ?? 'Task',
    line: source.budget_lines.find((l) => l.id === entry.budget_line_id)?.name ?? 'Budget line',
  };
}

export function EntryRow({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const times = checkEntryTimes(entry.start, entry.stop);
  const names = entryNames(entry);
  return (
    <button type="button" class="entry" onClick={onOpen}>
      <span class="entry-top">
        <span>{dateLabel(entry.entry_date)}</span>
        <span class="entry-hours">{times.ok ? hoursLabel(times.quarters) : ''}</span>
      </span>
      <span class="entry-task">{names.task}</span>
      <span class="entry-detail">
        {timeRangeLabel(entry.start, entry.stop)} · {names.line}
      </span>
    </button>
  );
}
