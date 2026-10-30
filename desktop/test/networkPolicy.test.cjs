const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateNetworkUrl } = require('../src/networkPolicy.cjs');

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
