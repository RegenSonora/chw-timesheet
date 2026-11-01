// Timer running (SPEC §5, decision 0009): large clock, largest Stop, Discard with confirmation.
import { useEffect, useState } from 'preact/hooks';
import { parseIso } from '../../core';
import { Confirm, Page } from '../components';
import {
  clockLabel,
  dateLabel,
  localDateTime,
  shortDateLabel,
  timeLabel,
  timeRangeLabel,
} from '../format';
import { useApp, type StopResult } from '../store';
import { entryNames } from '../components';
import { HomeHeaderAside } from './Home';

type Asking = null | 'discard' | Exclude<StopResult, { kind: 'ok' }>;

export function TimerRunning() {
  const { data, selectedSource, actions } = useApp();
  const timer = data.app.running_timer;
  const [now, setNow] = useState(() => Date.now());
  const [asking, setAsking] = useState<Asking>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  if (!timer || !selectedSource) return null;
  const startMs = parseIso(timer.start).epochMs;
  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
  const startDate = localDateTime(timer.start).date;

  const stop = async () => {
    const result = await actions.stopTimer();
    if (result.kind !== 'ok') setAsking(result);
  };

  return (
    <Page
      title="CHW Time Tracker"
      aside={
        <HomeHeaderAside
          onChip={() => {
            // Locked while the timer runs.
          }}
        />
      }
      mainClass="content timer"
      footer={
        <>
          <button type="button" class="btn-stop" onClick={() => void stop()}>
            <span class="stop-square" aria-hidden="true" />
            Stop
          </button>
          <button
            type="button"
            class="txt"
            onClick={() => {
              setAsking('discard');
            }}
          >
            Discard timer
          </button>
        </>
      }
    >
      <p class="timer-label">
        <span class="dot" aria-hidden="true" />
        Timer running · {selectedSource.code}
      </p>
      <p class="clock" role="timer" aria-label="Elapsed time">
        {clockLabel(elapsed)}
      </p>
      <p class="timer-started">
        Started {timeLabel(timer.start)}, {dateLabel(startDate)}
      </p>
      <p class="hint timer-note">You can close the app. The timer keeps counting.</p>

      {asking === 'discard' && (
        <Confirm
          title="Discard this timer?"
          body={<p>The time won't be saved.</p>}
          confirm="Discard timer"
          cancel="Keep timing"
          onConfirm={() => {
            setAsking(null);
            void actions.discardTimer();
          }}
          onCancel={() => {
            setAsking(null);
          }}
        />
      )}
      {asking !== null && asking !== 'discard' && asking.kind === 'too_short' && (
        <Confirm
          title="Too short to bill"
          body={<p>That's under 8 minutes, too short to bill. Nothing has been saved.</p>}
          confirm="Keep timing"
          second={{
            label: 'Discard',
            onClick: () => {
              setAsking(null);
              void actions.discardTimer();
            },
          }}
          onConfirm={() => {
            setAsking(null);
          }}
          onCancel={() => {
            setAsking(null);
          }}
        />
      )}
      {asking !== null && asking !== 'discard' && asking.kind === 'overlap' && (
        <Confirm
          title="This time overlaps another entry"
          body={
            <p>
              This timer overlaps your {timeRangeLabel(asking.other.start, asking.other.stop)} entry
              on {shortDateLabel(asking.other.entry_date)} ({entryNames(asking.other).task}). Fix
              the times to save it.
            </p>
          }
          confirm="Fix the times"
          cancel="Keep timing"
          onConfirm={() => {
            setAsking(null);
            void actions.fixTimerTimes();
          }}
          onCancel={() => {
            setAsking(null);
          }}
        />
      )}
    </Page>
  );
}
