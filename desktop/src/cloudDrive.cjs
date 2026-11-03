// Google Drive backup integration. This module runs only in Electron's main
// process; never expose OAuth tokens or Google APIs directly to the renderer.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { backupJob } = require('./backupJobs.cjs');
const { sortDriveBackups } = require('./driveBackupList.cjs');

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN = 'https://oauth2.googleapis.com/token';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'LNReader Backups';
const MAX_ZIP = 512 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{5,200}$/;
const CLIENT_PATTERN = /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

function createPkce() {
  const verifier = randomBytes(48).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: randomBytes(32).toString('base64url'),
  };
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}
function idIsValid(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}
async function responseError(response, prefix) {
  const body = await response.text().catch(() => '');
  let message = '';
  try {
    const parsed = JSON.parse(body);
    message = parsed.error?.message || parsed.error_description || '';
  } catch {}
  const error = new Error(prefix + ' (HTTP ' + response.status + ')' + (message ? ': ' + String(message).slice(0, 180) : ''));
  error.status = response.status;
  throw error;
}
async function tokenRequest(fetchImpl, params) {
  const response = await fetchImpl(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) await responseError(response, 'Falha na autorização do Google');
  const value = await response.json();
  if (!value.access_token) throw new Error('Google não retornou autorização válida.');
  return value;
}
async function authorizeDesktop({ clientId, openExternal, fetchImpl = fetch, timeoutMs = 150000 }) {
  if (!CLIENT_PATTERN.test(clientId)) throw new Error('ID OAuth do Google Drive não configurado pelo desenvolvedor.');
  const pkce = createPkce();
  const server = http.createServer();
  let finish;
  const authorization = new Promise((resolve, reject) => {
    finish = (error, value) => error ? reject(error) : resolve(value);
  });
  let settled = false;
  const settle = (error, value) => {
    if (settled) return;
    settled = true;
    finish(error, value);
  };
  server.on('request', (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== '/oauth/callback') {
      response.writeHead(404).end('Not found');
      return;
    }
    if (!safeEqual(url.searchParams.get('state'), pkce.state)) {
      response.writeHead(400).end('Invalid authorization state');
      return;
    }
    const code = url.searchParams.get('code');
    const denied = url.searchParams.get('error');
    response.writeHead(code ? 200 : 400, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
    });
    response.end(code
      ? '<!doctype html><title>LNReader</title><p>Google Drive connected. Return to LNReader.</p>'
      : '<!doctype html><title>LNReader</title><p>Google Drive authorization was not completed.</p>');
    settle(code ? null : new Error(denied ? 'Autorização recusada pelo Google.' : 'Código OAuth ausente.'), code);
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const redirectUri = 'http://127.0.0.1:' + server.address().port + '/oauth/callback';
    const authUrl = new URL(AUTH);
    for (const [key, value] of Object.entries({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      state: pkce.state,
    })) authUrl.searchParams.set(key, value);
    const timeout = setTimeout(() => settle(new Error('A conexão com o Google expirou.')), timeoutMs);
    timeout.unref?.();
    try {
      await openExternal(authUrl.toString());
      const code = await authorization;
      return tokenRequest(fetchImpl, {
        client_id: clientId,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
        code_verifier: pkce.verifier,
      });
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    server.close();
  }
}
class TokenVault {
  constructor({ directory, safeStorage, platform = process.platform }) {
    this.file = path.join(directory, 'google-drive-token.enc');
    this.safeStorage = safeStorage;
    this.platform = platform;
  }
  async available() {
    if (typeof this.safeStorage.isAsyncEncryptionAvailable !== 'function' ||
      !await this.safeStorage.isAsyncEncryptionAvailable()) return false;
    // Check the backend AFTER async encryption initializes it. An earlier
    // check could return "unknown" and then silently select basic_text.
    if (this.platform !== 'linux') return true;
    const backend = this.safeStorage.getSelectedStorageBackend?.();
    return ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(backend);
  }
  exists() { return fs.existsSync(this.file); }
  async read() {
    if (!this.exists()) return null;
    if (!await this.available()) throw new Error('Armazenamento seguro indisponível. Configure o chaveiro do sistema.');
    const ciphertext = await fsp.readFile(this.file);
    const decrypted = await this.safeStorage.decryptStringAsync(ciphertext);
    return JSON.parse(decrypted.result);
  }
  async write(token) {
    if (!await this.available()) throw new Error('Armazenamento seguro indisponível. Configure o chaveiro do sistema.');
    const encrypted = await this.safeStorage.encryptStringAsync(JSON.stringify(token));
    const temporary = this.file + '.' + randomBytes(8).toString('hex') + '.tmp';
    try {
      await fsp.writeFile(temporary, encrypted, { flag: 'wx', mode: 0o600 });
      await fsp.rename(temporary, this.file);
    } finally {
      await fsp.rm(temporary, { force: true }).catch(() => {});
    }
  }
  async clear() { await fsp.rm(this.file, { force: true }); }
}
class CloudDrive {
  constructor({ directory, clientId, safeStorage, openExternal, fetchImpl = fetch, restoreFile, readState, contentDirectory }) {
    this.clientId = clientId || '';
    this.directory = directory;
    this.vault = new TokenVault({ directory, safeStorage });
    this.openExternal = openExternal;
    this.fetchImpl = fetchImpl;
    this.restoreFile = restoreFile;
    this.readState = readState;
    this.contentDirectory = contentDirectory;
    this.settingsFile = path.join(directory, 'google-drive-settings.json');
    this.preferences = { automatic: false, lastBackupAt: null };
    this.cachedToken = null;
    this.busy = false;
    try {
      const data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
      this.preferences.automatic = data.automatic === true;
      if (typeof data.lastBackupAt === 'string' && !Number.isNaN(Date.parse(data.lastBackupAt)))
        this.preferences.lastBackupAt = data.lastBackupAt;
    } catch {}
  }
  configured() { return CLIENT_PATTERN.test(this.clientId); }
  async status() {
    return {
      configured: this.configured(),
      connected: this.configured() && this.vault.exists(),
      secure: await this.vault.available(),
      automatic: this.preferences.automatic,
      lastBackupAt: this.preferences.lastBackupAt,
      busy: this.busy,
    };
  }
  async savePreferences() {
    const temporary = this.settingsFile + '.tmp';
    try {
      await fsp.writeFile(temporary, JSON.stringify(this.preferences), { mode: 0o600 });
      await fsp.rename(temporary, this.settingsFile);
    } finally {
      await fsp.rm(temporary, { force: true }).catch(() => {});
    }
  }
  async connect() {
    if (!this.configured()) throw new Error('Google Drive ainda não foi configurado pelo desenvolvedor.');
    if (!await this.vault.available()) throw new Error('Ative o chaveiro seguro do Windows ou Linux para conectar o Google Drive.');
    const token = await authorizeDesktop({
      clientId: this.clientId, openExternal: this.openExternal, fetchImpl: this.fetchImpl,
    });
    if (!token.refresh_token) throw new Error('Google não forneceu autorização de acesso offline. Reconecte a conta.');
    await this.vault.write({ refreshToken: token.refresh_token });
    // Never carry an old account's automatic-backup opt-in to a new login.
    this.preferences.automatic = false;
    this.preferences.lastBackupAt = null;
    await this.savePreferences();
    this.cachedToken = { value: token.access_token, expires: Date.now() + (token.expires_in || 3500) * 1000 };
    return this.status();
  }
  async disconnect() {
    if (this.busy) throw new Error('Conclua o backup antes de desconectar a conta.');
    await this.vault.clear();
    this.cachedToken = null;
    this.preferences.automatic = false;
    await this.savePreferences();
    return this.status();
  }
  async setAutomatic(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Opção de backup inválida.');
    if (enabled && !(await this.status()).connected) throw new Error('Conecte o Google Drive antes de ativar o backup automático.');
    this.preferences.automatic = enabled;
    await this.savePreferences();
    return this.status();
  }
  async accessToken() {
    if (this.cachedToken && this.cachedToken.expires > Date.now() + 60000) return this.cachedToken.value;
    const saved = await this.vault.read();
    if (!saved?.refreshToken) throw new Error('Conecte sua conta Google nas configurações.');
    const token = await tokenRequest(this.fetchImpl, {
      client_id: this.clientId, grant_type: 'refresh_token', refresh_token: saved.refreshToken,
    });
    this.cachedToken = { value: token.access_token, expires: Date.now() + (token.expires_in || 3500) * 1000 };
    return token.access_token;
  }
  async request(url, options = {}) {
    const token = await this.accessToken();
    const response = await this.fetchImpl(url, {
      ...options,
      headers: { ...options.headers, Authorization: 'Bearer ' + token },
      signal: options.signal || AbortSignal.timeout(60000),
    });
    if (!response.ok) await responseError(response, 'Google Drive');
    return response;
  }
  async json(url, options) { return (await this.request(url, options)).json(); }
  async queryFiles(query, fields = 'nextPageToken,files(id,name,mimeType,createdTime,size,md5Checksum)', orderBy = '') {
    const results = [];
    let pageToken;
    for (let page = 0; page < 5; page++) {
      const url = new URL(API);
      url.searchParams.set('q', query);
      url.searchParams.set('fields', fields);
      url.searchParams.set('pageSize', '100');
      if (orderBy) url.searchParams.set('orderBy', orderBy);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const value = await this.json(url.toString());
      results.push(...(value.files || []));
      pageToken = value.nextPageToken;
      if (!pageToken) break;
    }
    return results;
  }
  async folder(create = false) {
    const query = "name = '" + FOLDER + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    const folders = await this.queryFiles(query);
    const found = folders.find(x => idIsValid(x.id));
    if (found) return found.id;
    if (!create) return null;
    const created = await this.json(API + '?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!idIsValid(created.id)) throw new Error('Google Drive não retornou o ID da pasta.');
    return created.id;
  }
  async list() {
    if (!(await this.status()).connected) throw new Error('Conecte sua conta Google.');
    const folder = await this.folder(false);
    if (!folder) return [];
    const files = await this.queryFiles(
      "'" + folder + "' in parents and trashed = false and mimeType = 'application/zip'",
      undefined,
      'createdTime desc',
    );
    return sortDriveBackups(
      files.filter(x => idIsValid(x.id) && /^LNReader-.*\.zip$/i.test(x.name || ''))
        .map(x => ({ id: x.id, name: x.name, createdTime: x.createdTime || '', size: Number(x.size) || 0 })),
    );
  }
  async upload(file) {
    const stat = await fsp.stat(file);
    if (stat.size > MAX_ZIP) throw new Error('O backup excede o limite de 512 MB.');
    const folder = await this.folder(true);
    const name = 'LNReader-' + new Date().toISOString().replace(/[:.]/g, '-') + '.zip';
    const response = await this.request(UPLOAD + '?uploadType=resumable&fields=id,name,createdTime,size', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/zip',
        'X-Upload-Content-Length': String(stat.size) },
      body: JSON.stringify({ name, mimeType: 'application/zip', parents: [folder] }),
    });
    const location = response.headers.get('location');
    let url;
    try { url = new URL(location); } catch { throw new Error('Google Drive não retornou endereço de upload válido.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'www.googleapis.com' || !url.pathname.startsWith('/upload/drive/v3/files'))
      throw new Error('Endereço de upload não pertence ao Google Drive.');
    const body = fs.createReadStream(file);
    const uploaded = await this.request(url.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip', 'Content-Length': String(stat.size) },
      body, duplex: 'half', signal: AbortSignal.timeout(15 * 60000),
    });
    const metadata = await uploaded.json();
    if (!idIsValid(metadata.id)) throw new Error('Google Drive não confirmou o arquivo enviado.');
    return { id: metadata.id, name, size: stat.size };
  }
  async download(fileId, filename) {
    if (!idIsValid(fileId)) throw new Error('Identificador inválido.');
    const records = await this.list();
    const record = records.find(x => x.id === fileId);
    if (!record) throw new Error('Este backup não pertence à pasta do LNReader.');
    if (record.size > MAX_ZIP) throw new Error('Backup remoto excede 512 MB.');
    const metadata = await this.json(API + '/' + encodeURIComponent(fileId) + '?fields=id,size,md5Checksum');
    const response = await this.request(API + '/' + encodeURIComponent(fileId) + '?alt=media', {
      signal: AbortSignal.timeout(15 * 60000),
    });
    if (!response.body) throw new Error('Google Drive retornou arquivo vazio.');
    let length = 0;
    const hash = createHash('md5');
    const meter = new Transform({
      transform(chunk, encoding, callback) {
        length += chunk.length;
        if (length > MAX_ZIP) return callback(new Error('Download excedeu 512 MB.'));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(filename, { flags: 'wx', mode: 0o600 }));
    if (metadata.size != null && Number(metadata.size) !== length) throw new Error('Backup do Drive está incompleto.');
    if (metadata.md5Checksum && metadata.md5Checksum.toLowerCase() !== hash.digest('hex'))
      throw new Error('Integridade do backup remoto não confirmada.');
    return length;
  }
  async withTemporaryFile(callback) {
    const parent = path.join(this.directory, 'cloud-backup-tmp');
    await fsp.mkdir(parent, { recursive: true, mode: 0o700 });
    const folder = await fsp.mkdtemp(path.join(parent, 'job-'));
    const filename = path.join(folder, 'backup.zip');
    try { return await callback(filename); }
    finally { await fsp.rm(folder, { recursive: true, force: true }); }
  }
  async backup() {
    if (this.busy) throw new Error('Já existe uma operação de backup em andamento.');
    if (!(await this.status()).connected) throw new Error('Conecte sua conta Google.');
    this.busy = true;
    try {
      const result = await this.withTemporaryFile(async filename => {
        const exported = await backupJob({
          action: 'export', state: this.readState(),
          contentDirectory: this.contentDirectory, filename,
        });
        const remote = await this.upload(filename);
        return { ...remote, missingCount: exported.missingCount };
      });
      this.preferences.lastBackupAt = new Date().toISOString();
      await this.savePreferences();
      return result;
    } finally { this.busy = false; }
  }
  async restore(id) {
    if (this.busy) throw new Error('Já existe uma operação de backup em andamento.');
    this.busy = true;
    try {
      return await this.withTemporaryFile(async filename => {
        await this.download(id, filename);
        return this.restoreFile(filename);
      });
    } finally { this.busy = false; }
  }
  async automaticBackup() {
    if (!this.preferences.automatic || this.busy || !(await this.status()).connected) return false;
    const last = Date.parse(this.preferences.lastBackupAt || '') || 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return false;
    await this.backup();
    return true;
  }
}
module.exports = { CloudDrive, TokenVault, createPkce, authorizeDesktop, idIsValid };
