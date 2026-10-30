const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installFullscreenShortcut } = require('../src/fullscreenShortcut.cjs');

test('F11 alterna tela cheia do aplicativo em qualquer aba', () => {
  const webContents = new EventEmitter();
  let fullscreen = false;
  const window = {
    webContents,
    isDestroyed: () => false,
    isFullScreen: () => fullscreen,
    setFullScreen: value => { fullscreen = value; },
  };
  const detach = installFullscreenShortcut(window);
  const key = (name, type = 'keyDown', isAutoRepeat = false) => {
    let prevented = false;
    webContents.emit('before-input-event', { preventDefault: () => { prevented = true; } }, {
      key: name, type, isAutoRepeat,
    });
    return prevented;
  };
  assert.equal(key('a'), false);
  assert.equal(fullscreen, false);
  assert.equal(key('F11'), true);
  assert.equal(fullscreen, true);
  key('F11', 'keyDown', true);
  key('F11', 'keyUp');
  assert.equal(fullscreen, true);
  assert.equal(key('F11'), true);
  assert.equal(fullscreen, false);
  detach();
  assert.equal(key('F11'), false);
  assert.equal(fullscreen, false);
});
