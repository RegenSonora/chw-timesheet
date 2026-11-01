// Storage status and the erase warning (SPEC §2), shown in Setup and Settings.
import type { PersistenceStatus } from '../../storage';
import { CheckIcon, InfoIcon } from '../components';

const STATUS: Record<PersistenceStatus, { ok: boolean; text: string }> = {
  persisted: { ok: true, text: 'Storage protected on this phone' },
  not_persisted: {
    ok: false,
    text: 'Storage not protected: the phone may clear it when space runs low',
  },
  unsupported: { ok: false, text: "This browser can't protect storage" },
};

export function StorageStatus({
  status,
  setup = false,
}: {
  status: PersistenceStatus;
  setup?: boolean;
}) {
  const { ok, text } = STATUS[status];
  return (
    <div class="card storage">
      <p class="storage-status">
        {ok ? <CheckIcon /> : <InfoIcon />}
        {text}
      </p>
      <p class="hint">
        {setup
          ? "Entries are saved only on this phone. Removing the app from your Home Screen (iPhone) or clearing this site's data (Android) erases entries that aren't invoiced yet. Invoice often."
          : 'Entries are saved only on this phone. Invoice often so your hours are in email.'}
      </p>
    </div>
  );
}
