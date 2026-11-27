// Real Electron test with disposable data. Exercises the user-facing error,
// report export, private logs, and diagnostics layout at compact/wide sizes.
const { app, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-diagnostics-ui-'));
const invalidZip = path.join(root, 'invalid.zip');
const report = path.join(root, 'diagnostics-report.txt');
fs.writeFileSync(invalidZip, 'This is not a ZIP archive');
fs.writeFileSync(path.join(root, 'library.json'), JSON.stringify({
  ...emptyState(),
  settings: { desktopInterfaceLanguage: 'pt-BR', desktopOnboardingCompleted: true },
}));
app.setPath('userData', root);
app.commandLine.appendSwitch('disable-gpu');
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [invalidZip] });
dialog.showSaveDialog = async () => ({ canceled: false, filePath: report });

let completed = false;
const deadline = setTimeout(() => {
  console.error('Diagnostics UI smoke timed out');
  app.exit(1);
}, 75000);

app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const execute = async source => {
      const result = await win.webContents.executeJavaScript(
        `(async () => { try { return await (${source}); } catch (error) { return { __error: String(error) }; } })()`,
        true,
      );
      if (result?.__error) throw new Error(source + ': ' + result.__error);
      return result;
    };
    const wait = async condition => {
      for (let i = 0; i < 300; i++) {
        if (await execute(condition)) return;
        await new Promise(resolve => setTimeout(resolve, 70));
      }
      throw new Error('Timed out waiting for ' + condition);
    };
    const click = label => execute(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(item =>
      (item.getAttribute('aria-label')||item.textContent.trim())===${JSON.stringify(label)});
      if(!b)throw Error('Button not found: '+${JSON.stringify(label)});
      b.click();return true})()`);
    try {
      await wait("document.querySelector('nav') && document.documentElement.lang==='pt-BR'");
      await click('Mais');
      await wait("document.querySelector('[data-settings-page=more]')");
      await click('Backups');
      await wait("document.querySelector('[data-settings-page=backup]')");
      await click('Restaurar backup');
      await wait("document.querySelector('.notice[role=alert]') && document.querySelector('.notice-actions button')");
      const text = await execute("document.querySelector('.notice-message').textContent");
      assert.ok(text.length < 130, 'user error should be short');
      assert.ok(/backup|não foi possível/i.test(text), 'error should be understandable');
      assert.equal(text.includes(invalidZip), false, 'private file path must not be visible');
      assert.equal(await execute("Array.from(document.querySelectorAll('.notice-actions button')).some(b=>b.textContent.includes('Salvar relatório do erro'))"), true);
      await execute("window.desktop.diagnostics.report({code:'DIAG-PRIVACY-TEST',level:'error',operation:'interface',message:'Failed at /home/hidden/secret.txt token=unsafe123 https://secret.example/test'})");
      await click('Salvar relatório do erro');
      await wait("document.querySelector('.notice-message')?.textContent.includes('Relatório salvo.')");
      assert.equal(fs.existsSync(report), true);
      const file = fs.readFileSync(report, 'utf8');
      assert.ok(file.includes('DIAG-PRIVACY-TEST'));
      for (const secret of ['/home/hidden', 'unsafe123', 'https://secret.example'])
        assert.equal(file.includes(secret), false, 'report must redact ' + secret);
      await click('Voltar nas configurações');
      await wait("document.querySelector('[data-settings-page=more]')");
      await click('Diagnósticos');
      await wait("document.querySelector('.diagnostics-panel') && !document.querySelector('.diagnostics-panel [role=status]')");
      await wait("document.querySelectorAll('.diagnostics-entry-summary').length>0");
      const summary = await execute("document.querySelector('.diagnostics-entry-summary strong').textContent");
      assert.ok(summary !== 'DIAG-PRIVACY-TEST' && !summary.startsWith('BKP-'), 'technical code should be hidden by default');
      assert.equal(await execute("document.querySelector('.diagnostics-technical-message')===null"), true);
      for (const [width, height] of [[1280, 800], [800, 640]]) {
        win.setSize(width, height);
        await new Promise(resolve => setTimeout(resolve, 300));
        const geometry = await execute(`(()=>{
          const viewport=document.documentElement.clientWidth;
          const targets=['.diagnostics-overview','.diagnostics-actions','.diagnostics-filters',
            '.diagnostics-entry-summary','.diagnostics-history-heading'];
          return {viewport,bodyWidth:document.documentElement.scrollWidth,
            bounds:targets.map(sel=>{const el=document.querySelector(sel);if(!el)return {sel,missing:true};
              const r=el.getBoundingClientRect();return {sel,left:r.left,right:r.right,width:r.width}})};
        })()`);
        assert.ok(geometry.bodyWidth <= geometry.viewport + 2, 'horizontal page overflow at ' + width);
        for (const rect of geometry.bounds) {
          assert.equal(rect.missing, undefined, rect.sel + ' must exist');
          assert.ok(rect.left >= -2 && rect.right <= geometry.viewport + 2,
            'misaligned UI at ' + width + ': ' + JSON.stringify(rect));
        }
        const screenshot = await win.webContents.capturePage();
        const previewDir = path.join(__dirname, '../docs/previews');
        fs.mkdirSync(previewDir, { recursive: true });
        fs.writeFileSync(path.join(previewDir, 'preview-diagnostics-' + width + '.png'), screenshot.toPNG());
      }
      await execute("document.querySelector('.diagnostics-entry-summary').click()");
      await wait("document.querySelector('.diagnostics-technical-message')");
      const detail = await execute("document.querySelector('.diagnostics-technical-message').textContent");
      assert.equal(detail.includes('unsafe123'), false);
      assert.equal(detail.includes('/home/hidden'), false);
      completed = true;
      console.log('PASS: friendly error notice, direct report export, private redacted diagnostics and aligned UI at 800/1280.');
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(deadline);
      for (const window of BrowserWindow.getAllWindows()) window.destroy();
      fs.rmSync(root, { recursive: true, force: true });
      app.exit(completed ? 0 : 1);
    }
  });
});
require('../dist/main.cjs');
