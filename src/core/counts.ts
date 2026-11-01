// Summing counts across entries and invoices (SPEC §5, §6).
import type { Counts, OtherCount } from './types';

/** The five fixed counts (SPEC §5), in the order screens and invoice files list them. */
export const COUNT_FIELDS: readonly {
  key: Exclude<keyof Counts, 'other'>;
  label: string;
  noun: string;
}[] = [
  { key: 'contacts', label: 'Contacts', noun: 'contacts' },
  { key: 'referrals_given', label: 'Referrals given', noun: 'referrals given' },
  { key: 'referral_followups', label: 'Referral follow-ups', noun: 'referral follow-ups' },
  { key: 'rides_provided', label: 'Rides provided', noun: 'rides provided' },
  {
    key: 'applications_completed',
    label: 'Applications completed',
    noun: 'applications completed',
  },
];

export function emptyCounts(): Counts {
  return {
    contacts: 0,
    referrals_given: 0,
    referral_followups: 0,
    rides_provided: 0,
    applications_completed: 0,
    other: [],
  };
}

/**
 * Add counts together. Custom counts with the same label (trimmed, any letter case) are
 * merged under the first spelling seen; custom counts that total 0 are left out.
 */
export function sumCounts(list: readonly Counts[]): Counts {
  const total = emptyCounts();
  const other = new Map<string, OtherCount>();
  for (const c of list) {
    total.contacts += c.contacts;
    total.referrals_given += c.referrals_given;
    total.referral_followups += c.referral_followups;
    total.rides_provided += c.rides_provided;
    total.applications_completed += c.applications_completed;
    for (const { label, value } of c.other) {
      const trimmed = label.trim();
      const key = trimmed.toLowerCase();
      const seen = other.get(key);
      if (seen) seen.value += value;
      else other.set(key, { label: trimmed, value });
    }
  }
  total.other = [...other.values()].filter((o) => o.value !== 0);
  return total;
}
