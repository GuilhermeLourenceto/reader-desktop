const test = require('node:test');
const assert = require('node:assert/strict');
const { readerProgress, pageAmplitude } = require('../src/readerPaging.cjs');

test('continuous scrolling reports progress and chapter edges', () => {
  const middle = readerProgress({
    scrollTop: 500,
    scrollHeight: 2000,
    clientHeight: 1000,
  });
  assert.equal(Math.round(middle.progress), 50);
  assert.equal(middle.atStart, false);
  assert.equal(middle.atEnd, false);

  const start = readerProgress({ scrollTop: 0, scrollHeight: 2000, clientHeight: 1000 });
  assert.equal(start.progress, 0);
  assert.equal(start.atStart, true);

  const end = readerProgress({
    scrollTop: 1000,
    scrollHeight: 2000,
    clientHeight: 1000,
  });
  assert.equal(end.progress, 100);
  assert.equal(end.atEnd, true);
});

test('paged mode measures the horizontal axis and never reports mid-page edges', () => {
  const second = readerProgress({
    paged: true,
    scrollTop: 0,
    scrollLeft: 880,
    scrollWidth: 4400,
    clientWidth: 880,
    scrollHeight: 900,
    clientHeight: 900,
  });
  assert.equal(second.progress, 25);
  assert.equal(second.atStart, false);
  assert.equal(second.atEnd, false);

  const last = readerProgress({
    paged: true,
    scrollLeft: 3520,
    scrollWidth: 4400,
    clientWidth: 880,
  });
  assert.equal(last.progress, 100);
  assert.equal(last.atEnd, true);
});

test('a chapter that fits the screen counts as fully read', () => {
  const fits = readerProgress({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 });
  assert.equal(fits.progress, 100);
  assert.equal(fits.atEnd, true);
  assert.equal(fits.atStart, true);
});

test('page amplitude stays within the configured range', () => {
  assert.equal(pageAmplitude(85), 0.85);
  assert.equal(pageAmplitude(30), 0.3);
  assert.equal(pageAmplitude(100), 1);
  assert.equal(pageAmplitude(10), 0.1);
  assert.equal(pageAmplitude(0), 0.1);
  assert.equal(pageAmplitude(-20), 0.1);
  assert.equal(pageAmplitude(9), 0.1);
  assert.equal(pageAmplitude('0'), 0.1);
  assert.equal(pageAmplitude(500), 1);
  assert.equal(pageAmplitude(undefined), 0.5);
  assert.equal(pageAmplitude('60'), 0.6);
});
