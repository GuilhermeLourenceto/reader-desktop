// Read-only diagnostics, never used by the application or backup logic.
// Electron's MemoryInfo values are in KiB, despite the privateBytes name.
// Linux PSS shares mapped pages proportionally and is not directly comparable
// to Windows privateBytes; keep both with explicit labels.
const fs = require('node:fs');

const mib = kib => Number.isFinite(kib)
  ? Math.round((kib / 1024) * 10) / 10
  : null;

function parseSmapsRollup(source) {
  const fields = {};
  for (const line of String(source).split(/\r?\n/)) {
    const match = /^([A-Za-z_]+):\s+(\d+)\s+kB$/.exec(line.trim());
    if (match) fields[match[1]] = Number(match[2]);
  }
  if (!Number.isFinite(fields.Pss)) return null;
  return {
    rssMiB: mib(fields.Rss),
    pssMiB: mib(fields.Pss),
    privateMiB: mib((fields.Private_Clean || 0) + (fields.Private_Dirty || 0)),
    sharedMiB: mib((fields.Shared_Clean || 0) + (fields.Shared_Dirty || 0)),
    swapMiB: mib(fields.Swap),
  };
}

function captureMemoryMetrics(metrics, {
  platform = process.platform,
  readFileSync = fs.readFileSync,
} = {}) {
  const processes = metrics.map(({ pid, type, memory }) => {
    const entry = {
      pid,
      type,
      workingSetMiB: mib(memory?.workingSetSize),
      privateWindowsMiB: mib(memory?.privateBytes),
    };
    if (platform === 'linux' && Number.isSafeInteger(pid)) {
      try {
        entry.linux = parseSmapsRollup(
          readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'),
        );
      } catch (error) {
        // A Linux runner may prohibit another process's smaps. Do not fail
        // functional tests or present missing PSS data as 0 MB.
        entry.linux = null;
        entry.linuxReadError = error.code || error.message;
      }
    }
    return entry;
  });
  const allPss = platform === 'linux' &&
    processes.length > 0 &&
    processes.every(item => item.linux && item.linux.pssMiB !== null);
  return {
    processes,
    // RSS sum double-counts shared mappings. This is diagnostic only.
    summedWorkingSetMiB: mib(
      metrics.reduce((sum, item) => sum + (item.memory?.workingSetSize || 0), 0),
    ),
    linuxSummedPssMiB: allPss
      ? Math.round(processes.reduce((sum, item) => sum + item.linux.pssMiB, 0) * 10) / 10
      : null,
  };
}

module.exports = { mib, parseSmapsRollup, captureMemoryMetrics };
