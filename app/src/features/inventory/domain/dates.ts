/**
 * Date helpers. Expiration dates are calendar days (`YYYY-MM-DD`) with no timezone, so
 * they are always built from their components in local time: `new Date('2027-10-27')`
 * would parse as UTC midnight and show the previous day west of Greenwich. Created dates
 * are UTC instants and are converted to the device's local day.
 */

// The UI text is English-only for now (as is Duckling's date parsing).
const LOCALE = 'en-US';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Items expiring within this many days (inclusive) are flagged as expiring soon. */
export const EXPIRING_SOON_DAYS = 7;

export type ExpiryStatus = 'expired' | 'soon' | 'later';

interface Ymd {
  year: number;
  month: number;
  day: number;
}

function parseIso(iso: string): Ymd {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function localYmd(date: Date): Ymd {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function toLocalDate({ year, month, day }: Ymd): Date {
  return new Date(year, month - 1, day);
}

/** Whole days from `from` to `to`; DST-safe because it counts in UTC. */
function daysBetween(from: Ymd, to: Ymd): number {
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) -
      Date.UTC(from.year, from.month - 1, from.day)) /
      DAY_MS,
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local date as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const { year, month, day } = localYmd(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "Oct 27" in the current year, otherwise "Oct 27, 2027". */
function formatShort(date: Ymd, todayYear: number): string {
  return toLocalDate(date).toLocaleDateString(LOCALE, {
    month: 'short',
    day: 'numeric',
    ...(date.year === todayYear ? {} : { year: 'numeric' }),
  });
}

/** "October 27, 2027", for screen readers. */
function formatLong(date: Ymd): string {
  return toLocalDate(date).toLocaleDateString(LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** The calendar day `iso` as a local Date at midnight (for date pickers). */
export function isoToLocalDate(iso: string): Date {
  return toLocalDate(parseIso(iso));
}

/** "Wed, Oct 27, 2027". */
export function formatPreviewDate(iso: string): string {
  return toLocalDate(parseIso(iso)).toLocaleDateString(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function expiryStatus(iso: string, today: string): ExpiryStatus {
  const days = daysBetween(parseIso(today), parseIso(iso));
  if (days < 0) {
    return 'expired';
  }
  return days <= EXPIRING_SOON_DAYS ? 'soon' : 'later';
}

export function isPast(iso: string, today: string): boolean {
  return daysBetween(parseIso(today), parseIso(iso)) < 0;
}

export interface DateLabel {
  text: string;
  /** Full wording for screen readers. */
  accessibilityText: string;
}

/** "Expires today", "Expires Nov 9", "Expired Oct 1, 2025". */
export function describeExpiration(
  iso: string,
  today: string,
): DateLabel & { status: ExpiryStatus } {
  const date = parseIso(iso);
  const status = expiryStatus(iso, today);
  if (daysBetween(parseIso(today), date) === 0) {
    return {
      text: 'Expires today',
      accessibilityText: 'Expires today',
      status,
    };
  }
  const verb = status === 'expired' ? 'Expired' : 'Expires';
  return {
    text: `${verb} ${formatShort(date, parseIso(today).year)}`,
    accessibilityText: `${verb} ${formatLong(date)}`,
    status,
  };
}

/** "Added today", "Added yesterday", "Added Oct 20", "Added Mar 2, 2025". */
export function formatAddedDate(createdDate: string, now: Date): DateLabel {
  const created = localYmd(new Date(createdDate));
  const today = localYmd(now);
  const accessibilityText = `Added ${formatLong(created)}`;
  switch (daysBetween(created, today)) {
    case 0:
      return { text: 'Added today', accessibilityText };
    case 1:
      return { text: 'Added yesterday', accessibilityText };
    default:
      return {
        text: `Added ${formatShort(created, today.year)}`,
        accessibilityText,
      };
  }
}
