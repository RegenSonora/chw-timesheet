// New entry: Enter times → task and budget line → counts and notes → Save (SPEC §5).
import { useState } from 'preact/hooks';
import type { EntryDraft } from '../../storage';
import { Page } from '../components';
import { checkDraftTimes } from '../draft';
import { useApp } from '../store';
import {
  CountsAndNotes,
  PROBLEM_TEXT,
  SourceAndLine,
  TaskList,
  TimeCard,
  TimesFields,
} from './entry-parts';

function useEntryDraft(): EntryDraft | null {
  const { data } = useApp();
  const draft = data.app.draft;
  return draft?.kind === 'entry' ? draft : null;
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
  const missingTask = !draft.task_id;
  const missingLine = !draft.budget_line_id;
  return (
    <Page
      title="New entry"
      back
      aside={<span class="step-count">Step 1 of 2</span>}
      footer={
        <button
          type="button"
          class="btn"
          onClick={() => {
            setTried(true);
            if (!missingTask && !missingLine) actions.push('counts');
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

export function CountsStep() {
  const { actions } = useApp();
  const draft = useEntryDraft();
  const [problem, setProblem] = useState<string | null>(null);
  if (!draft) return null;
  const save = async () => {
    const result = await actions.saveDraft();
    if (result === 'count_label') setProblem(PROBLEM_TEXT.count_label);
    else if (result === 'task' || result === 'budget_line') actions.back();
    else if (result === 'times') setProblem(PROBLEM_TEXT.times);
  };
  return (
    <Page
      title="New entry"
      back
      aside={<span class="step-count">Step 2 of 2</span>}
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
