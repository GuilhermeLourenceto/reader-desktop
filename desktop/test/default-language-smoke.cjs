// Fresh installation test: use an empty disposable profile, never a real
// user library. Verify English initially, preservation of a user's explicit
// Portuguese choice, and English after a deliberate settings reset.
const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-english-default-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const deadline = setTimeout(() => {
  console.error('Default English smoke test timed out');
  app.exit(1);
}, 80000);

app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const js = source => win.webContents.executeJavaScript(source, true);
    const wait = async expression => {
      for (let i = 0; i < 300; i++) {
        if (await js(`Promise.resolve(${expression}).then(Boolean)`)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw Error('Timed out: ' + expression);
    };
    const click = label => js(`(()=>{const el=Array.from(document.querySelectorAll('button')).find(button=>(button.getAttribute('aria-label')||button.textContent.trim())===${JSON.stringify(label)});if(!el)throw Error('Button not found: '+${JSON.stringify(label)});el.click();})()`);
    const switchLanguage = (label, value) => js(`(()=>{const input=document.querySelector('select[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');if(!input)throw Error('Language selector not found');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const reload = () => new Promise(resolve => {
      win.webContents.once('did-finish-load', resolve);
      win.webContents.reload();
    });
    try {
      assert.equal(fs.existsSync(path.join(directory, 'library.json')), false, 'New install must not require seeded settings');
      await wait("document.documentElement.lang==='en' && document.querySelector('nav') && !document.querySelector('.busy')");
      assert.equal(await js("document.querySelector('nav button:last-child').textContent.trim()"), 'More');
      assert.equal((await js("window.desktop.load({metadataOnly:true})")).settings.desktopInterfaceLanguage, undefined);
      await click('More');
      await click('Settings');
      await click('General');
      assert.equal(await js("document.querySelector('select[aria-label=\"Interface language\"]').value"), 'en');
      await switchLanguage('Interface language', 'pt-BR');
      await wait("document.documentElement.lang==='pt-BR'");
      await wait("window.desktop.load({metadataOnly:true}).then(state=>state.settings.desktopInterfaceLanguage==='pt-BR')");
      await reload();
      await wait("document.documentElement.lang==='pt-BR' && document.querySelector('nav') && !document.querySelector('.busy')");
      assert.equal(await js("document.querySelector('nav button:last-child').textContent.trim()"), 'Mais', 'Existing Portuguese selection must survive reload');
      await click('Mais');
      await click('Configurações');
      await js('void(window.confirm = () => true)');
      await click('Restaurar configurações padrão');
      await wait("document.documentElement.lang==='en'");
      await wait("window.desktop.load({metadataOnly:true}).then(state=>state.settings.desktopInterfaceLanguage==='en')");
      await reload();
      await wait("document.documentElement.lang==='en' && document.querySelector('nav') && !document.querySelector('.busy')");
      assert.equal(await js("document.querySelector('nav button:last-child').textContent.trim()"), 'More');
      assert.equal((await js("window.desktop.load({metadataOnly:true})")).settings.desktopInterfaceLanguage, 'en');
      console.log('PASS: fresh install English, saved Portuguese preserved, reset to English, reload remains English.');
      clearTimeout(deadline);
      win.destroy();
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(deadline);
      win.destroy();
      app.exit(1);
    }
  });
});
require('../dist/main.cjs');
