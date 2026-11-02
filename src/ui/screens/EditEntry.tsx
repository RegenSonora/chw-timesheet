// Edit entry (SPEC §5, decision 0008): every field of an uninvoiced entry, Save and Delete with Undo.
import { useLayoutEffect, useState } from 'preact/hooks';
import type { EntryDraft } from '../../storage';
import { ChangeRow } from './entry-parts';
import { Confirm, Page, entryNames } from '../components';
import { editDraft } from '../draft';
import { tasksLabel } from '../format';
import { sourceById, useApp } from '../store';
import {
  CountsAndNotes,
  PROBLEM_TEXT,
  SourceAndLine,
  SplitEditor,
  TaskList,
  TimesFields,
} from './entry-parts';
import type { DraftProblem } from '../draft';

/** Did the CHW change anything since opening the entry? */
function changed(draft: EntryDraft, original: EntryDraft): boolean {
  const strip = (d: EntryDraft) => ({ ...d, step: 'edit' });
  return JSON.stringify(strip(draft)) !== JSON.stringify(strip(original));
}

export function EditEntry() {
  const { data, actions } = useApp();
  const draft = data.app.draft?.kind === 'entry' ? data.app.draft : null;
  const entry = draft?.entry_id ? data.entries.find((e) => e.id === draft.entry_id) : undefined;
  const [problem, setProblem] = useState<DraftProblem | null>(null);
  const [pickingTask, setPickingTask] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = draft !== null && entry !== undefined && changed(draft, editDraft(entry));
  // Layout effect: set before paint, so a fast back gesture can't slip past.
  useLayoutEffect(() => {
    actions.setGuard(
      dirty
        ? () => ({
            title: 'Discard your changes?',
            confirm: 'Discard changes',
            cancel: 'Keep editing',
          })
        : null,
    );
    return () => {
      actions.setGuard(null);
    };
  }, [actions, dirty]);

  if (!draft || !entry) return null;
  const source = sourceById(draft.source_id);
  const known = draft.tasks.filter((s) => source.tasks.some((t) => t.id === s.task_id));

  const save = async () => {
    setProblem(await actions.saveDraft());
  };

  return (
    <Page
      title="Edit entry"
      back
      footer={
        <>
          <button type="button" class="btn" onClick={() => void save()}>
            Save changes
          </button>
          <button
            type="button"
            class="txt"
            onClick={() => {
              setDeleting(true);
            }}
          >
            Delete entry
          </button>
        </>
      }
    >
      <TimesFields draft={draft} />
      <SourceAndLine
        draft={draft}
        lineError={problem === 'budget_line' ? PROBLEM_TEXT.budget_line : null}
      />
      {pickingTask ? (
        <>
          <TaskList draft={draft} error={problem === 'task' ? PROBLEM_TEXT.task : null} />
          <button
            type="button"
            class="btn btn2"
            onClick={() => {
              setPickingTask(false);
            }}
          >
            Done with tasks
          </button>
        </>
      ) : (
        <ChangeRow
          label="What did you do?"
          value={known.length ? tasksLabel(source, known) : null}
          error={problem === 'task' || !known.length ? PROBLEM_TEXT.task : null}
          onChange={() => {
            setPickingTask(true);
          }}
        />
      )}
      {draft.tasks.length > 1 && (
        <SplitEditor draft={draft} error={problem === 'split' ? PROBLEM_TEXT.split : null} />
      )}
      <CountsAndNotes
        draft={draft}
        countError={problem === 'count_label' ? PROBLEM_TEXT.count_label : null}
      />
      {deleting && (
        <Confirm
          title="Delete this entry?"
          body={<p>{entryNames(entry).task}. You can undo this right after.</p>}
          confirm="Delete entry"
          cancel="Keep it"
          onConfirm={() => {
            setDeleting(false);
            void actions.deleteEntry(entry);
          }}
          onCancel={() => {
            setDeleting(false);
          }}
        />
      )}
    </Page>
  );
}
