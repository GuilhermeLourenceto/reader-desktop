const test = require('node:test');
const assert = require('node:assert/strict');
const { mib, parseSmapsRollup, captureMemoryMetrics } = require('./linux-memory-metrics.cjs');

test('Electron metrics are KiB and are converted to MiB before labeling', () => {
  assert.equal(mib(1024), 1);
  assert.equal(mib(1536), 1.5);
  assert.equal(mib(undefined), null);
});

test('Linux smaps measures proportional and private memory separately', () => {
  const sample = [
    '0040-0080 r--p 00000000 00:00 0',
    'Rss:              8192 kB',
    'Pss:              4096 kB',
    'Shared_Clean:     4096 kB',
    'Shared_Dirty:        0 kB',
    'Private_Clean:    1024 kB',
    'Private_Dirty:    3072 kB',
    'Swap:               0 kB',
  ].join('\n');
  assert.deepEqual(parseSmapsRollup(sample), {
    rssMiB: 8, pssMiB: 4, privateMiB: 4, sharedMiB: 4, swapMiB: 0,
  });
  assert.equal(parseSmapsRollup('Rss: 1234 kB'), null);
});

test('Linux PSS unavailable stays null rather than false zero', () => {
  const result = captureMemoryMetrics(
    [{ pid: 42, type: 'Browser', memory: { workingSetSize: 102400 } }],
    { platform: 'linux', readFileSync: () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      throw error;
    } },
  );
  assert.equal(result.summedWorkingSetMiB, 100);
  assert.equal(result.linuxSummedPssMiB, null);
  assert.equal(result.processes[0].linuxReadError, 'EACCES');
});

test('Windows private-memory diagnostics remain labeled separately', () => {
  const result = captureMemoryMetrics(
    [{ pid: 12, type: 'Tab', memory: { workingSetSize: 204800, privateBytes: 102400 } }],
    { platform: 'win32' },
  );
  assert.equal(result.processes[0].workingSetMiB, 200);
  assert.equal(result.processes[0].privateWindowsMiB, 100);
});
