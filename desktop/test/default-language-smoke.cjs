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
    const js = async source => {
      // Show the exact failing expression rather than Electron's generic
      // "Script failed to execute" message.
      const result = await win.webContents.executeJavaScript(
        `(async () => { try { return await (${source}); } catch (error) { return { __testError: String(error) }; } })()`,
        true,
      );
      if (result && result.__testError)
        throw new Error('Renderer expression failed: ' + source + ' :: ' + result.__testError);
      return result;
    };
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
      // An entirely new profile now writes a pending-onboarding marker and
      // must show the real three-step first-run wizard, not a seeded library.
      assert.equal(fs.existsSync(path.join(directory, 'library.json')), true, 'New install creates a recoverable first-run marker');
      await wait("document.documentElement.lang==='en' && document.querySelector('.first-run') && !document.querySelector('nav')");
      assert.equal((await js("window.desktop.load({metadataOnly:true})")).settings.desktopOnboardingCompleted, false);
      assert.equal(await js("document.querySelector('#first-run-language').value"), 'en');
      assert.equal(await js("document.querySelector('.first-run h1').textContent"), 'Welcome');
      // Changing language immediately updates the current step and both
      // subsequent onboarding steps, including palette and backup controls.
      await js("(()=>{const select=document.querySelector('#first-run-language');select.value='ja';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
      await wait("document.documentElement.lang==='ja' && document.querySelector('.first-run h1')?.textContent==='ようこそ'");
      await click('次へ');
      await wait("document.querySelector('.first-run[data-step=2] h1')?.textContent==='テーマを選択'");
      assert.equal(await js("Array.from(document.querySelectorAll('.first-run-theme-name')).every(element=>!['Padrão','Crepúsculo','Turquesa'].includes(element.textContent))"), true);
      await click('次へ');
      await wait("document.querySelector('.first-run[data-step=3] h1')?.textContent==='バックアップの設定'");
      assert.equal(await js("document.querySelector('#first-run-frequency option[value=off]').textContent"), '無効');
      await click('戻る');
      await wait("document.querySelector('.first-run[data-step=2] h1')?.textContent==='テーマを選択'");
      await click('戻る');
      await wait("document.querySelector('.first-run[data-step=1] h1')?.textContent==='ようこそ'");
      await js("(()=>{const select=document.querySelector('#first-run-language');select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
      await wait("document.documentElement.lang==='en' && document.querySelector('.first-run h1')?.textContent==='Welcome'");
      await click('Next');
      await wait("document.querySelector('.first-run[data-step=2]') !== null");
      await click('Next');
      await wait("document.querySelector('.first-run[data-step=3]') !== null");
      await js("(()=>{const s=document.querySelector('#first-run-frequency');s.value='off';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
      await click('Finish');
      await wait("document.documentElement.lang==='en' && document.querySelector('nav') && !document.querySelector('.busy')");
      assert.equal(await js("document.querySelector('nav button:last-child').textContent.trim()"), 'More');
      assert.equal((await js("window.desktop.load({metadataOnly:true})")).settings.desktopOnboardingCompleted, true);
      assert.equal((await js("window.desktop.load({metadataOnly:true})")).settings.desktopInterfaceLanguage, 'en');
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
      await click('Aparência');
      await js("(()=>{const s=document.querySelector('select[aria-label=\"Tema do aplicativo\"]');s.value='oled';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
      await wait("document.documentElement.dataset.appTheme==='oled' && getComputedStyle(document.documentElement).backgroundColor==='rgb(0, 0, 0)'");
      await wait("window.desktop.load({metadataOnly:true}).then(state=>state.settings.desktopTheme==='oled')");
      await reload();
      await wait("document.documentElement.dataset.appTheme==='oled' && document.documentElement.lang==='pt-BR' && !document.querySelector('.busy')");
      await click('Mais');
      await click('Configurações');
      await js('void(window.confirm = () => true)');
      await click('Restaurar configurações padrão');
      await wait("document.documentElement.lang==='en' && document.documentElement.dataset.appTheme==='dark'");
      await wait("window.desktop.load({metadataOnly:true}).then(state=>state.settings.desktopInterfaceLanguage==='en' && state.settings.desktopTheme==='dark')");
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
