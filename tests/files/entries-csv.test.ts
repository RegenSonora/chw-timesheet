import { describe, expect, it } from 'vitest';
import { durationText, ENTRY_LOG_COLUMNS, entriesCsv } from '../../src/files/csv/entries-csv';
import { counts, makeEntry, regen } from '../core/fixtures/wireframe-sample';
import golden from './golden/wireframe-entries.csv?raw';
import { csvText, invoiceFrom, sampleInvoice } from './helpers';

describe('entry log CSV (SPEC §7, decision 0001)', () => {
  it('matches the golden file for the wireframe sample', async () => {
    const invoice = await sampleInvoice();
    expect(csvText(entriesCsv(invoice)).replaceAll('\r\n', '\n')).toBe(
      golden.replaceAll('<FINGERPRINT>', invoice.fingerprint),
    );
  });

  it('has the 22 columns from the spec, in order, for every invoice', async () => {
    expect(ENTRY_LOG_COLUMNS).toHaveLength(22);
    const one = await invoiceFrom({
      entries: [
        makeEntry('2026-10-01', '09:00:00', '09:10:00', 'outreach', 'outreach-and-marketing'),
      ],
    });
    for (const inv of [await sampleInvoice(), one]) {
      expect(csvText(entriesCsv(inv)).split('\r\n')[0]).toBe(ENTRY_LOG_COLUMNS.join(','));
    }
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
