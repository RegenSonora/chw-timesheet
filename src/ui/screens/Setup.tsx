// Setup (SPEC §4, decision 0005): details, funding sources with rates, storage status.
import { useEffect, useState } from 'preact/hooks';
import {
  formatInvoiceNumber,
  normalizeInitials,
  parseDollars,
  type SourceSettings,
} from '../../core';
import { FUNDING_SOURCES } from '../../funding-sources';
import type { SetupDraft } from '../../storage';
import { Field, Page } from '../components';
import { useApp } from '../store';
import { StorageStatus } from './StorageStatus';

type Errors = Partial<Record<string, string>>;

export function validNextNumber(text: string): number | null {
  const n = Number(text.trim());
  return /^\d+$/.test(text.trim()) && Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export function Setup() {
  const { data, actions } = useApp();
  const [form, setForm] = useState<SetupDraft>(() => actions.setupDraft());
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    void actions.requestPersistence();
  }, [actions]);

  // Every keystroke is kept, so an interruption never loses the form (SPEC §10).
  const update = (next: SetupDraft) => {
    setForm(next);
    void actions.updateSetupDraft(next);
  };
  const setSource = (id: string, patch: Partial<{ picked: boolean; rate: string }>) => {
    const current = form.sources[id] ?? { picked: false, rate: '' };
    update({ ...form, sources: { ...form.sources, [id]: { ...current, ...patch } } });
  };

  const save = async () => {
    const found: Errors = {};
    if (!form.name.trim()) found['name'] = 'Enter your name.';
    const initials = normalizeInitials(form.initials);
    if (!initials) found['initials'] = 'Use 1 to 4 letters, like CC.';
    const next = validNextNumber(form.next_number);
    if (next === null) found['next'] = 'Enter a whole number, like 1.';
    const settings: SourceSettings[] = [];
    for (const source of FUNDING_SOURCES) {
      const s = form.sources[source.id];
      if (!s?.picked) continue;
      const rate = parseDollars(s.rate);
      if (rate === null || rate < 1)
        found[`rate-${source.id}`] = 'Enter your hourly rate, like 20.00.';
      else settings.push({ source_id: source.id, rate_cents: rate, nte_cents: null });
    }
    if (!FUNDING_SOURCES.some((s) => form.sources[s.id]?.picked)) {
      found['sources'] = 'Pick at least one funding source.';
    }
    setErrors(found);
    if (Object.keys(found).length || !initials || next === null) return;
    await actions.finishSetup({
      profile: {
        name: form.name.trim(),
        initials,
        mailing_address: form.mailing_address.trim(),
        logo: null,
      },
      next_number: next,
      settings,
    });
  };

  const initials = normalizeInitials(form.initials);
  const next = validNextNumber(form.next_number);
  const example =
    initials && next !== null
      ? `Your next invoice will be ${formatInvoiceNumber(initials, new Date().getFullYear(), next)}.`
      : 'Used in invoice numbers, like CC-2026-001.';

  return (
    <Page
      title="Set up"
      footer={
        <button type="button" class="btn" onClick={() => void save()}>
          Save and start
        </button>
      }
    >
      <p class="lead">This goes on your invoices. You can change it later in Settings.</p>
      <h2 class="sec">Your details</h2>
      <Field label="Your name" error={errors['name']}>
        {(p) => (
          <input
            {...p}
            class="inp"
            autocomplete="name"
            value={form.name}
            onInput={(e) => {
              update({ ...form, name: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      <Field label="Initials" hint={example} error={errors['initials']}>
        {(p) => (
          <input
            {...p}
            class="inp inp-short"
            autocapitalize="characters"
            autocomplete="off"
            maxLength={4}
            value={form.initials}
            onInput={(e) => {
              update({ ...form, initials: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      <Field label="Mailing address">
        {(p) => (
          <textarea
            {...p}
            class="inp inp-area"
            autocomplete="street-address"
            placeholder="Street, city, state, ZIP"
            value={form.mailing_address}
            onInput={(e) => {
              update({ ...form, mailing_address: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      <Field
        label="Next invoice number"
        hint="Already sent paper invoices? Enter the next number, like 4. Otherwise leave 1."
        error={errors['next']}
      >
        {(p) => (
          <input
            {...p}
            class="inp inp-short"
            inputMode="numeric"
            value={form.next_number}
            onInput={(e) => {
              update({ ...form, next_number: e.currentTarget.value });
            }}
          />
        )}
      </Field>

      <h2 class="sec" id="sources-heading">
        Funding sources you work under
      </h2>
      {errors['sources'] && <p class="error-plain">{errors['sources']}</p>}
      {FUNDING_SOURCES.map((source) => {
        const s = form.sources[source.id] ?? { picked: false, rate: '' };
        return (
          <div key={source.id} class={s.picked ? 'card card-on' : 'card'}>
            <label class="check">
              <input
                type="checkbox"
                checked={s.picked}
                onChange={(e) => {
                  setSource(source.id, { picked: e.currentTarget.checked });
                }}
              />
              <span class="check-text">
                <span class="check-name">{source.code}</span>
                <span class="check-detail">{source.name}</span>
              </span>
            </label>
            {s.picked && (
              <div class="card-body">
                <Field
                  label={`Hourly rate for ${source.code}`}
                  hint={
                    source.has_nte
                      ? 'From your agreement. Add the not-to-exceed amount later in Settings.'
                      : 'From your agreement.'
                  }
                  error={errors[`rate-${source.id}`]}
                >
                  {(p) => (
                    <input
                      {...p}
                      class="inp inp-money"
                      inputMode="decimal"
                      value={s.rate}
                      onInput={(e) => {
                        setSource(source.id, { rate: e.currentTarget.value });
                      }}
                    />
                  )}
                </Field>
              </div>
            )}
          </div>
        );
      })}
      <StorageStatus status={data.persistence} setup />
    </Page>
  );
}
