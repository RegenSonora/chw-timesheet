// Invoice numbers <INITIALS>-<YYYY>-<NNN> and the shared counter (SPEC §6, decision 0005).
import type { InvoiceCounter } from './types';

const INITIALS = /^[A-Z]{1,4}$/;

/** Trimmed and upper-cased initials, or null when they aren't 1–4 letters A–Z. */
export function normalizeInitials(text: string): string | null {
  const initials = text.trim().toUpperCase();
  return INITIALS.test(initials) ? initials : null;
}

/** CC, 2026, 4 → "CC-2026-004". At least three digits; 1000 stays "1000". */
export function formatInvoiceNumber(initials: string, year: number, sequence: number): string {
  if (!INITIALS.test(initials)) throw new RangeError(`Bad initials: ${initials}`);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError(`Bad year: ${String(year)}`);
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError(`Bad sequence: ${String(sequence)}`);
  }
  return `${initials}-${String(year)}-${String(sequence).padStart(3, '0')}`;
}

/** A new phone's counter: the next invoice is number 1 unless setup changes it. */
export function newCounter(): InvoiceCounter {
  return { next: 1, locked: false };
}

/** Set the next number at setup (decision 0005). Refused once an invoice exists. */
export function setNextNumber(
  counter: InvoiceCounter,
  next: number,
): { ok: true; counter: InvoiceCounter } | { ok: false; reason: 'locked' | 'invalid' } {
  if (counter.locked) return { ok: false, reason: 'locked' };
  if (!Number.isSafeInteger(next) || next < 1) return { ok: false, reason: 'invalid' };
  return { ok: true, counter: { next, locked: false } };
}

/** Use the next number for an invoice. The counter only moves forward and is then locked. */
export function takeNumber(counter: InvoiceCounter): { sequence: number; counter: InvoiceCounter } {
  if (!Number.isSafeInteger(counter.next) || counter.next < 1) {
    throw new RangeError(`Bad counter: ${String(counter.next)}`);
  }
  return { sequence: counter.next, counter: { next: counter.next + 1, locked: true } };
}
