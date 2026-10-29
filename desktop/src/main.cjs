const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
  Menu,
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
const { backupJob } = require('./backupJobs.cjs');
const { validateNetworkUrl } = require('./networkPolicy.cjs');
const primaryInstance = !app.isPackaged || app.requestSingleInstanceLock();
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
const commit = next => {
  writeState(stateFile, next);
  state = next;
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
const merge = input => {
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
    if (input[key] !== undefined) next[key] = input[key];
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
  ipcMain.handle(name, (event, ...args) => {
    if (
      event.sender !== mainWindow.webContents ||
      !event.senderFrame?.url.startsWith('lnreader://app/')
    )
      throw new Error('Origem inválida');
    return handler(...args);
  });
}
app
  .whenReady()
  .then(() => {
    if (!primaryInstance) return;
    stateFile = path.join(app.getPath('userData'), 'library.json');
    const loaded = readState(stateFile, emptyState);
    state = loaded.state;
    diskFiles = new DiskFiles(path.join(app.getPath('userData'), 'content'));
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
        message: 'A biblioteca foi recuperada da última cópia válida.',
        detail: 'O arquivo anterior foi preservado na pasta de dados.',
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
    protocol.handle('lnreader', request => {
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
        app.isPackaged || !process.argv.some(arg => arg.endsWith('smoke.cjs')),
      width: 1280,
      height: 850,
      minWidth: 800,
      minHeight: 600,
      autoHideMenuBar: true,
      backgroundColor: '#1b1b1f',
      icon: path.join(__dirname, 'logo.png'),
      title: 'LNReader Desktop',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        offscreen: !app.isPackaged && process.argv.includes('--visual-preview'),
      },
    });
    Menu.setApplicationMenu(null);
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
            buttons: ['Aguardar', 'Fechar sem salvar alterações pendentes'],
            defaultId: 0,
            cancelId: 0,
            message: 'O LNReader ainda não conseguiu concluir o fechamento.',
            detail:
              'A biblioteca já salva será mantida. Fechar agora pode perder o progresso mais recente.',
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
      if (recoveringRenderer || unresponsiveDialog || closeRequested) return;
      unresponsiveDialog = true;
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Aguardar', 'Recarregar interface'],
        defaultId: 0,
        cancelId: 0,
        message: 'A interface parou de responder',
        detail:
          'Uma fonte pode estar travando o aplicativo. Recarregar encerra a tarefa atual e mantém a biblioteca salva. Aguardar mantém a tentativa em andamento.',
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
      if (closeRequested) {
        mayClose = true;
        mainWindow.destroy();
        return;
      }
      if (details.reason === 'clean-exit') return;
      rendererFailures = rendererFailures.filter(
        time => Date.now() - time < 60000,
      );
      rendererFailures.push(Date.now());
      if (rendererFailures.length >= 3) {
        dialog.showErrorBox(
          'Não foi possível recuperar a interface',
          'O LNReader falhou repetidamente e será fechado. A biblioteca salva foi mantida.',
        );
        mainWindow.destroy();
        return;
      }
      if (!recoveringRenderer)
        dialog.showErrorBox(
          'A interface foi reiniciada',
          'O LNReader precisou recarregar a interface depois de uma falha. A biblioteca salva será restaurada.',
        );
      recoveringRenderer = false;
      mainWindow.reload();
    });
    let mayClose = false;
    mainWindow.on('close', event => {
      if (!mayClose && !mainWindow.webContents.isCrashed()) {
        event.preventDefault();
        if (closeRequested) return;
        closeRequested = true;
        checkClose();
        mainWindow.webContents.send('before-close');
      }
    });
    mainWindow.on('closed', () => clearTimeout(closeTimer));
    ipcMain.on('finish-close', event => {
      if (
        event.sender === mainWindow.webContents &&
        event.senderFrame?.url.startsWith('lnreader://app/')
      ) {
        mayClose = true;
        clearTimeout(closeTimer);
        mainWindow.close();
      }
    });
    mainWindow.webContents.on('will-navigate', event => event.preventDefault());
    mainWindow.webContents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    register('load', options => publicState(options?.metadataOnly === true));
    register('info', () => ({
      version: require('../package.json').version,
      platform: process.platform,
    }));
    register('save', merge);
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
    const sourceSession = id => {
      if (typeof id !== 'string' || !/^[\\w.-]+$/.test(id) ||
          ['.', '..', '__proto__', 'constructor', 'prototype'].includes(id))
        throw new Error('Identificador de fonte inválido.');
      if (!sourceSessions.has(id))
        sourceSessions.set(id, session.fromPartition('persist:lnreader-source-' + id));
      return sourceSessions.get(id);
    };
    const requests = new (require('./request.cjs').RequestPool)(net, 8, 128, {
      // Allow local fixture servers only in unpackaged test builds.
      allowPrivate: !app.isPackaged,
      sessionForSource: id => id ? sourceSession(id) : undefined,
    });
    register('request', (url, init) => requests.run(url, init));
    register('source-login', async id => {
      const plugin = state.plugins.find(item => item.id === id);
      if (!plugin) throw new Error('Fonte não instalada.');
      const rawSite = String(plugin.site || '').trim();
      if (!rawSite) throw new Error('Esta fonte não informou o endereço do site para login.');
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
        title: 'Entrar na fonte: ' + plugin.name,
        autoHideMenuBar: true,
        webPreferences: {
          session: sourceSession(id),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      loginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      loginWindow.webContents.on('will-navigate', (event, url) => {
        try { validateNetworkUrl(url); }
        catch { event.preventDefault(); }
      });
      loginWindow.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      try { await loginWindow.loadURL(loginUrl); }
      catch (error) {
        if (!loginWindow.isDestroyed()) loginWindow.close();
        throw error;
      }
      return true;
    });
    register('cancel-request', id => requests.cancel(id));
    register('cancel-requests', () => requests.cancelAll());
    mainWindow.webContents.on('destroyed', () => requests.cancelAll());
    register('backup', async input => {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `LNReader-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'Backup LNReader', extensions: ['zip'] }],
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
        filters: [{ name: 'Backup LNReader', extensions: ['zip'] }],
      });
      if (result.canceled) return null;
      const restored = await backupJob({
        action: 'import',
        contentDirectory: diskFiles.directory,
        filename: result.filePaths[0],
      });
      const confirmation = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancelar', 'Restaurar'],
        defaultId: 0,
        cancelId: 0,
        message: `Restaurar ${restored.state.novels.length} obras?`,
        detail:
          'As seções presentes no backup substituirão os dados atuais. Uma cópia do estado anterior será salva como before-restore.json na pasta de dados do aplicativo.',
      });
      if (confirmation.response !== 1) return null;
      writeState(
        path.join(app.getPath('userData'), 'before-restore.json'),
        state,
      );
      const next = { ...state, files: { ...state.files } };
      if (restored.sections.library) {
        next.novels = restored.state.novels;
        next.categories = restored.state.categories;
      }
      if (restored.sections.settings) next.settings = restored.state.settings;
      if (restored.sections.plugins) next.plugins = restored.state.plugins;
      for (const name of Object.keys(next.files)) {
        if (
          (restored.sections.plugins && name.startsWith('Plugins/')) ||
          (restored.sections.library &&
            (name.startsWith('Novels/') || name.startsWith('Covers/')))
        )
          delete next.files[name];
      }
      Object.assign(next.files, diskFiles.import(restored.state.files));
      if (restored.sections.library)
        next.novels = next.novels.map(novel => ({
          ...novel,
          chapters: novel.chapters.map(chapter => ({
            ...chapter,
            isDownloaded: Boolean(
              chapter.isDownloaded &&
                Object.hasOwn(
                  next.files,
                  `Novels/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`,
                ),
            ),
          })),
        }));
      commit(validateState(next));
      return publicState(true);
    });
    return mainWindow.loadURL('lnreader://app/index.html');
  })
  .catch(error => {
    dialog.showErrorBox('Não foi possível abrir o LNReader', error.message);
    app.exit(1);
  });
app.on('window-all-closed', () => app.quit());
