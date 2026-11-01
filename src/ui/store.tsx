// App state and actions. Screens read data and call actions here; only this file talks to storage.
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  checkEntryTimes,
  defaultBudgetLine,
  findOverlaps,
  type Entry,
  type FundingSourceConfig,
  type InvoiceCounter,
  type Profile,
  type SourceSettings,
} from '../core';
import { findFundingSource, FUNDING_SOURCES } from '../funding-sources';
import {
  emptyAppState,
  persistenceStatus,
  phoneNow,
  rememberPicks,
  requestPersistence,
  type AppState,
  type EntryDraft,
  type PersistenceStatus,
  type SetupDraft,
  type Storage,
} from '../storage';
import {
  buildEntry,
  editDraft,
  newHandDraft,
  newTimerDraft,
  withHand,
  type DraftProblem,
} from './draft';
import { hoursLabel, localDateTime } from './format';

export type Screen = 'home' | 'times' | 'task' | 'counts' | 'edit' | 'all' | 'settings';

const ENTRY_SCREENS: readonly Screen[] = ['times', 'task', 'counts', 'edit'];

export interface Data {
  profile: Profile | null;
  settings: SourceSettings[];
  entries: Entry[];
  counter: InvoiceCounter;
  app: AppState;
  persistence: PersistenceStatus;
}

export interface Toast {
  id: number;
  text: string;
  undo?: () => Promise<void>;
}

/** What a screen asks before the CHW leaves it (back button or the phone's back gesture). */
export interface LeaveConfirm {
  title: string;
  body?: string;
  confirm: string;
  cancel: string;
}

export type StopResult = { kind: 'ok' } | { kind: 'too_short' } | { kind: 'overlap'; other: Entry };

export interface SettingsChanges {
  profile: Profile;
  /** Null when the counter is locked or unchanged. */
  next_number: number | null;
  settings: SourceSettings[];
}

/**
 * Leaving the first step of a new timed entry would lose the timer's times, so it always asks.
 * Kept here, not in the screen, so a fast back gesture can't slip past before effects run.
 */
function timedEntryGuard(stack: readonly Screen[], app: AppState): LeaveConfirm | null {
  const d = app.draft;
  if (stack[stack.length - 1] !== 'task' || d?.kind !== 'entry') return null;
  if (d.entry_id !== null || d.hand !== null) return null;
  return {
    title: 'Discard this entry?',
    body: "The timed hours won't be saved.",
    confirm: 'Discard entry',
    cancel: 'Keep it',
  };
}

/** The stack of screens for a stored draft, so a reload returns to where the CHW was. */
function stackFor(app: AppState): Screen[] {
  const d = app.draft;
  if (d?.kind !== 'entry') return ['home'];
  if (d.step === 'edit') return ['home', 'edit'];
  const steps: Screen[] = d.hand ? ['times', 'task', 'counts'] : ['task', 'counts'];
  const at = steps.indexOf(d.step);
  return ['home', ...steps.slice(0, at < 0 ? 1 : at + 1)];
}

function initialSetupDraft(): SetupDraft {
  return {
    kind: 'setup',
    name: '',
    initials: '',
    mailing_address: '',
    next_number: '1',
    sources: Object.fromEntries(
      FUNDING_SOURCES.map((s, i) => [
        s.id,
        {
          picked: i === 0,
          rate: s.default_rate_cents === null ? '' : (s.default_rate_cents / 100).toFixed(2),
        },
      ]),
    ),
  };
}

export async function loadData(storage: Storage): Promise<Data> {
  const [profile, settings, entries, counter, app, persistence] = await Promise.all([
    storage.getProfile(),
    storage.listSourceSettings(),
    storage.listEntries(),
    storage.getCounter(),
    storage.getAppState(),
    persistenceStatus(),
  ]);
  return { profile, settings, entries, counter, app, persistence };
}

function useStore(storage: Storage, initial: Data) {
  const [data, setDataState] = useState(initial);
  const dataRef = useRef(initial);
  const setData = useCallback((next: Data) => {
    dataRef.current = next;
    setDataState(next);
  }, []);

  // Writes run one after another so a fast tapper never saves out of order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task, task);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const saveApp = useCallback(
    (app: AppState) => {
      setData({ ...dataRef.current, app });
      return serial(() => storage.saveAppState(app));
    },
    [serial, setData, storage],
  );

  const reloadEntries = useCallback(async () => {
    const entries = await storage.listEntries();
    setData({ ...dataRef.current, entries });
  }, [setData, storage]);

  // --- Navigation ---------------------------------------------------------------------------
  const [stack, setStackState] = useState<Screen[]>(() => stackFor(initial.app));
  const stackRef = useRef(stack);
  const setStack = useCallback((next: Screen[]) => {
    stackRef.current = next;
    setStackState(next);
  }, []);
  const guard = useRef<(() => LeaveConfirm | null) | null>(null);
  const [asking, setAsking] = useState<LeaveConfirm | null>(null);
  const bypass = useRef(false);

  useEffect(() => {
    history.replaceState({ depth: 0 }, '');
    for (let i = 1; i < stackRef.current.length; i++) history.pushState({ depth: i }, '');
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { depth?: number } | null;
      const depth = state?.depth ?? 0;
      const current = stackRef.current;
      if (depth >= current.length - 1) return;
      if (!bypass.current) {
        const ask = guard.current?.() ?? timedEntryGuard(current, dataRef.current.app);
        if (ask) {
          history.pushState({ depth: current.length - 1 }, '');
          setAsking(ask);
          return;
        }
      }
      bypass.current = false;
      const next = current.slice(0, depth + 1);
      setStack(next);
      // Leaving the entry screens without saving drops the draft.
      const draft = dataRef.current.app.draft;
      if (draft?.kind === 'entry' && !next.some((s) => ENTRY_SCREENS.includes(s))) {
        void saveApp({ ...dataRef.current.app, draft: null });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [saveApp, setStack]);

  const push = useCallback(
    (screen: Screen) => {
      const next = [...stackRef.current, screen];
      setStack(next);
      history.pushState({ depth: next.length - 1 }, '');
    },
    [setStack],
  );

  const back = useCallback(() => {
    history.back();
  }, []);

  /** One screen back without asking, e.g. after Save. */
  const leave = useCallback(() => {
    bypass.current = true;
    history.back();
  }, []);

  /** Back to Home without asking, e.g. after Save. */
  const home = useCallback(() => {
    const n = stackRef.current.length - 1;
    if (n > 0) {
      bypass.current = true;
      history.go(-n);
    }
  }, []);

  // Back from a screen keeps the draft step in step with what the CHW sees.
  useEffect(() => {
    const top = stack[stack.length - 1];
    const draft = dataRef.current.app.draft;
    if (top && draft?.kind === 'entry' && ENTRY_SCREENS.includes(top) && draft.step !== top) {
      void saveApp({
        ...dataRef.current.app,
        draft: { ...draft, step: top as EntryDraft['step'] },
      });
    }
  }, [stack, saveApp]);

  const answerLeave = useCallback((leave: boolean) => {
    setAsking(null);
    if (leave) {
      bypass.current = true;
      history.back();
    }
  }, []);

  // --- Toast --------------------------------------------------------------------------------
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);
  const showToast = useCallback((text: string, undo?: () => Promise<void>) => {
    toastId.current += 1;
    setToast(undo ? { id: toastId.current, text, undo } : { id: toastId.current, text });
  }, []);

  // --- Actions ------------------------------------------------------------------------------
  const sourceOf = (id: string): FundingSourceConfig => {
    const source = findFundingSource(id);
    if (!source) throw new Error(`Unknown funding source ${id}`);
    return source;
  };

  const actions = useMemo(() => {
    const d = () => dataRef.current;

    const selectedSourceId = (): string => {
      const { app, settings } = d();
      const id = app.selected_source_id;
      if (id && settings.some((s) => s.source_id === id)) return id;
      const first = settings[0]?.source_id;
      if (!first) throw new Error('No funding source set up');
      return first;
    };

    const lastLine = (sourceId: string) =>
      defaultBudgetLine(
        sourceOf(sourceId),
        d().app.per_source[sourceId]?.last_budget_line_id ?? null,
      );

    const entryWords = (e: Entry) => {
      const times = checkEntryTimes(e.start, e.stop);
      const task = sourceOf(e.source_id).tasks.find((t) => t.id === e.task_id);
      return `${times.ok ? hoursLabel(times.quarters) : ''}, ${task?.name ?? ''}`;
    };

    return {
      setGuard(fn: (() => LeaveConfirm | null) | null) {
        guard.current = fn;
      },

      selectSource(id: string) {
        return saveApp({ ...d().app, selected_source_id: id });
      },

      startTimer() {
        setToast(null);
        return saveApp({
          ...d().app,
          running_timer: { start: phoneNow(), source_id: selectedSourceId() },
        });
      },

      /** Stop the timer. On "too short" or an overlap the timer keeps running until the CHW decides. */
      async stopTimer(): Promise<StopResult> {
        const timer = d().app.running_timer;
        if (!timer) return { kind: 'ok' };
        const stop = phoneNow();
        const times = checkEntryTimes(timer.start, stop);
        if (!times.ok) return { kind: 'too_short' };
        const other = findOverlaps({ start: timer.start, stop }, d().entries)[0];
        if (other) return { kind: 'overlap', other };
        await saveApp({
          ...d().app,
          running_timer: null,
          draft: newTimerDraft(timer.source_id, timer.start, stop, lastLine(timer.source_id)),
        });
        push('task');
        return { kind: 'ok' };
      },

      discardTimer() {
        return saveApp({ ...d().app, running_timer: null });
      },

      /** The timer overlaps an entry: carry its times into "Enter times" to fix them. */
      async fixTimerTimes() {
        const timer = d().app.running_timer;
        if (!timer) return;
        const start = localDateTime(timer.start);
        const stop = localDateTime(phoneNow());
        await saveApp({
          ...d().app,
          running_timer: null,
          draft: newHandDraft(
            timer.source_id,
            { date: start.date, start: start.time, end: stop.time },
            lastLine(timer.source_id),
          ),
        });
        push('times');
      },

      async startHandEntry() {
        setToast(null);
        const sourceId = selectedSourceId();
        const today = localDateTime(phoneNow()).date;
        await saveApp({
          ...d().app,
          draft: newHandDraft(sourceId, { date: today, start: '', end: '' }, lastLine(sourceId)),
        });
        push('times');
      },

      editEntry(entry: Entry) {
        setToast(null);
        void saveApp({ ...d().app, draft: editDraft(entry) });
        push('edit');
      },

      updateDraft(patch: Partial<EntryDraft>) {
        const draft = d().app.draft;
        if (draft?.kind !== 'entry') return Promise.resolve();
        let next: EntryDraft = { ...draft, ...patch };
        if (patch.hand) next = withHand(next, patch.hand);
        return saveApp({ ...d().app, draft: next });
      },

      updateSetupDraft(draft: SetupDraft) {
        return saveApp({ ...d().app, draft });
      },

      setupDraft(): SetupDraft {
        const draft = d().app.draft;
        return draft?.kind === 'setup' ? draft : initialSetupDraft();
      },

      /** Save the entry being entered or edited. Returns what is still missing, or null. */
      async saveDraft(): Promise<DraftProblem | null> {
        const draft = d().app.draft;
        if (draft?.kind !== 'entry') return null;
        const existing = draft.entry_id
          ? (d().entries.find((e) => e.id === draft.entry_id) ?? null)
          : null;
        const source = sourceOf(draft.source_id);
        const built = buildEntry(draft, source, d().entries, existing, phoneNow(), () =>
          crypto.randomUUID(),
        );
        if (!built.ok) return built.problem;
        const entry = built.entry;
        const saved = await serial(() => storage.saveEntry(entry));
        if (!saved.ok) return 'times';
        await saveApp({
          ...rememberPicks(d().app, entry.source_id, entry.task_id, entry.budget_line_id),
          draft: null,
          selected_source_id: entry.source_id,
        });
        await reloadEntries();
        home();
        if (!existing) {
          showToast(`Saved: ${entryWords(entry)}`, async () => {
            await serial(() => storage.deleteEntry(entry.id));
            await reloadEntries();
            showToast('Entry removed');
          });
        } else {
          const moved = existing.source_id !== entry.source_id;
          showToast(moved ? `Moved to ${source.code}` : `Saved: ${entryWords(entry)}`, async () => {
            await serial(() => storage.saveEntry(existing));
            await saveApp({ ...d().app, selected_source_id: existing.source_id });
            await reloadEntries();
            showToast('Change undone');
          });
        }
        return null;
      },

      async deleteEntry(entry: Entry) {
        const result = await serial(() => storage.deleteEntry(entry.id));
        if (!result.ok) return;
        await saveApp({ ...d().app, draft: null });
        await reloadEntries();
        home();
        showToast(`Deleted: ${entryWords(entry)}`, async () => {
          await serial(() => storage.saveEntry(entry));
          await reloadEntries();
          showToast('Entry restored');
        });
      },

      async undoToast() {
        const undo = toast?.undo;
        setToast(null);
        if (undo) await undo();
      },

      dismissToast() {
        setToast(null);
      },

      async requestPersistence() {
        const persistence = await requestPersistence();
        setData({ ...d(), persistence });
      },

      async finishSetup(setup: {
        profile: Profile;
        next_number: number;
        settings: SourceSettings[];
      }) {
        await serial(async () => {
          await storage.saveProfile(setup.profile);
          for (const s of setup.settings) await storage.saveSourceSettings(s);
          await storage.setNextNumber(setup.next_number);
        });
        const app: AppState = {
          ...emptyAppState(),
          ...d().app,
          draft: null,
          selected_source_id: setup.settings[0]?.source_id ?? null,
        };
        await serial(() => storage.saveAppState(app));
        setData({
          ...d(),
          profile: setup.profile,
          settings: await storage.listSourceSettings(),
          counter: await storage.getCounter(),
          app,
        });
      },

      async saveSettings(changes: SettingsChanges) {
        await serial(async () => {
          await storage.saveProfile(changes.profile);
          for (const s of changes.settings) await storage.saveSourceSettings(s);
          if (changes.next_number !== null) await storage.setNextNumber(changes.next_number);
        });
        setData({
          ...d(),
          profile: changes.profile,
          settings: await storage.listSourceSettings(),
          counter: await storage.getCounter(),
        });
      },

      push,
      back,
      leave,
      home,
      showToast,
    };
    // `toast` is read for undo; everything else goes through refs.
  }, [home, leave, push, back, reloadEntries, saveApp, serial, setData, showToast, storage, toast]);

  const selectedSource = useMemo((): FundingSourceConfig | null => {
    const id =
      data.app.running_timer?.source_id ??
      (data.settings.some((s) => s.source_id === data.app.selected_source_id)
        ? data.app.selected_source_id
        : data.settings[0]?.source_id);
    return id ? (findFundingSource(id) ?? null) : null;
  }, [data]);

  return {
    data,
    stack,
    screen: stack[stack.length - 1] ?? 'home',
    toast,
    asking,
    answerLeave,
    selectedSource,
    actions,
  };
}

export type Store = ReturnType<typeof useStore>;

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({
  storage,
  initial,
  children,
}: {
  storage: Storage;
  initial: Data;
  children: preact.ComponentChildren;
}) {
  const store = useStore(storage, initial);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useApp(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useApp outside StoreProvider');
  return store;
}

export function sourceById(id: string): FundingSourceConfig {
  const source = findFundingSource(id);
  if (!source) throw new Error(`Unknown funding source ${id}`);
  return source;
}
