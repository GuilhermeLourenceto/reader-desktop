// The reader controls store seconds; existing profiles keep the old 2.6s delay.
const READER_HIDE_DELAY_DEFAULT = 2.6;
const READER_HIDE_DELAY_MIN = 1;
const READER_HIDE_DELAY_MAX = 10;

function readerHideDelaySeconds(value) {
  const seconds = typeof value === 'number' && Number.isFinite(value)
    ? value
    : READER_HIDE_DELAY_DEFAULT;
  return Math.min(READER_HIDE_DELAY_MAX, Math.max(READER_HIDE_DELAY_MIN, seconds));
}

function readerHideDelayMilliseconds(value) {
  return Math.round(readerHideDelaySeconds(value) * 1000);
}

module.exports = {
  READER_HIDE_DELAY_DEFAULT,
  READER_HIDE_DELAY_MIN,
  READER_HIDE_DELAY_MAX,
  readerHideDelaySeconds,
  readerHideDelayMilliseconds,
};
