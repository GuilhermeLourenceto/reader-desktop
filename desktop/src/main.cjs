const { t, setLocale } = require('./i18n.cjs');
const { preserveDesktopPreferences } = require('./state/preserveDesktopPreferences.cjs');
const ui = (message, values = {}) =>
  t(message, values, state?.settings?.desktopInterfaceLanguage);
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
  Menu,
  shell,
  clipboard,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  DiskFiles,
  validateState,
  writeState,
  readState,
} = require('./storage.cjs');
const { emptyState, safePath } = require('./backup.cjs');
const { backupJob, isBackupJobActive } = require('./backupJobs.cjs');
const { freshSettings, pendingReset, markReset, inspectReset, completeReset } = require('./infrastructure/resetData.cjs');
const { planRestore } = require('./restorePlan.cjs');
const { createAutoBackupManager } = require('./autoBackup.cjs');
const { createDiagnostics } = require('./infrastructure/diagnostics.cjs');
const { validateNetworkUrl } = require('./infrastructure/networkPolicy.cjs');
const { installFullscreenShortcut } = require('./infrastructure/fullscreenShortcut.cjs');
// Keep existing libraries when the displayed app name changes.
const defaultProfile = path.join(app.getPath('appData'), app.getName());
if (app.getPath('userData') === defaultProfile) {
  const previousProfile = path.join(app.getPath('appData'), 'LNReader Desktop');
  if (!pendingReset(defaultProfile) && (pendingReset(previousProfile) ||
      fs.existsSync(path.join(previousProfile, 'library.json')) ||
      fs.existsSync(path.join(previousProfile, 'library.json.bak')))) {
    app.setPath('userData', previousProfile);
  }
}
const diagnostics = createDiagnostics({
  directory: path.join(app.getPath('userData'), 'diagnostics'),
});
const report = (level, code, operation, message) => {
  void diagnostics.record({ level, code, operation, message });
};
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
let state;
let mainWindow;
let stateFile;
let diskFiles;
let automaticBackup;
let resetting = false;
let resetPromptOpen = false;
let activeIpc = 0;
const commit = (next) => {
  writeState(stateFile, next);
  state = next;
  setLocale(state.settings?.desktopInterfaceLanguage);
};
const publicState = (metadataOnly = false) => ({
  ...state,
  files: metadataOnly
    ? Object.fromEntries(
        Object.entries(state.files).filter(
          ([name]) => name.startsWith('Covers/') || name.endsWith('/cover.png'),
        ),
      )
    : diskFiles.export(state.files),
});
const merge = (input) => {
  if (!input || !Array.isArray(input.novels) || !Array.isArray(input.plugins))
    throw new Error('Estado inválido');
  const next = { ...state };
  for (const key of [
    'novels',
    'categories',
    'settings',
    'plugins',
    'repositories',
    'pluginStorage',
    'progressUnit',
  ]) {
    if (input[key] !== undefined)
      next[key] = key === 'settings'
        ? preserveDesktopPreferences(state.settings, input[key])
        : input[key];
  }
  commit(validateState(next));
};
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lnreader',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
function register(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== mainWindow.webContents ||
      !event.senderFrame?.url.startsWith('lnreader://app/')
    )
      throw new Error('Origem inválida');
    if (resetting) throw new Error('Reset in progress');
    const tracked = name !== 'reset-data';
    if (tracked) activeIpc++;
    try {
      return await handler(...args);
    } catch (error) {
      const operations = {
        backup: ['backup', 'BKP-EXPORT-FAILED'],
        restore: ['restore', 'BKP-IMPORT-FAILED'],
        save: ['storage', 'STO-SAVE-FAILED'],
        load: ['storage', 'STO-LOAD-FAILED'],
        'source-login': ['source', 'SRC-LOGIN-FAILED'],
      };
      const selected = operations[name] ||
        (name === 'file' && ['write', 'writeBase64', 'remove', 'removeTree'].includes(args[0])
          ? ['storage', 'STO-FILE-FAILED'] : null);
      if (selected) {
        const code = /CRC/i.test(error?.message || '') &&
          ['backup', 'restore'].includes(name) ? 'BKP-CRC' : selected[1];
        report('error', code, selected[0], error?.message || 'Falha na operação.');
      }
      throw error;
    } finally {
      if (tracked) activeIpc--;
    }
  });
}
app
  .whenReady()
  .then(async () => {
    if (!primaryInstance) return;
    const profile = app.getPath('userData');
    const browserRoot = app.getPath('sessionData');
    stateFile = path.join(profile, 'library.json');
    if (pendingReset(profile)) {
      try {
        await completeReset({
          profile, browserRoot,
          clearSessions: async (paths) => {
            const defaultSession = session.defaultSession;
            if (path.relative(browserRoot, defaultSession.getStoragePath()) !== '')
              throw new Error('Unexpected browser storage path');
            const sessions = [defaultSession, ...paths.map(directory => {
              const source = session.fromPath(directory);
              if (path.relative(directory, source.getStoragePath()) !== '')
                throw new Error('Unexpected source storage path');
              return source;
            })];
            for (const currentSession of new Set(sessions)) {
              await currentSession.closeAllConnections();
              // Explicitly omit download files; this only clears browsing data.
              await currentSession.clearData({ dataTypes: [
                'backgroundFetch', 'cache', 'cookies', 'fileSystems',
                'indexedDB', 'localStorage', 'serviceWorkers', 'webSQL',
              ] });
              await currentSession.clearAuthCache();
              await currentSession.cookies.flushStore();
              currentSession.flushStorageData();
            }
          },
          writeInitial: () => writeState(stateFile, validateState({
            ...emptyState(), settings: freshSettings(),
          })),
        });
      } catch (error) {
        dialog.showErrorBox(ui('Redefinição pendente'), ui('Não foi possível concluir a limpeza. Mova backups das pastas internas ou verifique as permissões e abra o aplicativo novamente.') + '\n\n' + error.message);
        app.exit(1);
        return;
      }
    }
    const existingProfile = [stateFile, stateFile + '.bak', stateFile + '.tmp'].some(filename => fs.existsSync(filename));
    const loaded = readState(stateFile, emptyState);
    state = loaded.state;
    // Restore the persisted user locale before any dialogs can be shown.
    setLocale(state.settings?.desktopInterfaceLanguage);
    if (!existingProfile) {
      // An unfinished first run remains unfinished after an app restart.
      commit({ ...state, settings: {
        ...state.settings,
        ...freshSettings(),
      } });
    } else if (state.settings.desktopOnboardingCompleted == null) {
      // Existing installations must keep opening directly into the library.
      commit({ ...state, settings: { ...state.settings, desktopOnboardingCompleted: true } });
    }
    diskFiles = new DiskFiles(path.join(app.getPath('userData'), 'content'));
    automaticBackup = createAutoBackupManager({
      dataDirectory: app.getPath('userData'),
      getState: () => state,
      contentDirectory: diskFiles.directory,
      exportBackup: backupJob,
      report: event => { void diagnostics.record(event); },
    });
    const migrated = diskFiles.import(state.files);
    if (
      Object.entries(migrated).some(
        ([name, value]) => value !== state.files[name],
      )
    )
      commit({ ...state, files: migrated });
    if (loaded.recovered && app.isPackaged)
      dialog.showMessageBox({
        type: 'warning',
        message: ui('A biblioteca foi recuperada da última cópia válida.'),
        detail: ui('O arquivo anterior foi preservado na pasta de dados.'),
      });
    try {
      const previous = JSON.parse(fs.readFileSync(stateFile + '.bak', 'utf8'));
      let retained = { ...previous.files };
      for (const filename of [
        'before-restore.json',
        'before-restore.json.bak',
      ]) {
        const target = path.join(app.getPath('userData'), filename);
        if (fs.existsSync(target))
          Object.assign(
            retained,
            JSON.parse(fs.readFileSync(target, 'utf8')).files,
          );
      }
      diskFiles.prune(state.files, retained);
    } catch {
      /* Keep unused blobs when the recovery index cannot be checked. */
    }
    if (!state.progressUnit) {
      for (const novel of state.novels)
        for (const chapter of novel.chapters) {
          if (
            chapter.progress > 0 &&
            chapter.progress < 1 &&
            !chapter.desktopProgressUnit
          )
            chapter.desktopProgressUnit = 'fraction';
        }
      state.progressUnit = 'percent';
    }
    protocol.handle('lnreader', (request) => {
      const url = new URL(request.url);
      if (url.hostname === 'app' && url.pathname === '/asset') {
        const name = url.searchParams.get('name');
        try {
          safePath(name);
          if (
            (name.startsWith('Covers/') ||
              /^Novels\/.+\/cover\.png$/.test(name)) &&
            Object.hasOwn(state.files, name)
          )
            return new Response(diskFiles.read(state.files[name]), {
              headers: {
                'Content-Type': 'image/png',
                'X-Content-Type-Options': 'nosniff',
              },
            });
        } catch {
          /* A missing cover must not prevent the rest of the page loading. */
        }
        return new Response('', { status: 404 });
      }
      const name = url.pathname.slice(1) || 'index.html';
      if (
        url.hostname !== 'app' ||
        ![
          'index.html',
          'renderer.js',
          'plugin-worker.js',
          'style.css',
          'pt-sans-bold.ttf',
          'noto-sans.ttf',
          'pt-serif.ttf',
          'logo.png',
        ].includes(name)
      )
        return new Response('', { status: 404 });
      if (name === 'plugin-worker.js')
        return new Response(fs.readFileSync(path.join(__dirname, name)), {
          headers: {
            'Content-Type': 'text/javascript',
            'Content-Security-Policy':
              "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; worker-src 'none'",
          },
        });
      return net.fetch(pathToFileURL(path.join(__dirname, name)).href);
    });
    mainWindow = new BrowserWindow({
      show:
        app.isPackaged ||
        !process.argv.some((arg) => arg.endsWith('smoke.cjs')),
      width: 1280,
      height: 850,
      minWidth: 800,
      minHeight: 600,
      autoHideMenuBar: true,
      backgroundColor: '#1b1b1f',
      icon: path.join(__dirname, 'logo.png'),
      title: 'Reader Desktop',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        offscreen: !app.isPackaged && process.argv.includes('--visual-preview'),
      },
    });
    Menu.setApplicationMenu(null);
    installFullscreenShortcut(mainWindow);
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    // A recuperação da janela cobre falhas da interface; as fontes executam
    // em workers separados e podem ser interrompidas sem recarregar a janela.
    let recoveringRenderer = false;
    let unresponsiveDialog = false;
    let rendererFailures = [];
    let closeRequested = false;
    let closeTimer;
    const checkClose = () => {
      closeTimer = setTimeout(async () => {
        if (mayClose || mainWindow.isDestroyed()) return;
        try {
          const answer = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: [
              ui('Aguardar'),
              ui('Fechar sem salvar alterações pendentes'),
            ],
            defaultId: 0,
            cancelId: 0,
            message: ui(
              'O Reader Desktop ainda não conseguiu concluir o fechamento.',
            ),
            detail: ui(
              'A biblioteca já salva será mantida. Fechar agora pode perder o progresso mais recente.',
            ),
          });
          if (mayClose || mainWindow.isDestroyed()) return;
          if (answer.response === 1) {
            mayClose = true;
            mainWindow.destroy();
          } else {
            mainWindow.webContents.send('before-close');
            checkClose();
          }
        } catch {
          if (!mayClose && !mainWindow.isDestroyed()) checkClose();
        }
      }, 5000);
    };
    mainWindow.webContents.on('unresponsive', async () => {
      if (resetting || recoveringRenderer || unresponsiveDialog || closeRequested) return;
      report('warning', 'UI-UNRESPONSIVE', 'interface', 'A interface deixou de responder.');
      unresponsiveDialog = true;
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: [ui('Aguardar'), ui('Recarregar interface')],
        defaultId: 0,
        cancelId: 0,
        message: ui('A interface parou de responder'),
        detail: ui(
          'Uma fonte pode estar travando o aplicativo. Recarregar encerra a tarefa atual e mantém a biblioteca salva. Aguardar mantém a tentativa em andamento.',
        ),
      });
      unresponsiveDialog = false;
      if (answer.response !== 1) return;
      recoveringRenderer = true;
      try {
        mainWindow.webContents.forcefullyCrashRenderer();
      } catch {
        recoveringRenderer = false;
        mainWindow.reload();
      }
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      if (resetting) return;
      if (details.reason !== 'clean-exit')
        report('error', 'UI-RENDER-GONE', 'interface', 'Processo da interface encerrado: ' + details.reason);
      if (closeRequested) {
        mayClose = true;
        mainWindow.destroy();
        return;
      }
      if (details.reason === 'clean-exit') return;
      rendererFailures = rendererFailures.filter(
        (time) => Date.now() - time < 60000,
      );
      rendererFailures.push(Date.now());
      if (rendererFailures.length >= 3) {
        dialog.showErrorBox(
          ui('Não foi possível recuperar a interface'),
          ui(
            'O Reader Desktop falhou repetidamente e será fechado. A biblioteca salva foi mantida.',
          ),
        );
        mainWindow.destroy();
        return;
      }
      if (!recoveringRenderer)
        dialog.showErrorBox(
          ui('A interface foi reiniciada'),
          ui(
            'O Reader Desktop precisou recarregar a interface depois de uma falha. A biblioteca salva será restaurada.',
          ),
        );
      recoveringRenderer = false;
      mainWindow.reload();
    });
    let mayClose = false;
    mainWindow.on('close', (event) => {
      if (resetting) { event.preventDefault(); return; }
      if (!mayClose && !mainWindow.webContents.isCrashed()) {
        event.preventDefault();
        if (closeRequested) return;
        closeRequested = true;
        checkClose();
        mainWindow.webContents.send('before-close');
      }
    });
    mainWindow.on('closed', () => clearTimeout(closeTimer));
    ipcMain.on('finish-close', (event) => {
      if (
        event.sender === mainWindow.webContents &&
        event.senderFrame?.url.startsWith('lnreader://app/')
      ) {
        mayClose = true;
        clearTimeout(closeTimer);
        mainWindow.close();
      }
    });
    mainWindow.webContents.on('will-navigate', (event) =>
      event.preventDefault(),
    );
    mainWindow.webContents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    register('load', (options) => publicState(options?.metadataOnly === true));
    register('info', () => ({
      version: require('../package.json').version,
      platform: process.platform,
    }));
    register('diagnostics-list', options => diagnostics.list(options));
    register('diagnostics-report', input => diagnostics.record({
      level: input?.level, code: input?.code,
      operation: input?.operation, message: input?.message,
    }));
    register('diagnostics-export', async () => {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'ReaderDesktop-diagnostico-' + new Date().toISOString().slice(0, 10) + '.txt',
        filters: [{ name: 'Relatório de diagnóstico', extensions: ['txt'] }],
      });
      if (result.canceled || !result.filePath) return null;
      const saved = await diagnostics.exportReport(result.filePath, {
        version: require('../package.json').version,
        platform: process.platform,
        arch: process.arch,
      });
      if (!saved.saved) throw new Error('Não foi possível salvar o relatório.');
      return saved;
    });
    register('diagnostics-clear', async () => {
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        message: ui('Apagar o histórico de diagnósticos?'),
        detail: ui('Relatórios salvos manualmente não serão apagados.'),
        buttons: [ui('Cancelar'), ui('Apagar histórico')],
        defaultId: 0, cancelId: 0,
      });
      return answer.response === 1 ? diagnostics.clear() : false;
    });
    register('diagnostics-copy', text => {
      if (typeof text !== 'string' || text.length > 180)
        throw new Error('Código de diagnóstico inválido.');
      clipboard.writeText(text);
      return true;
    });
    register('diagnostics-open-issue', () =>
      shell.openExternal('https://github.com/GuilhermeLourenceto/lnreader-desktop/issues/new'));
    register('save', input => {
      const finishedNow = state.settings.desktopOnboardingCompleted !== true &&
        input?.settings?.desktopOnboardingCompleted === true;
      merge(input);
      if (finishedNow) void automaticBackup.check({ launch: true });
    });
    register('choose-backup-directory', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
      });
      return result.canceled ? null : result.filePaths[0];
    });
    register('file', (action, name, content) => {
      safePath(name);
      if (!/^(Plugins|Novels|Covers)\/.+/.test(name))
        throw new Error('Pasta inválida');
      if (action === 'exists') return Object.hasOwn(state.files, name);
      if (action === 'readBase64')
        return Object.hasOwn(state.files, name)
          ? diskFiles.read(state.files[name]).toString('base64')
          : null;
      if (action === 'removeTree') {
        if (!/^Novels\/[^/]+\/\d+\/\d+$/.test(name))
          throw new Error('Pasta de capítulo inválida');
        const files = { ...state.files };
        for (const key of Object.keys(files))
          if (key.startsWith(name + '/')) delete files[key];
        commit({ ...state, files });
        return;
      }
      if (action === 'read' || action === 'tryRead') {
        if (action === 'tryRead' && !Object.hasOwn(state.files, name))
          return null;
        if (!Object.hasOwn(state.files, name))
          throw new Error('Arquivo não encontrado');
        return diskFiles.read(state.files[name]).toString('utf8');
      }
      const files = { ...state.files };
      if (
        action === 'write' &&
        typeof content === 'string' &&
        content.length < 20 * 1024 * 1024
      )
        files[name] = diskFiles.write(Buffer.from(content));
      else if (
        action === 'writeBase64' &&
        typeof content === 'string' &&
        content.length < 28 * 1024 * 1024 &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(content)
      )
        files[name] = diskFiles.write(Buffer.from(content, 'base64'));
      else if (action === 'remove') delete files[name];
      else throw new Error('Operação inválida');
      commit({ ...state, files });
    });
    const sourceSessions = new Map();
    const sourceSession = (id) => {
      if (
        typeof id !== 'string' ||
        !/^[a-zA-Z0-9_.-]+$/.test(id) ||
        ['.', '..', '__proto__', 'constructor', 'prototype'].includes(
          id,
        )
      )
        throw new Error('Identificador de fonte inválido.');
      if (!sourceSessions.has(id))
        sourceSessions.set(
          id,
          session.fromPartition('persist:lnreader-source-' + id),
        );
      return sourceSessions.get(id);
    };
    const requests = new (require('./request.cjs').RequestPool)(net, 8, 128, {
      // Allow local fixture servers only in unpackaged test builds.
      allowPrivate: !app.isPackaged,
      sessionForSource: (id) => (id ? sourceSession(id) : undefined),
      // Repository requests have no sourceId and use the default session.
      // Source requests use their own session.resolveHost in RequestPool.
      dnsResolver: (hostname, options) => session.defaultSession.resolveHost(hostname, options),
      requireDnsValidation: true,
    });
    register('request', (url, init) => requests.run(url, init));
    register('source-login', async (id) => {
      const plugin = state.plugins.find((item) => item.id === id);
      if (!plugin) throw new Error('Fonte não instalada.');
      const rawSite = String(plugin.site || '').trim();
      if (!rawSite)
        throw new Error(
          'Esta fonte não informou o endereço do site para login.',
        );
      const loginUrl = validateNetworkUrl(
        /^https?:\/\//i.test(rawSite) ? rawSite : 'https://' + rawSite,
        { allowPrivate: !app.isPackaged },
      );
      if (new URL(loginUrl).protocol !== 'https:' && app.isPackaged)
        throw new Error('Login requer um site HTTPS.');
      const loginWindow = new BrowserWindow({
        parent: mainWindow,
        width: 1050,
        height: 760,
        minWidth: 600,
        minHeight: 480,
        title: ui('Entrar na fonte: {name}', { name: plugin.name }),
        autoHideMenuBar: true,
        webPreferences: {
          session: sourceSession(id),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      // Some legitimate sign-in providers open an HTTPS popup. Allow those
      // windows only inside this source's cookie partition; no preload, Node,
      // filesystem access or special schemes are inherited from the app UI.
      const loginPopups = new Set();
      const validLoginNavigation = (url) => {
        try {
          validateNetworkUrl(url, { allowPrivate: !app.isPackaged });
          return true;
        } catch {
          return false;
        }
      };
      loginWindow.webContents.setWindowOpenHandler(({ url }) => {
        const publicUrl =
          url !== 'about:blank' && validLoginNavigation(url)
            ? new URL(url)
            : null;
        // Public external identity providers may open HTTPS popups; legacy
        // HTTP popups are permitted only at the original source's origin.
        const allowed =
          url === 'about:blank' ||
          (publicUrl &&
            (publicUrl.protocol === 'https:' ||
              publicUrl.origin === new URL(loginUrl).origin));
        if (loginPopups.size >= 3 || !allowed) return { action: 'deny' };
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: loginWindow,
            width: 780,
            height: 680,
            autoHideMenuBar: true,
            webPreferences: {
              session: sourceSession(id),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      });
      loginWindow.webContents.on('did-create-window', (popup) => {
        loginPopups.add(popup);
        popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        popup.webContents.on('will-navigate', (event, url) => {
          if (!validLoginNavigation(url)) event.preventDefault();
        });
        popup.on('closed', () => loginPopups.delete(popup));
      });
      loginWindow.on('closed', () => {
        for (const popup of loginPopups)
          if (!popup.isDestroyed()) popup.close();
        loginPopups.clear();
      });
      loginWindow.webContents.on('will-navigate', (event, url) => {
        if (!validLoginNavigation(url)) event.preventDefault();
      });
      loginWindow.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      // Wait for the user to finish the login or browser verification.
      // Calling code can retry the source only after the window closes,
      // using the same persistent cookie session.
      let navigationFailure = null;
      const finished = new Promise((resolve, reject) => {
        loginWindow.once('closed', () => {
          if (navigationFailure) reject(navigationFailure);
          else resolve(true);
        });
      });
      try {
        await loginWindow.loadURL(loginUrl);
      } catch (error) {
        if (!loginWindow.isDestroyed()) {
          navigationFailure = error;
          loginWindow.close();
        }
      }
      return finished;
    });
    register('reset-data', async () => {
      if (resetPromptOpen || resetting || closeRequested) return 'cancelled';
      resetPromptOpen = true;
      try {
        const confirmation = await dialog.showMessageBox(mainWindow, {
          type: 'warning', noLink: true,
          message: ui('Apagar todos os dados?'),
          detail: ui('Biblioteca, progresso, downloads, fontes, sessões e configurações serão apagados. Os backups ZIP existentes serão preservados. O aplicativo reiniciará no primeiro acesso. Esta ação não pode ser desfeita sem um backup.'),
          buttons: [ui('Cancelar'), ui('Criar backup antes de apagar'), ui('Apagar todos os dados')],
          defaultId: 0, cancelId: 0,
        });
        if (confirmation.response === 1) return 'backup';
        if (confirmation.response !== 2) return 'cancelled';
        if (closeRequested || mainWindow.isDestroyed()) return 'cancelled';
        // Freeze both automatic rotation and IPC before inspecting the profile.
        // Refuse an active export rather than interrupt it or race its worker.
        if (activeIpc || isBackupJobActive() || !automaticBackup.pauseForReset()) {
          await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            message: ui('Aguarde as operações em andamento antes de apagar os dados.'),
          });
          return 'blocked';
        }
        resetting = true;
        try {
          // Browser files may still be locked by Chromium. Check their names
          // now and recheck headers before clearing sessions on next startup.
          await inspectReset(profile, browserRoot, { browserHeaders: false });
        } catch (error) {
          resetting = false;
          automaticBackup.resumeAfterReset();
          dialog.showErrorBox(ui('Não foi possível apagar os dados'), ui('Verifique as permissões e mova os backups ZIP que estejam dentro das pastas internas do aplicativo.') + '\n\n' + error.message);
          return 'blocked';
        }
        try {
          markReset(profile);
        } catch (error) {
          // A published marker must not be followed by normal writes.
          if (!pendingReset(profile)) {
            resetting = false;
            automaticBackup.resumeAfterReset();
            dialog.showErrorBox(ui('Não foi possível apagar os dados'), error.message);
            return 'blocked';
          }
        }
        // Only the next process performs deletion, before readState or
        // any renderer/backup worker is initialized. Never use normal close,
        // which intentionally saves the previous React snapshot.
        clearInterval(backupTimer);
        requests.cancelAll();
        setImmediate(() => {
          try {
            const image = process.platform === 'linux' && process.env.APPIMAGE;
            if (app.isPackaged && image && path.isAbsolute(image) && fs.existsSync(image))
              app.relaunch({ execPath: image });
            else app.relaunch();
          } catch (error) {
            dialog.showErrorBox(ui('Redefinição pendente'), ui('Abra o aplicativo novamente para concluir a redefinição.'));
          } finally {
            app.exit(0);
          }
        });
        return 'scheduled';
      } finally {
        resetPromptOpen = false;
      }
    });
    register('cancel-request', (id) => requests.cancel(id));
    register('cancel-requests', () => requests.cancelAll());
    mainWindow.webContents.on('destroyed', () => requests.cancelAll());
    register('backup', async (input) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `ReaderDesktop-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'Backup Reader Desktop', extensions: ['zip'] }],
      });
      if (result.canceled) return false;
      merge(input);
      const exported = await backupJob({
        action: 'export',
        state,
        contentDirectory: diskFiles.directory,
        filename: result.filePath,
      });
      return exported;
    });
    register('restore', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Backup Reader Desktop', extensions: ['zip'] }],
      });
      if (result.canceled) return null;
      const restored = await backupJob({
        action: 'import',
        contentDirectory: diskFiles.directory,
        filename: result.filePaths[0],
      });
      try {
      const missingSectionNames = {
        categories: ui('categorias'),
        settings: ui('configurações'),
        plugins: ui('fontes'),
      };
      const missingInfo = restored.missingSections?.length
        ? '\n\n' + ui('Seções ausentes no backup; os dados atuais serão preservados:') +
          ' ' + restored.missingSections.map(name => missingSectionNames[name] || name).join(', ')
        : '';
      const confirmation = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: [ui('Cancelar'), ui('Restaurar')],
        defaultId: 0,
        cancelId: 0,
        message: restored.sections.library
          ? ui('Restaurar {count} obras?', {
              count: restored.state.novels.length,
            })
          : ui('Restaurar seções selecionadas do backup?'),
        detail: ui(
          'Obras e fontes serão mescladas, preservando os downloads locais. Preferências Android compatíveis podem atualizar idioma, tema e leitura. Opções exclusivas do PC, como ocultar barras e a pasta de backup, serão mantidas. O estado anterior será salvo como before-restore.json se houver mudanças.',
        ) + missingInfo,
      });
      if (confirmation.response !== 1) return null;
      const { next, changed } = planRestore(
        state,
        restored,
        files => diskFiles.import(files),
        (_name, reference, replacements) => {
          let html = diskFiles.read(reference).toString('utf8');
          for (const { from, to } of replacements)
            html = html.split(from).join(to);
          return diskFiles.write(Buffer.from(html, 'utf8'));
        },
      );
      // A full no-op restore should not rewrite library.json or its recovery
      // copy, reload the UI, or replace a useful before-restore.json.
      if (!changed) return { unchanged: true };
      writeState(
        path.join(app.getPath('userData'), 'before-restore.json'),
        state,
      );
      commit(next);
      return publicState(true);
      } finally {
        // A large Android ZIP may contain gigabytes of offline chapters.
        // If the user cancels, or restoration fails, remove only blobs
        // introduced by this import and not referenced by the current library.
        await diskFiles.cleanupImported(restored.newBlobHashes, state.files);
      }
    });
    const backupTimer = setInterval(() => void automaticBackup.check(), 5 * 60 * 1000);
    mainWindow.on('closed', () => clearInterval(backupTimer));
    return mainWindow.loadURL('lnreader://app/index.html').then(() => {
      report('info', 'APP-START', 'app', 'Reader Desktop iniciado.');
      void automaticBackup.check({ launch: true });
    });
  })
  .catch(async (error) => {
    await diagnostics.record({ level: 'error', code: 'APP-START-FAILED', operation: 'app', message: error?.message });
    dialog.showErrorBox(ui('Não foi possível abrir o Reader Desktop'), error.message);
    app.exit(1);
  });
app.on('window-all-closed', () => app.quit());
