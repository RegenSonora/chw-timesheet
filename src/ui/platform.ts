// Install gate checks (SPEC §2). The navigator and matchMedia are passed in so tests can stub them.

export interface NavigatorLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  /** iPhone Safari only: true when opened from the Home Screen. */
  standalone?: boolean;
}

type MatchMedia = (query: string) => { matches: boolean };

/** iPhone, iPod or iPad, including iPads that report a desktop Mac. */
export function isIos(nav: NavigatorLike): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** Opened as an installed Home Screen app rather than in the browser. */
export function isStandalone(nav: NavigatorLike, matchMedia?: MatchMedia): boolean {
  if (nav.standalone === true) return true;
  return matchMedia?.('(display-mode: standalone)').matches ?? false;
}

/**
 * iPhone Safari and the Home Screen app keep separate storage, so setup is blocked until the
 * app is opened from the Home Screen. Android is not blocked.
 */
export function needsInstallGate(nav: NavigatorLike, matchMedia?: MatchMedia): boolean {
  return isIos(nav) && !isStandalone(nav, matchMedia);
}
