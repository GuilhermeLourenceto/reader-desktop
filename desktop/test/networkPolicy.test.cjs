const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateNetworkUrl, validateResolvedAddresses, validateNetworkDns } = require('../src/infrastructure/networkPolicy.cjs');

test('permite sites, CDNs e provedores públicos com diferentes domínios', () => {
  for (const url of [
    'https://novels.example.org/capitulo',
    'https://cdn.example.net/imagem.png',
    'https://challenges.cloudflare.com/turnstile/v0/api.js',
    'https://accounts.google.com/',
    'http://site.example.com/',
  ]) assert.equal(validateNetworkUrl(url), url);
});
test('bloqueia rede local, endereços especiais e URLs com credenciais', () => {
  for (const url of [
    'http://127.0.0.1:7125/', 'http://localhost/',
    'http://192.168.1.10/', 'http://10.0.0.1/',
    'http://172.16.1.2/', 'http://169.254.169.254/',
    'http://[::1]/', 'http://[fc00::1234]/',
    'http://router.local/', 'http://intranet/',
    'file:///etc/passwd', 'https://user:pass@example.org/',
  ]) assert.throws(() => validateNetworkUrl(url));
});
test('testes locais podem solicitar explicitamente uma exceção', () => {
  assert.equal(validateNetworkUrl('http://127.0.0.1:3020/', { allowPrivate: true }),
    'http://127.0.0.1:3020/');
});

test('DNS público é aceito, mas respostas privadas ou mistas são bloqueadas', async () => {
  const publicAnswer = { resolvedAddresses: [{ address: '93.184.215.14' }, { address: '2606:2800:220:1:248:1893:25c8:1946' }] };
  assert.equal(validateResolvedAddresses(publicAnswer).length, 2);
  assert.equal(validateResolvedAddresses({ resolvedAddresses: [{ address: '::ffff:93.184.215.14' }] }).length, 1);
  for (const address of ['127.0.0.1', '10.1.2.3', '192.168.0.8', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1']) {
    assert.throws(() => validateResolvedAddresses({ resolvedAddresses: [{ address: '93.184.215.14' }, { address }] }), /DNS/);
  }
  assert.throws(() => validateResolvedAddresses({ resolvedAddresses: [] }), /DNS/);
  let resolved;
  await validateNetworkDns('https://cdn.example.org/a', async (host, opts) => {
    resolved = { host, opts };
    return publicAnswer;
  });
  assert.equal(resolved.host, 'cdn.example.org');
  assert.equal(resolved.opts.cacheUsage, 'disallowed');
  await assert.rejects(
    validateNetworkDns('https://evil.example.org', async () => ({
      resolvedAddresses: [{ address: '192.168.1.1' }],
    })),
    /DNS/,
  );
});

test('Electron 42 ResolvedHost.endpoints accepts public IPs and still blocks private ones', async () => {
  const { validateResolvedAddresses, validateNetworkDns } = require('../src/infrastructure/networkPolicy.cjs');
  const publicDns = {
    endpoints: [
      { address: '1.1.1.1', family: 'ipv4' },
      { address: '2606:4700:4700::1111', family: 'ipv6' },
    ],
  };
  assert.equal(validateResolvedAddresses(publicDns).length, 2);
  assert.equal(
    await validateNetworkDns('https://cdn.example.com', async () => publicDns),
    'https://cdn.example.com/',
  );
  for (const bad of ['127.0.0.1', '10.0.0.25', '192.168.1.20', '::1', 'fc00::1', '::ffff:127.0.0.1']) {
    assert.throws(() => validateResolvedAddresses({
      endpoints: [publicDns.endpoints[0], { address: bad }],
    }), /DNS da fonte retornou endereço local ou privado/);
  }
  assert.throws(() => validateResolvedAddresses({ endpoints: [] }), /Não foi possível validar o DNS/);
  assert.throws(() => validateResolvedAddresses({ endpoints: [{ family: 'ipv4' }] }), /DNS/);
});
