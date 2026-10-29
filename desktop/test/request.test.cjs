const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { requestHTTP, RequestPool } = require('../src/request.cjs');
function fixture() {
  const requests = [];
  const net = {
    request: () => {
      const request = new EventEmitter();
      request.setHeader = () => {};
      request.write = () => {};
      request.end = () => {};
      request.abort = () => {
        request.aborted = true;
        request.emit('abort');
      };
      request.followRedirect = () => {};
      requests.push(request);
      return request;
    },
  };
  const respond = (index, content = 'body') => {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.headers = { 'content-type': ['text/plain'] };
    requests[index].emit('response', response);
    response.emit('data', Buffer.from(content));
    response.emit('end');
    return response;
  };
  return { net, requests, respond };
}
test('abort and timeout reject once and release the underlying connection', async () => {
  const { net, requests } = fixture();
  const controller = new AbortController();
  const promise = requestHTTP(
    net,
    'https://example.test',
    {},
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(promise, /cancelada/);
  assert.equal(requests[0].aborted, true);
  await assert.rejects(
    requestHTTP(net, 'https://example.test', {}, { timeoutMs: 5 }),
    /38 segundos/,
  );
  assert.equal(requests[1].aborted, true);
});
test('invalid redirects and oversized responses cannot crash the request callback', async () => {
  const { net, requests } = fixture();
  const bad = requestHTTP(net, 'https://example.test');
  requests[0].emit('redirect', 302, 'GET', 'http://[');
  await assert.rejects(bad);
  const large = requestHTTP(net, 'https://example.test', {}, { maxBytes: 3 });
  const response = new EventEmitter();
  response.statusCode = 200;
  response.headers = {};
  requests[1].emit('response', response);
  response.emit('data', Buffer.from('large'));
  response.emit('data', Buffer.from('late'));
  response.emit('end');
  await assert.rejects(large, /20 MB/);
  assert.equal(requests[1].aborted, true);
});
test('network pool bounds concurrency and cancels queued requests without opening them', async () => {
  const { net, requests, respond } = fixture();
  const pool = new RequestPool(net, 2, 3);
  const first = pool.run('https://example.test/1', { requestId: '1' });
  const second = pool.run('https://example.test/2', { requestId: '2' });
  const third = pool.run('https://example.test/3', { requestId: '3' });
  await assert.rejects(pool.run('https://example.test/4'), /Muitas/);
  assert.equal(requests.length, 2);
  pool.cancel('3');
  await assert.rejects(third, /cancelada/);
  respond(0);
  respond(1);
  await Promise.all([first, second]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pool.entries.size, 0);
  assert.equal(pool.active, 0);
  assert.equal(requests.length, 2);
});

test('source HTTP bridge refuses local addresses and redirect hops', async () => {
  const { net, requests } = fixture();
  await assert.rejects(
    requestHTTP(net, 'http://127.0.0.1:8000'),
    /locais|privados/,
  );
  assert.equal(requests.length, 0);
  const active = requestHTTP(net, 'https://novels.example.org');
  requests[0].emit('redirect', 302, 'GET', 'http://192.168.1.1/');
  await assert.rejects(active, /locais|privados/);
  assert.equal(requests[0].aborted, true);
});
test('HTTP bridge forwards the source-scoped Electron session', async () => {
  let configuredSession;
  const requests = [];
  const net = {
    request(options) {
      configuredSession = options.session;
      const request = new EventEmitter();
      request.setHeader = () => {};
      request.end = () => {};
      request.abort = () => request.emit('abort');
      request.followRedirect = () => {};
      requests.push(request);
      return request;
    },
  };
  const expected = { partition: 'persist:test-source' };
  const active = requestHTTP(
    net, 'https://novels.example.org', {},
    { requestSession: expected },
  );
  const response = new EventEmitter();
  response.statusCode = 200;
  response.headers = {};
  requests[0].emit('response', response);
  response.emit('data', Buffer.from('ok'));
  response.emit('end');
  await active;
  assert.equal(configuredSession, expected);
});

test('browser session user agent is reused for site requests without overriding extension headers', async () => {
  const observed = [];
  const net = { request() {
    const request = new EventEmitter();
    request.headers = {};
    request.setHeader = (key, value) => { request.headers[key.toLowerCase()] = value; };
    request.write = () => {};
    request.end = () => {};
    request.abort = () => request.emit('abort');
    request.followRedirect = () => {};
    observed.push(request);
    return request;
  }};
  const loginSession = { getUserAgent: () => 'LNReader-Test-Chromium/1.0' };
  const requestOne = requestHTTP(net, 'https://novels.example.org', {}, { requestSession: loginSession });
  assert.equal(observed[0].headers['user-agent'], loginSession.getUserAgent());
  const reply = index => {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.headers = {};
    observed[index].emit('response', response);
    response.emit('end');
  };
  reply(0);
  await requestOne;
  const requestTwo = requestHTTP(net, 'https://novels.example.org', {
    headers: { 'UsEr-AgEnT': 'Original-Source-UA' },
  }, { requestSession: loginSession });
  assert.equal(observed[1].headers['user-agent'], 'Original-Source-UA');
  reply(1);
  await requestTwo;
});
