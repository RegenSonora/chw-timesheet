import { describe, expect, it } from 'vitest';
import { isIos, isStandalone, needsInstallGate } from '../../src/ui/platform';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

const media = (matches: boolean) => () => ({ matches });

describe('install gate (SPEC §2)', () => {
  it('detects iPhones and iPads, not Android or a Mac', () => {
    expect(isIos({ userAgent: IPHONE })).toBe(true);
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });

  it('knows when the app runs from the Home Screen', () => {
    expect(isStandalone({ userAgent: IPHONE, standalone: true })).toBe(true);
    expect(isStandalone({ userAgent: IPHONE, standalone: false }, media(false))).toBe(false);
    expect(isStandalone({ userAgent: ANDROID }, media(true))).toBe(true);
    expect(isStandalone({ userAgent: ANDROID })).toBe(false);
  });

  it('blocks iPhone Safari only', () => {
    expect(needsInstallGate({ userAgent: IPHONE, standalone: false }, media(false))).toBe(true);
    expect(needsInstallGate({ userAgent: IPHONE, standalone: true }, media(false))).toBe(false);
    expect(needsInstallGate({ userAgent: ANDROID }, media(false))).toBe(false);
    expect(needsInstallGate({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(
      false,
    );
  });
});
