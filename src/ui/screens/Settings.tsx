// Settings (SPEC §4, decisions 0005, 0010, 0023, 0027): details, role, next number, rates and NTE,
// storage, version.
import { useLayoutEffect, useState } from 'preact/hooks';
import {
  formatDollars,
  formatInvoiceNumber,
  normalizeInitials,
  parseDollars,
  rateChangeCheck,
  uninvoicedEntries,
  type SourceSettings,
} from '../../core';
import { FUNDING_SOURCES } from '../../funding-sources';
import { Confirm, Field, Page } from '../components';
import { paperWord, plural, roleLabel, versionLabel } from '../format';
import { sourceById, useApp } from '../store';
import { raiseHint, validNextNumber } from './Setup';
import { StorageStatus } from './StorageStatus';

const dollars = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2));

interface Form {
  name: string;
  initials: string;
  mailing_address: string;
  next_number: string;
  /** Per source the CHW works under, or is adding now. */
  sources: Record<string, { rate: string; nte: string; adding: boolean }>;
}

interface RateQuestion {
  source_id: string;
  count: number;
  old_rate_cents: number;
  new_rate_cents: number;
}

export function Settings() {
  const { data, role, actions } = useApp();
  const profile = data.profile;
  const initialForm = (): Form => ({
    name: profile?.name ?? '',
    initials: profile?.initials ?? '',
    mailing_address: profile?.mailing_address ?? '',
    next_number: String(data.counter.next),
    sources: Object.fromEntries(
      data.settings.map((s) => [
        s.source_id,
        { rate: dollars(s.rate_cents), nte: dollars(s.nte_cents), adding: false },
      ]),
    ),
  });
  const [form, setForm] = useState<Form>(initialForm);
  const [saved, setSaved] = useState<Form>(form);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [question, setQuestion] = useState<{
    asks: RateQuestion[];
    settings: SourceSettings[];
  } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
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

  if (!profile) return null;
  const setSource = (id: string, patch: Partial<Form['sources'][string]>) => {
    const current = form.sources[id] ?? { rate: '', nte: '', adding: false };
    setForm({ ...form, sources: { ...form.sources, [id]: { ...current, ...patch } } });
  };

  const commit = async (settings: SourceSettings[], keepRates: string[]) => {
    const next = data.counter.locked ? null : validNextNumber(form.next_number);
    const initials = normalizeInitials(form.initials) ?? profile.initials;
    const finalSettings = settings.map((s) => {
      if (!keepRates.includes(s.source_id)) return s;
      const old = data.settings.find((o) => o.source_id === s.source_id);
      return old ? { ...s, rate_cents: old.rate_cents } : s;
    });
    await actions.saveSettings({
      profile: {
        ...profile,
        name: form.name.trim(),
        initials,
        mailing_address: form.mailing_address.trim(),
      },
      next_number: next === data.counter.next ? null : next,
      settings: finalSettings,
    });
    const after: Form = {
      ...form,
      sources: Object.fromEntries(
        finalSettings.map((s) => [
          s.source_id,
          { rate: dollars(s.rate_cents), nte: dollars(s.nte_cents), adding: false },
        ]),
      ),
    };
    setForm(after);
    setSaved(after);
    return after;
  };

  const save = async () => {
    const found: Partial<Record<string, string>> = {};
    if (!form.name.trim()) found['name'] = 'Enter your name.';
    if (!normalizeInitials(form.initials)) found['initials'] = 'Use 1 to 4 letters, like CC.';
    if (!data.counter.locked && validNextNumber(form.next_number) === null) {
      found['next'] = 'Enter a whole number, like 1.';
    }
    const settings: SourceSettings[] = [];
    for (const [id, s] of Object.entries(form.sources)) {
      const source = sourceById(id);
      const rate = parseDollars(s.rate);
      if (rate === null || rate < 1) {
        found[`rate-${id}`] = 'Enter your hourly rate, like 20.00.';
        continue;
      }
      let nte: number | null = null;
      if (source.has_nte && s.nte.trim()) {
        nte = parseDollars(s.nte);
        if (nte === null) {
          found[`nte-${id}`] = 'Enter the amount from your agreement, like 5,000.00.';
          continue;
        }
      }
      settings.push({ source_id: id, rate_cents: rate, nte_cents: nte });
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    // SPEC §4: changing a rate with entries waiting asks first.
    const asks: RateQuestion[] = [];
    for (const s of settings) {
      const old = data.settings.find((o) => o.source_id === s.source_id);
      const count = uninvoicedEntries(data.entries, s.source_id).length;
      const check = rateChangeCheck(old?.rate_cents ?? null, s.rate_cents, count);
      if (check.kind === 'confirm') asks.push({ source_id: s.source_id, ...check });
    }
    if (asks.length) {
      setQuestion({ asks, settings });
      return;
    }
    await commit(settings, []);
    actions.showToast('Settings saved');
    actions.leave();
  };

  const answer = async (choice: 'invoice_first' | 'change' | 'cancel') => {
    if (!question) return;
    const [ask, ...rest] = question.asks;
    if (!ask || choice === 'cancel') {
      setQuestion(null);
      return;
    }
    if (choice === 'invoice_first') {
      // Keep the old rate for this source; save everything else, then go make the invoice.
      setQuestion(null);
      await commit(question.settings, [ask.source_id]);
      await actions.openInvoicePreview(ask.source_id, 'replace');
      return;
    }
    if (rest.length) {
      setQuestion({ asks: rest, settings: question.settings });
      return;
    }
    setQuestion(null);
    await commit(question.settings, []);
    actions.showToast('Settings saved');
    actions.leave();
  };

  const initials = normalizeInitials(form.initials) ?? profile.initials;
  const next = validNextNumber(form.next_number) ?? data.counter.next;
  const nextLabel = formatInvoiceNumber(initials, new Date().getFullYear(), next);
  // With a role, its sources come from the role: nothing to add (decision 0027).
  const notAdded = role ? [] : FUNDING_SOURCES.filter((s) => !(s.id in form.sources));
  const paper = paperWord(role);
  const employee = role?.employment === 'employee';
  // Decision 0032: the report is for roles counting toward CHW certification; no role keeps it.
  const showReport = !role || role.certification_step !== undefined;
  // With one source, "all funding sources" says nothing (decision 0023).
  const allSources = FUNDING_SOURCES.length > 1 ? ' (all funding sources)' : '';
  const ask = question?.asks[0];

  return (
    <Page
      title="Settings"
      back
      footer={
        <button type="button" class="btn" onClick={() => void save()}>
          Save changes
        </button>
      }
    >
      {role && (
        <>
          <h2 class="sec">Your role</h2>
          <p class="info-row">
            <strong>{roleLabel(role)}</strong>
          </p>
          <p class="hint">Set at setup. Ask the office to change it.</p>
        </>
      )}
      <h2 class="sec">Your details</h2>
      <Field label="Your name" error={errors['name']}>
        {(p) => (
          <input
            {...p}
            class="inp"
            autocomplete="name"
            value={form.name}
            onInput={(e) => {
              setForm({ ...form, name: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      <Field
        label="Initials"
        hint="Changing them doesn't change invoice numbering."
        error={errors['initials']}
      >
        {(p) => (
          <input
            {...p}
            class="inp inp-short"
            autocapitalize="characters"
            maxLength={4}
            value={form.initials}
            onInput={(e) => {
              setForm({ ...form, initials: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      <Field label="Mailing address">
        {(p) => (
          <textarea
            {...p}
            class="inp inp-area"
            placeholder="Street, city, state, ZIP"
            value={form.mailing_address}
            onInput={(e) => {
              setForm({ ...form, mailing_address: e.currentTarget.value });
            }}
          />
        )}
      </Field>
      {data.counter.locked ? (
        <p class="info-row">
          <span class="hint">Next invoice #{allSources}</span>
          <strong>{nextLabel}</strong>
        </p>
      ) : (
        <Field
          label={`Next invoice number${allSources}`}
          hint={`Your next ${paper} will be ${nextLabel}. This can't change after your first ${paper}.`}
          error={errors['next']}
        >
          {(p) => (
            <input
              {...p}
              class="inp inp-short"
              inputMode="numeric"
              value={form.next_number}
              onInput={(e) => {
                setForm({ ...form, next_number: e.currentTarget.value });
              }}
            />
          )}
        </Field>
      )}

      {Object.entries(form.sources).map(([id, s]) => {
        const source = sourceById(id);
        return (
          <section key={id} class="settings-source" aria-labelledby={`sec-${id}`}>
            <h2 class="sec" id={`sec-${id}`}>
              {source.code}
              {source.name !== source.code && <span class="sec-name"> · {source.name}</span>}
            </h2>
            <Field
              label={`Hourly rate for ${source.code}`}
              hint={[
                s.adding
                  ? 'From your agreement.'
                  : `Used for your next ${paper}. Past ${paper}s don't change.`,
                raiseHint(role?.funding.find((f) => f.source_id === id) ?? source),
              ]
                .filter(Boolean)
                .join(' ')}
              error={errors[`rate-${id}`]}
            >
              {(p) => (
                <input
                  {...p}
                  class="inp inp-money"
                  inputMode="decimal"
                  value={s.rate}
                  onInput={(e) => {
                    setSource(id, { rate: e.currentTarget.value });
                  }}
                />
              )}
            </Field>
            {employee ? null : source.has_nte ? (
              <Field
                label={`Not-to-exceed amount for ${source.code}`}
                hint="Update it if your agreement is amended."
                error={errors[`nte-${id}`]}
              >
                {(p) => (
                  <input
                    {...p}
                    class="inp inp-money"
                    inputMode="decimal"
                    value={s.nte}
                    onInput={(e) => {
                      setSource(id, { nte: e.currentTarget.value });
                    }}
                  />
                )}
              </Field>
            ) : (
              <p class="hint">No not-to-exceed amount for this funding source.</p>
            )}
          </section>
        );
      })}

      {notAdded.length > 0 && (
        <>
          <h2 class="sec">Add a funding source</h2>
          {notAdded.map((source) => (
            <div key={source.id} class="card add-source">
              <span class="check-text">
                <span class="check-name">{source.code}</span>
                <span class="check-detail">{source.name}</span>
              </span>
              <button
                type="button"
                class="btn2 btn-small"
                aria-label={`Add ${source.code}`}
                onClick={() => {
                  setSource(source.id, {
                    rate: dollars(source.default_rate_cents),
                    nte: '',
                    adding: true,
                  });
                }}
              >
                Add
              </button>
            </div>
          ))}
        </>
      )}

      {/* Decision 0026: run any time, for the ADHS CHW hours attestation form. */}
      {showReport && (
        <>
          <h2 class="sec">Reports</h2>
          <button
            type="button"
            class="card nav-row"
            onClick={() => {
              actions.push('report');
            }}
          >
            <span>Work Hours Report</span>
            <span class="nav-row-detail">Hours by core competency</span>
          </button>
          <p class="hint">For the ADHS CHW hours attestation form. Run it any time.</p>
        </>
      )}

      <h2 class="sec">This phone</h2>
      <StorageStatus status={data.persistence} />
      <p class="hint">Version {versionLabel(__APP_VERSION__)} · Open source (Apache 2.0)</p>

      {ask && (
        <Confirm
          title={`Change your ${sourceById(ask.source_id).code} rate to ${formatDollars(ask.new_rate_cents)}?`}
          body={
            <>
              <p>
                You have <strong>{plural(ask.count, 'entry', 'entries')}</strong> not yet{' '}
                {employee ? 'submitted' : 'invoiced'}. If you change the rate now, they will be
                billed at {formatDollars(ask.new_rate_cents)} instead of{' '}
                {formatDollars(ask.old_rate_cents)}.
              </p>
              <p>
                To bill them at {formatDollars(ask.old_rate_cents)},{' '}
                {employee ? 'submit a timesheet' : 'create an invoice'} first.
              </p>
            </>
          }
          confirm={employee ? 'Submit timesheet first' : 'Create invoice first'}
          second={{ label: 'Change rate now', onClick: () => void answer('change') }}
          cancel="Cancel"
          onConfirm={() => void answer('invoice_first')}
          onCancel={() => void answer('cancel')}
        />
      )}
    </Page>
  );
}
