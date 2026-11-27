// Two real Electron processes, with one disposable profile and no real user data.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const marker = 'reset-pending.json';
const sha = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

if (!process.versions.electron) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-reset-electron-'));
  try {
    const profile = path.join(root, 'profile');
    const archives = path.join(root, 'archives');
    fs.mkdirSync(profile);
    fs.mkdirSync(archives);
    fs.mkdirSync(path.join(profile, 'content'));
    const bytes = Buffer.from('<p>offline private content</p>');
    const hash = createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(profile, 'content', hash), bytes);
    const { emptyState } = require('../dist/backup.cjs');
    const state = {
      ...emptyState(),
      novels: [{ id: 1, pluginId: 'local', name: 'Private novel', path: '/novel', inLibrary: true,
        chapters: [{ id: 11, novelId: 1, path: '/chapter', name: 'Chapter', unread: true, progress: 40, isDownloaded: true }] }],
      settings: { desktopOnboardingCompleted: true, desktopInterfaceLanguage: 'pt-BR',
        desktopBackupFrequency: 'off', desktopFontSize: 28 },
      files: { 'Novels/local/1/11/index.html': '@file:' + hash },
    };
    for (const name of ['library.json', 'library.json.bak', 'before-restore.json'])
      fs.writeFileSync(path.join(profile, name), JSON.stringify(state));
    fs.writeFileSync(path.join(profile, 'automatic-backup-status.json'), '{}');
    const zip = Buffer.from('504b0506' + '00'.repeat(18), 'hex');
    const backups = [path.join(profile, 'manual.ZIP'), path.join(archives, 'manual.zip')];
    for (let i = 0; i < 5; i++) backups.push(path.join(archives, 'ReaderDesktop-auto-2026-11-0' + (i + 1) + 'T00-00-00-000Z.zip'));
    backups.forEach(filename => fs.writeFileSync(filename, zip));
    const hashes = backups.map(sha);
    const electron = require('electron');
    for (const phase of ['request', 'verify']) {
      const child = spawnSync(electron, [__filename], {
        env: { ...process.env, READER_RESET_PROFILE: profile, READER_RESET_PHASE: phase },
        timeout: 90000, stdio: 'inherit',
      });
      if (child.error) throw child.error;
      assert.equal(child.status, 0, phase);
      assert.equal(fs.existsSync(path.join(profile, marker)), phase === 'request');
      assert.deepEqual(backups.map(sha), hashes);
    }
    const after = JSON.parse(fs.readFileSync(path.join(profile, 'library.json'), 'utf8'));
    assert.equal(after.settings.desktopOnboardingCompleted, false);
    assert.deepEqual(after.novels, []);
    assert.deepEqual(after.files, {});
    assert.equal(fs.existsSync(path.join(profile, 'content', hash)), false);
    for (const name of ['library.json.bak', 'before-restore.json', 'automatic-backup-status.json'])
      assert.equal(fs.existsSync(path.join(profile, name)), false, name);
    console.log('PASS: reset across processes; first run, cookies, local storage, files and ZIP hashes verified.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
} else {
  const { app, dialog, session } = require('electron');
  const root = process.env.READER_RESET_PROFILE;
  const phase = process.env.READER_RESET_PHASE;
  if (!root || !phase || !path.basename(path.dirname(root)).startsWith('reader-reset-electron-'))
    throw new Error('Disposable test profile required');
  app.setPath('userData', root);
  app.setPath('sessionData', root);
  app.commandLine.appendSwitch('disable-gpu');
  const choices = [0, 1, 2];
  dialog.showMessageBox = async (_win, options) => {
    if (options?.message !== 'Apagar todos os dados?') throw Error('Unexpected dialog: ' + options?.message);
    return { response: choices.shift() };
  };
  dialog.showErrorBox = (title, detail) => { console.error(title, detail); app.exit(1); };
  // The parent starts the next real process itself, rather than spawning
  // another copy of the test harness using app.relaunch.
  app.relaunch = () => {};
  const deadline = setTimeout(() => { console.error('Reset smoke timeout'); app.exit(1); }, 75000);
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.webContents.once('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let i = 0; i < 300; i++) {
          if (await execute(code)) return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw Error('Timed out: ' + code);
      };
      const click = label => execute('(()=>{const b=Array.from(document.querySelectorAll("button")).find(item=>(item.getAttribute("aria-label")||item.textContent.trim())===' + JSON.stringify(label) + ');if(!b)throw Error("Missing button");b.click();return true})()');
      const cookies = session.fromPartition('persist:lnreader-source-removed').cookies;
      const url = 'https://reset-fixture.example/';
      try {
        if (phase === 'request') {
          await wait("document.querySelector('nav') && document.documentElement.lang==='pt-BR'");
          await cookies.set({ url, name: 'private', value: 'old-session', expirationDate: Date.now()/1000 + 3600 });
          await cookies.flushStore();
          await execute("localStorage.setItem('reset-private-test','old'); true");
          await click('Mais');
          await click('Configurações');
          await click('Apagar todos os dados');
          await wait("!document.querySelector('button[aria-label=\"Apagar todos os dados\"]').disabled");
          assert.equal(fs.existsSync(path.join(root, marker)), false);
          await click('Apagar todos os dados');
          await wait("!!document.querySelector('[data-settings-page=backup]')");
          assert.equal(fs.existsSync(path.join(root, marker)), false);
          await click('Voltar nas configurações');
          await click('Configurações');
          await click('Apagar todos os dados');
          // Main exits after a durable marker has been written.
        } else {
          await wait("!!document.querySelector('.first-run[data-step=\"1\"]')");
          assert.equal(await execute("localStorage.getItem('reset-private-test')"), null);
          assert.deepEqual(await cookies.get({ url }), []);
          assert.equal(await execute("window.desktop.load().then(s => s.novels.length)"), 0);
          clearTimeout(deadline);
          app.exit(0);
        }
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
  require('../dist/main.cjs');
}
