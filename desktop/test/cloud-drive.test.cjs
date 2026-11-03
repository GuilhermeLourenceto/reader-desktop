const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { CloudDrive, TokenVault, createPkce, authorizeDesktop, idIsValid } = require('../src/cloudDrive.cjs');

const clientId = '123456789-abcdef.apps.googleusercontent.com';
const secure = {
  isAsyncEncryptionAvailable: async () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptStringAsync: async text => Buffer.from('sealed:' + Buffer.from(text).toString('base64')),
  decryptStringAsync: async bytes => ({
    result: Buffer.from(bytes.toString().slice('sealed:'.length), 'base64').toString(),
  }),
};
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-cloud-test-')); }
function makeCloud(directory, fetchImpl = async () => new Response('', { status: 404 })) {
  return new CloudDrive({
    directory,
    clientId,
    safeStorage: secure,
    openExternal: async () => {},
    fetchImpl,
    readState: () => ({ novels: [], files: {} }),
    contentDirectory: directory,
    restoreFile: async filename => fs.readFileSync(filename),
  });
}

test('OAuth PKCE produces unique verifier, matching SHA256 challenge and state', () => {
  const a = createPkce(), b = createPkce();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.verifier, b.verifier);
  assert.ok(a.verifier.length >= 43 && a.verifier.length <= 128);
  assert.equal(a.challenge, createHash('sha256').update(a.verifier).digest('base64url'));
  assert.equal(idIsValid('../secrets'), false);
  assert.equal(idIsValid('abcD-12345_xyz'), true);
});

test('OAuth desktop flow rejects an invalid state and exchanges code with PKCE', async () => {
  let auth, token;
  const result = await authorizeDesktop({
    clientId,
    timeoutMs: 5000,
    openExternal: async url => {
      auth = new URL(url);
      assert.equal(auth.hostname, 'accounts.google.com');
      assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
      assert.equal(auth.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file');
      const callback = auth.searchParams.get('redirect_uri');
      assert.ok(callback.startsWith('http://127.0.0.1:'));
      const bad = await fetch(callback + '?state=invalid&code=bad');
      assert.equal(bad.status, 400);
      const good = await fetch(callback + '?state=' + auth.searchParams.get('state') + '&code=allowed');
      assert.equal(good.status, 200);
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://oauth2.googleapis.com/token');
      token = new URLSearchParams(options.body);
      return new Response(JSON.stringify({
        access_token: 'short-access-token',
        refresh_token: 'long-refresh-token',
        expires_in: 3600,
      }), { status: 200 });
    },
  });
  assert.equal(result.refresh_token, 'long-refresh-token');
  assert.equal(token.get('code'), 'allowed');
  assert.equal(token.get('redirect_uri'), auth.searchParams.get('redirect_uri'));
  assert.equal(
    createHash('sha256').update(token.get('code_verifier')).digest('base64url'),
    auth.searchParams.get('code_challenge'),
  );
});

test('encrypted refresh credentials persist separately and fail closed without a keyring', async () => {
  const directory = temp();
  try {
    const vault = new TokenVault({ directory, safeStorage: secure, platform: 'linux' });
    await vault.write({ refreshToken: 'private-refresh' });
    assert.equal((await vault.read()).refreshToken, 'private-refresh');
    assert.ok(!fs.readFileSync(vault.file, 'utf8').includes('private-refresh'));
    if (process.platform !== 'win32') assert.equal((fs.statSync(vault.file).mode & 0o777), 0o600);
    const unsafe = new TokenVault({
      directory, platform: 'linux',
      safeStorage: { ...secure, getSelectedStorageBackend: () => 'basic_text' },
    });
    assert.equal(await unsafe.available(), false);
    await assert.rejects(unsafe.read(), /chaveiro/);
    await vault.clear();
    assert.equal(vault.exists(), false);
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
});

test('cloud files are limited to LNReader ZIPs and approved folder; upload streams bytes', async () => {
  const directory = temp();
  const trace = [];
  const fileId = 'lnbackup123456';
  const folderId = 'lnfolder123456';
  const fixture = Buffer.from('fake zip bytes for transport test');
  const mock = async (url, options = {}) => {
    const u = new URL(url);
    trace.push({ pathname: u.pathname, method: options.method || 'GET' });
    if (u.pathname === '/drive/v3/files' && !options.method) {
      const query = u.searchParams.get('q');
      if (query.includes('application/vnd.google-apps.folder'))
        return new Response(JSON.stringify({ files: [{ id: folderId, name: 'LNReader Backups' }] }));
      return new Response(JSON.stringify({ files: [
        { id: fileId, name: 'LNReader-saved.zip', size: fixture.length, createdTime: '2026-11-03T10:00:00Z' },
        { id: 'other-app-file', name: 'private.docx' },
      ] }));
    }
    if (u.pathname === '/upload/drive/v3/files' && options.method === 'POST') {
      const metadata = JSON.parse(options.body);
      assert.deepEqual(metadata.parents, [folderId]);
      assert.equal(metadata.mimeType, 'application/zip');
      return new Response('', { status: 200, headers: {
        location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=abc',
      }});
    }
    if (u.pathname === '/upload/drive/v3/files' && options.method === 'PUT') {
      const chunks = [];
      for await (const chunk of options.body) chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks), fixture);
      assert.equal(options.headers['Content-Length'], String(fixture.length));
      return new Response(JSON.stringify({ id: fileId }), { status: 200 });
    }
    if (u.pathname === '/drive/v3/files/' + fileId) {
      if (u.searchParams.get('alt') === 'media') return new Response(fixture);
      return new Response(JSON.stringify({
        id: fileId, size: fixture.length,
        md5Checksum: createHash('md5').update(fixture).digest('hex'),
      }));
    }
    throw new Error('Unexpected Drive URL: ' + url);
  };
  try {
    const cloud = makeCloud(directory, mock);
    cloud.cachedToken = { value: 'test-access', expires: Date.now() + 600000 };
    await cloud.vault.write({ refreshToken: 'test-refresh' });
    const list = await cloud.list();
    assert.deepEqual(list.map(x => x.id), [fileId]);
    const local = path.join(directory, 'local.zip');
    fs.writeFileSync(local, fixture);
    assert.equal((await cloud.upload(local)).id, fileId);
    const restored = await cloud.restore(fileId);
    assert.deepEqual(restored, fixture);
    assert.deepEqual(await fsp.readdir(path.join(directory, 'cloud-backup-tmp')), []);
    await assert.rejects(cloud.restore('../untrusted'), /inválido/);
    assert.ok(trace.some(call => call.method === 'PUT'));
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
});

test('automatic backups are opt-in and daily, disconnected accounts cannot enable them', async () => {
  const directory = temp();
  try {
    const cloud = makeCloud(directory);
    await assert.rejects(cloud.setAutomatic(true), /Conecte/);
    assert.equal((await cloud.status()).automatic, false);
    await cloud.vault.write({ refreshToken: 'fixture' });
    await cloud.setAutomatic(true);
    let runs = 0;
    cloud.backup = async () => { runs++; cloud.preferences.lastBackupAt = new Date().toISOString(); };
    assert.equal(await cloud.automaticBackup(), true);
    assert.equal(await cloud.automaticBackup(), false);
    assert.equal(runs, 1);
    await cloud.disconnect();
    assert.equal((await cloud.status()).automatic, false);
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
});

test('missing developer OAuth client disables login rather than asking users for a key', async () => {
  const directory = temp();
  try {
    const cloud = new CloudDrive({
      directory, clientId: '', safeStorage: secure, openExternal: async () => {},
      readState: () => ({}), contentDirectory: directory,
    });
    assert.equal((await cloud.status()).configured, false);
    await assert.rejects(cloud.connect(), /desenvolvedor/);
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
});

test('Linux vault checks the initialized backend instead of trusting unknown/basic text', async () => {
  const directory = temp();
  try {
    let backend = 'unknown';
    const storage = {
      ...secure,
      getSelectedStorageBackend: () => backend,
      isAsyncEncryptionAvailable: async () => {
        backend = 'basic_text'; // initialized lazily after the first check
        return true;
      },
    };
    const vault = new TokenVault({ directory, platform: 'linux', safeStorage: storage });
    assert.equal(await vault.available(), false, 'No plaintext credential fallback');
    backend = 'unknown';
    storage.isAsyncEncryptionAvailable = async () => {
      backend = 'gnome_libsecret';
      return true;
    };
    assert.equal(await vault.available(), true);
    backend = 'unknown';
    storage.isAsyncEncryptionAvailable = async () => true;
    assert.equal(await vault.available(), false, 'Unknown Linux provider must fail closed');
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
});

test('Google Drive list is sorted by creation date, not by API result ordering', async () => {
  const directory = temp();
  const folderId = 'folder126789';
  const newestId = 'latest126789';
  const olderId = 'older126789';
  const mock = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname !== '/drive/v3/files' || options.method) throw Error('Unexpected request: ' + url);
    const q = parsed.searchParams.get('q');
    if (q.includes('application/vnd.google-apps.folder')) {
      return new Response(JSON.stringify({ files: [{ id: folderId }] }));
    }
    assert.ok(q.includes(folderId));
    assert.equal(parsed.searchParams.get('orderBy'), 'createdTime desc');
    return new Response(JSON.stringify({
      files: [
        { id: olderId, name: 'LNReader-older.zip', createdTime: '2025-02-01T12:00:00Z', size: 1024 },
        { id: 'other123456', name: 'secret.docx', createdTime: '2026-12-01T12:00:00Z', size: 99 },
        { id: newestId, name: 'LNReader-newer.zip', createdTime: '2026-11-03T12:00:00Z', size: 2048 },
      ],
    }));
  };
  try {
    const cloud = makeCloud(directory, mock);
    cloud.cachedToken = { value: 'test-access', expires: Date.now() + 600000 };
    await cloud.vault.write({ refreshToken: 'token' });
    const files = await cloud.list();
    assert.deepEqual(files.map(file => file.id), [newestId, olderId]);
    assert.deepEqual(files.map(file => file.size), [2048, 1024]);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
});
