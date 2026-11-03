const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { parseBackup } = require('../dist/backup.cjs');
const { DiskFiles } = require('../src/storage.cjs');

const filename = process.argv
  .find(value => value.startsWith('--backup='))
  ?.slice(9);
if (!filename) throw new Error('Informe --backup=caminho/do/backup.zip');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const originalDigest = digest(fs.readFileSync(filename));
const expected = parseBackup(fs.readFileSync(filename)).state;
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'lnreader-real-backup-'),
);
const exported = path.join(directory, 'roundtrip.zip');
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
dialog.showOpenDialog = async () => ({
  canceled: false,
  filePaths: [filename],
});
dialog.showMessageBox = async () => ({ response: 1 });
dialog.showSaveDialog = async () => ({ canceled: false, filePath: exported });
const timeout = setTimeout(() => app.exit(1), 180000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const wait = async code => {
      for (let index = 0; index < 1200; index++) {
        if (await execute(code)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`Timeout: ${code}`);
    };
    try {
      await wait(
        "Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Restore backup')",
      );
      await execute(
        "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Restore backup').click()",
      );
      await wait(
        "document.querySelector('.notice') && !document.querySelector('.busy')",
      );
      const restored = await execute(
        'window.desktop.load({metadataOnly:true})',
      );
      assert.deepEqual(restored.settings, expected.settings);
      assert.deepEqual(restored.categories, expected.categories);
      assert.deepEqual(restored.plugins, expected.plugins);
      const novels = expected.novels.map(novel => ({
        ...novel,
        chapters: novel.chapters.map(chapter => ({
          ...chapter,
          isDownloaded: Boolean(
            chapter.isDownloaded &&
              Object.hasOwn(
                expected.files,
                `Novels/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`,
              ),
          ),
        })),
      }));
      assert.deepEqual(restored.novels, novels);
      assert.equal(
        await execute("document.querySelectorAll('.book').length"),
        expected.novels.filter(novel => novel.inLibrary).length,
      );
      const saved = JSON.parse(
        fs.readFileSync(path.join(directory, 'library.json'), 'utf8'),
      );
      const files = new DiskFiles(path.join(directory, 'content'));
      assert.equal(
        Object.keys(saved.files).length,
        Object.keys(expected.files).length,
      );
      for (const [name, value] of Object.entries(expected.files)) {
        assert.equal(
          digest(files.read(saved.files[name])),
          digest(Buffer.from(value, 'base64')),
          `Arquivo alterado: ${name}`,
        );
      }
      assert.ok(fs.existsSync(path.join(directory, 'before-restore.json')));
      const result = await execute(
        'window.desktop.load({metadataOnly:true}).then(state=>window.desktop.backup(state))',
      );
      assert.equal(result.missingCount, 0);
      const roundtrip = parseBackup(fs.readFileSync(exported)).state;
      assert.deepEqual(roundtrip.novels, novels);
      assert.deepEqual(roundtrip.settings, expected.settings);
      assert.deepEqual(roundtrip.categories, expected.categories);
      assert.deepEqual(roundtrip.plugins, expected.plugins);
      assert.deepEqual(roundtrip.files, expected.files);
      assert.equal(digest(fs.readFileSync(filename)), originalDigest);
      console.log(
        JSON.stringify({
          result:
            'PASS: real Android ZIP restored through UI and packaged backup worker; all files verified; desktop export reimported without loss; original ZIP unchanged',
          novels: novels.length,
          chapters: novels.reduce(
            (sum, novel) => sum + novel.chapters.length,
            0,
          ),
          read: novels.reduce(
            (sum, novel) =>
              sum +
              novel.chapters.filter(chapter => chapter.unread === false).length,
            0,
          ),
          downloaded: novels.reduce(
            (sum, novel) =>
              sum +
              novel.chapters.filter(chapter => chapter.isDownloaded).length,
            0,
          ),
          files: Object.keys(expected.files).length,
          plugins: expected.plugins.length,
          settings: Object.keys(expected.settings).length,
        }),
      );
      clearTimeout(timeout);
      win.destroy();
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      win.destroy();
      app.exit(1);
    }
  });
});
require(process.argv.includes('--packaged')
  ? '../release/win-unpacked/resources/app.asar/dist/main.cjs'
  : '../dist/main.cjs');
