// Opens storage, then shows the screen for where the CHW is (SPEC §9).
import { useEffect, useState } from 'preact/hooks';
import { openIdbStorage, type Storage } from '../storage';
import { needsInstallGate } from './platform';
import { loadData, StoreProvider, useApp, type Data } from './store';
import { AllEntries } from './screens/AllEntries';
import { EditEntry } from './screens/EditEntry';
import { CountsStep, EnterTimes, TaskStep } from './screens/EntrySteps';
import { Home } from './screens/Home';
import { InstallGate } from './screens/InstallGate';
import { InvoicePreview } from './screens/InvoicePreview';
import { InvoiceReady } from './screens/InvoiceReady';
import { PastInvoices } from './screens/PastInvoices';
import { Settings } from './screens/Settings';
import { Setup } from './screens/Setup';
import { TimerRunning } from './screens/TimerRunning';
import { Confirm } from './components';

type Boot =
  | { state: 'loading' }
  | { state: 'gate' }
  | { state: 'failed'; reason: string }
  | { state: 'ready'; storage: Storage; data: Data };

function Screens() {
  const { data, screen, stack, asking, answerLeave } = useApp();
  if (!data.profile) return <Setup />;
  let view;
  switch (screen) {
    case 'times':
      view = <EnterTimes />;
      break;
    case 'task':
      view = <TaskStep />;
      break;
    case 'counts':
      view = <CountsStep />;
      break;
    case 'edit':
      view = <EditEntry />;
      break;
    case 'all':
      view = <AllEntries />;
      break;
    case 'settings':
      view = <Settings />;
      break;
    case 'invoice':
      view = <InvoicePreview />;
      break;
    case 'invoice-ready':
      view = <InvoiceReady />;
      break;
    case 'invoices':
      view = <PastInvoices />;
      break;
    default:
      view = data.app.running_timer ? <TimerRunning /> : <Home />;
  }
  return (
    <>
      {/* Keyed by depth so each screen mounts fresh and focuses its heading. */}
      <div key={`${String(stack.length)}-${screen}`} class="view">
        {view}
      </div>
      {asking && (
        <Confirm
          title={asking.title}
          {...(asking.body ? { body: <p>{asking.body}</p> } : {})}
          confirm={asking.confirm}
          cancel={asking.cancel}
          onConfirm={() => {
            answerLeave(true);
          }}
          onCancel={() => {
            answerLeave(false);
          }}
        />
      )}
    </>
  );
}

const PROBLEMS: Record<string, string> = {
  newer_data:
    'This phone has data from a newer version of the app. Close the app and open it again to update.',
  upgrade_failed:
    "The app couldn't update your saved data. Nothing was changed. Close the app and try again.",
  unavailable:
    "This browser can't save data here. If you're in a private window, open the app normally.",
};

export function App() {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });

  useEffect(() => {
    void (async () => {
      const opened = await openIdbStorage();
      if (!opened.ok) {
        setBoot({ state: 'failed', reason: opened.reason });
        return;
      }
      const data = await loadData(opened.storage);
      // Only a phone with no profile yet needs the gate: data exists only where it was set up.
      const gate = !data.profile && needsInstallGate(navigator, (q) => window.matchMedia(q));
      setBoot(gate ? { state: 'gate' } : { state: 'ready', storage: opened.storage, data });
    })();
  }, []);

  switch (boot.state) {
    case 'loading':
      return <div class="screen" aria-busy="true" />;
    case 'gate':
      return <InstallGate />;
    case 'failed':
      return (
        <div class="screen">
          <main class="content">
            <h1>Can't open your entries</h1>
            <p class="lead">{PROBLEMS[boot.reason] ?? PROBLEMS['unavailable']}</p>
          </main>
        </div>
      );
    case 'ready':
      return (
        <StoreProvider storage={boot.storage} initial={boot.data}>
          <Screens />
        </StoreProvider>
      );
  }
}
