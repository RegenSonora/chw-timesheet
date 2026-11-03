import { describe, expect, it } from 'vitest';
import { durationText, ENTRY_LOG_COLUMNS, entriesCsv } from '../../src/files/csv/entries-csv';
import {
  counts,
  makeEntry,
  regen,
  splitSampleEntries,
  uuid,
} from '../core/fixtures/wireframe-sample';
import golden from './golden/wireframe-entries.csv?raw';
import { csvText, invoiceFrom, sampleInvoice } from './helpers';

describe('entry log CSV (SPEC §7, decisions 0001 and 0024)', () => {
  it('matches the golden file for the wireframe sample', async () => {
    const invoice = await sampleInvoice();
    expect(csvText(entriesCsv(invoice)).replaceAll('\r\n', '\n')).toBe(
      golden.replaceAll('<FINGERPRINT>', invoice.fingerprint),
    );
  });

  it('has the 23 columns from the spec, in order, for every invoice', async () => {
    expect(ENTRY_LOG_COLUMNS).toHaveLength(23);
    const one = await invoiceFrom({
      entries: [
        makeEntry('2026-10-01', '09:00:00', '09:10:00', 'outreach', 'outreach-and-marketing'),
      ],
    });
    for (const inv of [await sampleInvoice(), one]) {
      expect(csvText(entriesCsv(inv)).split('\r\n')[0]).toBe(ENTRY_LOG_COLUMNS.join(','));
    }
  });

  it('writes one row per task share; billed hours add up, counts and notes are on part 1', async () => {
    const invoice = await invoiceFrom({ entries: splitSampleEntries });
    const rows = csvText(entriesCsv(invoice))
      .split('\r\n')
      .slice(1, -1)
      // RFC 4180 cells: quoted (may hold commas) or bare.
      .map((line) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) => m[1] ?? ''));
    const col = (name: (typeof ENTRY_LOG_COLUMNS)[number]) => ENTRY_LOG_COLUMNS.indexOf(name);
    const split = rows.filter((r) => r[col('entry_id')] === uuid(8));
    expect(
      split.map((r) =>
        [
          'part',
          'start',
          'stop',
          'raw_duration',
          'billed_hours',
          'task',
          'contacts',
          'referrals_given',
          'notes',
        ].map((c) => r[col(c as (typeof ENTRY_LOG_COLUMNS)[number])]),
      ),
    ).toEqual([
      [
        '1 of 2',
        '2026-10-30T09:12:04-07:00',
        '2026-10-30T10:37:10-07:00',
        '1:25:06',
        '1.00',
        'Client check in',
        '1',
        '1',
        'Library table',
      ],
      [
        '2 of 2',
        '2026-10-30T09:12:04-07:00',
        '2026-10-30T10:37:10-07:00',
        '1:25:06',
        '0.50',
        'Outreach',
        '',
        '',
        '',
      ],
    ]);
    expect(rows).toHaveLength(9);
    const sum = (c: (typeof ENTRY_LOG_COLUMNS)[number]) =>
      rows.reduce((total, r) => total + Number(r[col(c)] || 0), 0);
    expect(sum('billed_hours')).toBe(9.25);
    expect(sum('contacts')).toBe(invoice.counts_period.values['contacts']);
  });

  it('writes raw duration as h:mm:ss', () => {
    expect(durationText(5106)).toBe('1:25:06');
    expect(durationText(0)).toBe('0:00:00');
    expect(durationText(36_059)).toBe('10:00:59');
  });

  it('leaves core competency blank for Domestic support and joins other counts', async () => {
    const invoice = await invoiceFrom({
      source: regen,
      settings: { source_id: regen.id, rate_cents: 1800, nte_cents: null },
      entries: [
        makeEntry('2026-10-01', '22:30:00', '00:15:00', 'domestic-support', 'domestic-support', {
          source_id: regen.id,
          counts: counts({
            other: [
              { label: 'Food boxes', value: 2 },
              { label: 'Library cards', value: 1 },
            ],
          }),
          notes: '-not a formula, "really"',
        }),
      ],
      prior_invoices: [],
    });
    const line = csvText(entriesCsv(invoice)).split('\r\n')[1] ?? '';
    expect(line.startsWith('CC-2026-004,')).toBe(true);
    expect(line).toContain(',REGEN-GO,');
    expect(line).toContain(
      ',2026-10-01,2026-10-01T22:30:00-07:00,2026-10-02T00:15:00-07:00,1:45:00,1.75,',
    );
    expect(line).toContain(',Domestic support,,Domestic support,18.00,0,0,0,0,0,');
    expect(line).toContain(`,Food boxes=2; Library cards=1,"'-not a formula, ""really""",`);
  });
});
