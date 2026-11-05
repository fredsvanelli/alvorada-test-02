import { overlaps, parseInterval } from './booking-rules.js';

describe('parseInterval', () => {
  it.each([
    { start: 10, end: 20, want: { start: 10, end: 20 } },
    { start: '10', end: '20', want: { start: 10, end: 20 } },
    { start: '007', end: 20, want: { start: 7, end: 20 } },
    // Compared as strings, "9" < "10" is false: catches a missing Number().
    { start: '9', end: '10', want: { start: 9, end: 10 } },
    { start: 0, end: 1, want: { start: 0, end: 1 } },
    { start: 0, end: 2147483647, want: { start: 0, end: 2147483647 } },
    { start: '0', end: '2147483647', want: { start: 0, end: 2147483647 } },
  ])('accepts ($start, $end)', ({ start, end, want }) => {
    expect(parseInterval(start, end)).toStrictEqual(want);
  });

  // Each bad value is tried as start (with end 100) and as end (with start 0),
  // so a check that only looks at one side fails.
  const badTimes: unknown[] = [
    undefined,
    null,
    true,
    {},
    Number.NaN,
    Number.POSITIVE_INFINITY,
    10.5,
    -1,
    2147483648,
    '',
    ' ',
    '-5',
    ' 10 ',
    '1e3',
    '0x10',
    '10.0',
    '+10',
    'abc',
    '2147483648',
  ];

  it.each(badTimes)('rejects %j as start', (value) => {
    expect(parseInterval(value, 100)).toBeNull();
  });

  it.each(badTimes)('rejects %j as end', (value) => {
    expect(parseInterval(0, value)).toBeNull();
  });

  it.each([
    { start: 20, end: 20 },
    { start: '20', end: '20' },
    { start: 30, end: 20 },
    { start: '10', end: '9' },
  ])('rejects start >= end ($start, $end)', ({ start, end }) => {
    expect(parseInterval(start, end)).toBeNull();
  });
});

describe('overlaps', () => {
  it.each([
    {
      name: 'touching: a ends where b starts',
      a: [10, 20],
      b: [20, 30],
      want: false,
    },
    { name: 'one-unit overlap', a: [10, 20], b: [19, 21], want: true },
    { name: 'containment', a: [10, 30], b: [15, 20], want: true },
    { name: 'identical', a: [10, 20], b: [10, 20], want: true },
    { name: 'disjoint', a: [10, 20], b: [30, 40], want: false },
  ])('$name: [$a) vs [$b) is $want in both orders', ({ a, b, want }) => {
    const ia = { start: a[0], end: a[1] };
    const ib = { start: b[0], end: b[1] };
    expect(overlaps(ia, ib)).toBe(want);
    expect(overlaps(ib, ia)).toBe(want);
  });
});
