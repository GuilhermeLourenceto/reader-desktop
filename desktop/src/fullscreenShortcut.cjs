// F11 toggles the entire application window, independently of the current view.
function installFullscreenShortcut(window) {
  const handler = (event, input) => {
    if (input?.key !== 'F11' && input?.code !== 'F11') return;
    event.preventDefault();
    if (input.type === 'keyDown' && !input.isAutoRepeat && !window.isDestroyed()) {
      window.setFullScreen(!window.isFullScreen());
    }
  };
  window.webContents.on('before-input-event', handler);
  return () => window.webContents.removeListener('before-input-event', handler);
}

module.exports = { installFullscreenShortcut };
