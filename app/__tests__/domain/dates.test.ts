import {
  describeExpiration,
  expiryStatus,
  formatAddedDate,
  formatPreviewDate,
  isPast,
  todayIso,
} from '../../src/features/inventory/domain/dates';

// jest.setup.js pins TZ to America/Los_Angeles (UTC-7/-8).

const TODAY = '2026-11-05';
/** Noon on Nov 5, 2026, local time. */
const NOW = new Date(2026, 10, 5, 12, 0);

describe('todayIso', () => {
  it('uses the local date, not the UTC date', () => {
    // 23:30 local on Nov 5 is already Nov 6 in UTC.
    expect(todayIso(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05');
    expect(todayIso(new Date(2026, 0, 9, 0, 5))).toBe('2026-01-09');
  });
});

describe('formatPreviewDate', () => {
  it('shows the stored day, without a UTC off-by-one', () => {
    expect(formatPreviewDate('2027-10-27')).toBe('Wed, Oct 27, 2027');
    expect(formatPreviewDate('2026-01-01')).toBe('Thu, Jan 1, 2026');
  });
});

describe('expiryStatus', () => {
  it.each([
    ['2026-11-04', 'expired'], // yesterday
    ['2026-11-05', 'soon'], // today
    ['2026-11-12', 'soon'], // +7 days
    ['2026-11-13', 'later'], // +8 days
  ])('%s is %s', (date, status) => {
    expect(expiryStatus(date, TODAY)).toBe(status);
  });

  it('counts days correctly across a DST change', () => {
    // US daylight saving time ends on Nov 1, 2026.
    expect(expiryStatus('2026-11-07', '2026-10-31')).toBe('soon');
    expect(expiryStatus('2026-11-08', '2026-10-31')).toBe('later');
  });

  it('isPast is true only before today', () => {
    expect(isPast('2026-11-04', TODAY)).toBe(true);
    expect(isPast('2026-11-05', TODAY)).toBe(false);
  });
});

describe('describeExpiration', () => {
  it('describes today, past and future dates', () => {
    expect(describeExpiration('2026-11-05', TODAY)).toEqual({
      text: 'Expires today',
      accessibilityText: 'Expires today',
      status: 'soon',
    });
    expect(describeExpiration('2026-11-09', TODAY)).toEqual({
      text: 'Expires Nov 9',
      accessibilityText: 'Expires November 9, 2026',
      status: 'soon',
    });
    expect(describeExpiration('2026-11-01', TODAY)).toMatchObject({
      text: 'Expired Nov 1',
      status: 'expired',
    });
  });

  it('includes the year only when it is not the current year', () => {
    expect(describeExpiration('2027-10-27', TODAY)).toMatchObject({
      text: 'Expires Oct 27, 2027',
      accessibilityText: 'Expires October 27, 2027',
      status: 'later',
    });
    expect(describeExpiration('2025-10-01', TODAY).text).toBe(
      'Expired Oct 1, 2025',
    );
  });
});

describe('formatAddedDate', () => {
  it('says today, yesterday, a short date, or a date with the year', () => {
    expect(formatAddedDate('2026-11-05T15:00:00.000Z', NOW).text).toBe(
      'Added today',
    );
    expect(formatAddedDate('2026-11-04T18:00:00.000Z', NOW).text).toBe(
      'Added yesterday',
    );
    expect(formatAddedDate('2026-10-20T18:00:00.000Z', NOW).text).toBe(
      'Added Oct 20',
    );
    expect(formatAddedDate('2025-03-02T18:00:00.000Z', NOW).text).toBe(
      'Added Mar 2, 2025',
    );
  });

  it('uses the local day of the UTC timestamp', () => {
    // 07:30 UTC on Nov 5 is 23:30 on Nov 4 in Los Angeles.
    expect(formatAddedDate('2026-11-05T07:30:00.000Z', NOW).text).toBe(
      'Added yesterday',
    );
  });

  it('gives screen readers the full date', () => {
    expect(
      formatAddedDate('2026-10-20T18:00:00.000Z', NOW).accessibilityText,
    ).toBe('Added October 20, 2026');
  });
});
