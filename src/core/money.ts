// Money rules (SPEC §6): integer cents and quarter-hours, no floats.

function assertCount(name: string, n: number): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`${name} must be a non-negative integer: ${String(n)}`);
  }
}

/** Line amount = quarter-hours × rate in cents ÷ 4, rounded half up to the cent. */
export function lineAmountCents(quarters: number, rateCents: number): number {
  assertCount('quarters', quarters);
  assertCount('rateCents', rateCents);
  const product = quarters * rateCents;
  if (!Number.isSafeInteger(product + 2)) throw new RangeError('Amount too large');
  return Math.floor((product + 2) / 4);
}

/** Sum of integer cents; the invoice total is the sum of rounded line amounts. */
export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    if (!Number.isSafeInteger(v)) throw new RangeError(`Not integer cents: ${String(v)}`);
    total += v;
    if (!Number.isSafeInteger(total)) throw new RangeError('Total too large');
  }
  return total;
}

const DOLLARS = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** Parse a typed dollar amount ("$22.37", "5,000", "20.5") to cents. Null when it isn't one. */
export function parseDollars(text: string): number | null {
  const m = DOLLARS.exec(text.trim());
  if (!m) return null;
  const [, wholeText = '', fracText = ''] = m;
  const whole = Number(wholeText.replaceAll(',', ''));
  const cents = Number(fracText.padEnd(2, '0'));
  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 2000 → "20.00"; -6500 → "-65.00". For CSV files (SPEC §7). */
export function formatCentsPlain(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Not integer cents: ${String(cents)}`);
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${String(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
}

/** 500000 → "$5,000.00"; -6500 → "-$65.00". ASCII only, so it prints in any PDF font. */
export function formatDollars(cents: number): string {
  const plain = formatCentsPlain(Math.abs(cents));
  const [whole, frac] = plain.split('.') as [string, string];
  return `${cents < 0 ? '-' : ''}$${groupThousands(whole)}.${frac}`;
}

/** 6 → "1.50": hours with two decimals (SPEC §7). */
export function formatQuarters(quarters: number): string {
  assertCount('quarters', quarters);
  return `${String(Math.floor(quarters / 4))}.${String((quarters % 4) * 25).padStart(2, '0')}`;
}
