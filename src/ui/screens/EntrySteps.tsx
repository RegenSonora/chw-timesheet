// New entry: Enter times → tasks and budget line → split your time (two or more tasks) → counts
// and notes → Save (SPEC §5, decision 0024).
import { useState } from 'preact/hooks';
import { splitStatus } from '../../core';
import type { EntryDraft } from '../../storage';
import { Page } from '../components';
import { checkDraftTimes } from '../draft';
import { useApp } from '../store';
import {
  CountsAndNotes,
  PROBLEM_TEXT,
  SourceAndLine,
  SplitEditor,
  TaskList,
  TimeCard,
  TimesFields,
  useDraftQuarters,
} from './entry-parts';

function useEntryDraft(): EntryDraft | null {
  const { data } = useApp();
  const draft = data.app.draft;
  return draft?.kind === 'entry' ? draft : null;
}

/** "Step 1 of 2", or of 3 when the hours are split between tasks. */
function stepCount(draft: EntryDraft, step: 'task' | 'split' | 'counts') {
  const steps = draft.tasks.length > 1 ? ['task', 'split', 'counts'] : ['task', 'counts'];
  const at = Math.max(0, steps.indexOf(step)) + 1;
  return <span class="step-count">{`Step ${String(at)} of ${String(steps.length)}`}</span>;
}

export function EnterTimes() {
  const { data, actions } = useApp();
  const draft = useEntryDraft();
  if (!draft) return null;
  const check = checkDraftTimes(draft, data.entries);
  const ready = check.state === 'ok';
  return (
    <Page
      title="Enter times"
      back
      footer={
        <button
          type="button"
          class="btn"
          disabled={!ready}
          onClick={() => {
            actions.push('task');
          }}
        >
          Next
        </button>
      }
    >
      <TimesFields draft={draft} />
    </Page>
  );
}

export function TaskStep() {
  const { data, actions } = useApp();
  const draft = useEntryDraft();
  const [tried, setTried] = useState(false);
  if (!draft) return null;
  const check = checkDraftTimes(draft, data.entries);
  const missingTask = draft.tasks.length === 0;
  const missingLine = !draft.budget_line_id;
  return (
    <Page
      title="What did you do?"
      back
      aside={stepCount(draft, 'task')}
      footer={
        <button
          type="button"
          class="btn"
          onClick={() => {
            setTried(true);
            if (missingTask || missingLine) return;
            actions.push(draft.tasks.length > 1 ? 'split' : 'counts');
          }}
        >
          Next
        </button>
      }
    >
      <TimeCard draft={draft} check={check} />
      <SourceAndLine
        draft={draft}
        lineError={tried && missingLine ? PROBLEM_TEXT.budget_line : null}
      />
      <TaskList draft={draft} error={tried && missingTask ? PROBLEM_TEXT.task : null} />
    </Page>
  );
}

export function SplitStep() {
  const { actions } = useApp();
  const draft = useEntryDraft();
  const [tried, setTried] = useState(false);
  const total = useDraftQuarters(draft);
  if (!draft) return null;
  const ok = splitStatus(total, draft.tasks).state === 'ok';
  return (
    <Page
      title="Split your time"
      back
      aside={stepCount(draft, 'split')}
      footer={
        <button
          type="button"
          class="btn"
          onClick={() => {
            setTried(true);
            if (ok) actions.push('counts');
          }}
        >
          Next
        </button>
      }
    >
      <SplitEditor draft={draft} error={tried && !ok ? PROBLEM_TEXT.split : null} />
    </Page>
  );
}

export function CountsStep() {
  const { actions } = useApp();
  const draft = useEntryDraft();
  const [problem, setProblem] = useState<string | null>(null);
  if (!draft) return null;
  const save = async () => {
    const result = await actions.saveDraft();
    if (result === 'count_label') setProblem(PROBLEM_TEXT.count_label);
    else if (result === 'task' || result === 'split' || result === 'budget_line') actions.back();
    else if (result === 'times') setProblem(PROBLEM_TEXT.times);
  };
  return (
    <Page
      title="Counts and notes"
      back
      aside={stepCount(draft, 'counts')}
      footer={
        <button type="button" class="btn" onClick={() => void save()}>
          Save entry
        </button>
      }
    >
      <CountsAndNotes draft={draft} countError={problem} />
    </Page>
  );
}
