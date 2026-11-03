// Setup (SPEC §4, decisions 0005, 0027, 0030): your details, pick your role, review the role with
// its rates prefilled, then storage status.
import { useEffect, useState } from 'preact/hooks';
import {
  formatDollars,
  formatInvoiceNumber,
  normalizeInitials,
  parseDollars,
  prefillRate,
  roleChoices,
  taskChoices,
  type FundingSourceConfig,
  type RateStep,
  type Role,
  type SourceSettings,
} from '../../core';
import { FUNDING_SOURCES } from '../../funding-sources';
import { findRole, ROLES } from '../../roles';
import type { SetupDraft } from '../../storage';
import { Field, Page } from '../components';
import { lineName, roleLabel } from '../format';
import { sourceById, useApp } from '../store';
import { StorageStatus } from './StorageStatus';

type Errors = Partial<Record<string, string>>;

export function validNextNumber(text: string): number | null {
  const n = Number(text.trim());
  return /^\d+$/.test(text.trim()) && Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** The raise the agreement names, or null (decisions 0023, 0030). */
export function raiseHint(funding: { rate_step?: RateStep }): string | null {
  const step = funding.rate_step;
  return step
    ? `It goes up to ${formatDollars(step.rate_cents)} after ${String(step.after_quarters / 4)} hours.`
    : null;
}

/** The rate as typed, prefilled from the role, its funding entry or the source (decision 0030). */
function prefilledRates(role: Role): SetupDraft['sources'] {
  return Object.fromEntries(
    role.funding.map((f) => {
      const cents = prefillRate(role, f, sourceById(f.source_id));
      return [f.source_id, { rate: cents === null ? '' : (cents / 100).toFixed(2) }];
    }),
  );
}

/** The role's sources, in the role's order. */
function roleSources(role: Role): FundingSourceConfig[] {
  return role.funding.flatMap((f) => FUNDING_SOURCES.filter((s) => s.id === f.source_id));
}

export function Setup() {
  const { data, actions } = useApp();
  const [form, setForm] = useState<SetupDraft>(() => actions.setupDraft());
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    void actions.requestPersistence();
  }, [actions]);

  // Every keystroke and step is kept, so an interruption never loses the form (SPEC §10).
  const update = (next: SetupDraft) => {
    setForm(next);
    void actions.updateSetupDraft(next);
  };
  const go = (step: SetupDraft['step'], patch: Partial<SetupDraft> = {}) => {
    setErrors({});
    update({ ...form, ...patch, step });
  };

  const role = form.role_id === null ? null : findRole(form.role_id);
  if (form.step === 'review' && role) {
    return <Review form={form} role={role} update={update} go={go} />;
  }
  if (form.step !== 'details') {
    return (
      <PickRole
        onPick={(picked) => {
          go('review', { role_id: picked.id, sources: prefilledRates(picked) });
        }}
        onBack={() => {
          go('details');
        }}
      />
    );
  }

  const next = () => {
    const found: Errors = {};
    if (!form.name.trim()) found['name'] = 'Enter your name.';
    if (!normalizeInitials(form.initials)) found['initials'] = 'Use 1 to 4 letters, like CC.';
    if (validNextNumber(form.next_number) === null) {
      found['next'] = 'Enter a whole number, like 1.';
    }
    setErrors(found);
    if (Object.keys(found).length === 0) go('role');
  };

  const initials = normalizeInitials(form.initials);
  const number = validNextNumber(form.next_number);
  const example =
    initials && number !== null
      ? `Your next number will be ${formatInvoiceNumber(initials, new Date().getFullYear(), number)}.`
      : 'Used in invoice and timesheet numbers, like CC-2026-001.';

  return (
    <Page
      key="details"
      title="Set up"
      footer={
        <button type="button" class="btn" onClick={next}>
          Next
        </button>
      }
    >
      <p class="lead">
        This goes on your invoices or timesheets. You can change it later in Settings.
      </p>
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
        hint="Already sent paper invoices or timesheets? Enter the next number, like 4. Otherwise leave 1."
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
      <StorageStatus status={data.persistence} setup />
    </Page>
  );
}

/** Pick your role: active roles by code and name (decision 0027). */
function PickRole({ onPick, onBack }: { onPick: (role: Role) => void; onBack: () => void }) {
  return (
    <Page key="role" title="Pick your role" back onBack={onBack}>
      <p class="lead">Pick the role on your agreement. Ask the office if you're not sure.</p>
      <ul class="role-list">
        {roleChoices(ROLES).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              class="card nav-row role-row"
              onClick={() => {
                onPick(r);
              }}
            >
              <span class="check-text">
                <span class="check-name">{r.code}</span>
                <span class="check-detail">{r.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Page>
  );
}

/** The role's sources, budget lines and tasks, with a rate per source (decisions 0027, 0030). */
function Review({
  form,
  role,
  update,
  go,
}: {
  form: SetupDraft;
  role: Role;
  update: (next: SetupDraft) => void;
  go: (step: SetupDraft['step'], patch?: Partial<SetupDraft>) => void;
}) {
  const { actions } = useApp();
  const [errors, setErrors] = useState<Errors>({});
  const sources = roleSources(role);
  const rateOf = (id: string) => form.sources[id]?.rate ?? '';

  const save = async () => {
    const found: Errors = {};
    const settings: SourceSettings[] = [];
    for (const f of role.funding) {
      const rate = parseDollars(rateOf(f.source_id));
      if (rate === null || rate < 1) {
        found[`rate-${f.source_id}`] = 'Enter your hourly rate, like 20.00.';
      } else {
        settings.push({ source_id: f.source_id, rate_cents: rate, nte_cents: f.nte_cents ?? null });
      }
    }
    const initials = normalizeInitials(form.initials);
    const next = validNextNumber(form.next_number);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!initials || next === null) {
      go('details');
      return;
    }
    await actions.finishSetup({
      profile: {
        name: form.name.trim(),
        initials,
        mailing_address: form.mailing_address.trim(),
        logo: null,
        role_id: role.id,
      },
      next_number: next,
      settings,
    });
  };

  return (
    <Page
      key="review"
      title="Your role"
      back
      onBack={() => {
        go('role');
      }}
      footer={
        <>
          <button type="button" class="btn" onClick={() => void save()}>
            This is my role
          </button>
          <button
            type="button"
            class="txt"
            onClick={() => {
              go('role');
            }}
          >
            Pick a different role
          </button>
        </>
      }
    >
      <p class="lead">
        <strong>{roleLabel(role)}</strong>. Check what you'll bill. Your role can't be changed after
        setup.
      </p>
      {role.funding.map((f) => {
        const source = sources.find((s) => s.id === f.source_id);
        if (!source) return null;
        const lines = f.budget_lines.flatMap((l) =>
          source.budget_lines.filter((b) => b.id === l.id),
        );
        const hint = ['From your agreement.', raiseHint(f)].filter(Boolean).join(' ');
        return (
          <section key={source.id} class="card review" aria-labelledby={`review-${source.id}`}>
            <h2 class="review-source" id={`review-${source.id}`}>
              {source.code}
              {source.name !== source.code && <span class="check-detail">{source.name}</span>}
            </h2>
            {lines.map((line) => (
              <div key={line.id} class="review-line">
                <h3 class="review-line-name">{lineName(line)}</h3>
                <ul class="review-tasks">
                  {taskChoices(role, source, line.id, []).all.map((t) => (
                    <li key={t.id}>{t.name}</li>
                  ))}
                </ul>
              </div>
            ))}
            <Field
              label={`Hourly rate for ${source.code}`}
              hint={hint}
              error={errors[`rate-${source.id}`]}
            >
              {(p) => (
                <input
                  {...p}
                  class="inp inp-money"
                  inputMode="decimal"
                  value={rateOf(source.id)}
                  onInput={(e) => {
                    update({
                      ...form,
                      sources: { ...form.sources, [source.id]: { rate: e.currentTarget.value } },
                    });
                  }}
                />
              )}
            </Field>
          </section>
        );
      })}
    </Page>
  );
}
