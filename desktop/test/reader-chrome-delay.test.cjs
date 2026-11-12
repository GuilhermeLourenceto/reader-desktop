const { test } = require('node:test');
const assert = require('node:assert/strict');
const { READER_HIDE_DELAY_DEFAULT, READER_HIDE_DELAY_MIN, READER_HIDE_DELAY_MAX, readerHideDelaySeconds, readerHideDelayMilliseconds } = require('../src/readerChromeDelay.cjs');

test('existing profiles continue using the original 2.6 second delay', () => {
  assert.equal(READER_HIDE_DELAY_DEFAULT, 2.6);
  assert.equal(readerHideDelaySeconds(undefined), 2.6);
  assert.equal(readerHideDelayMilliseconds(undefined), 2600);
});

test('the new reader auto-hide control spans 1 to 10 seconds', () => {
  assert.equal(READER_HIDE_DELAY_MIN, 1);
  assert.equal(READER_HIDE_DELAY_MAX, 10);
  for (const [s, ms] of [[1, 1000], [1.2, 1200], [2.6, 2600], [4.2, 4200], [5, 5000], [10, 10000]])
    assert.equal(readerHideDelayMilliseconds(s), ms);
});

test('out-of-range or malformed values do not create zero/infinite timers', () => {
  for (const value of [0, -5, -Infinity]) assert.equal(readerHideDelayMilliseconds(value), 1000);
  for (const value of [15, 1000]) assert.equal(readerHideDelayMilliseconds(value), 10000);
  for (const value of [NaN, Infinity, null, '2.6', {}]) assert.equal(readerHideDelayMilliseconds(value), 2600);
});
