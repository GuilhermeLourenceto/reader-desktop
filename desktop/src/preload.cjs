const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  onBeforeClose: callback => {
    const listener = () => callback();
    ipcRenderer.on('before-close', listener);
    return () => ipcRenderer.removeListener('before-close', listener);
  },
  finishClose: () => ipcRenderer.send('finish-close'),
  load: options => ipcRenderer.invoke('load', options),
  info: () => ipcRenderer.invoke('info'),
  save: state => ipcRenderer.invoke('save', state),
  file: (action, path, content) =>
    ipcRenderer.invoke('file', action, path, content),
  request: (url, init) => ipcRenderer.invoke('request', url, init),
  cancelRequest: id => ipcRenderer.invoke('cancel-request', id),
  cancelRequests: () => ipcRenderer.invoke('cancel-requests'),
  backup: state => ipcRenderer.invoke('backup', state),
  restore: () => ipcRenderer.invoke('restore'),
  driveStatus: () => ipcRenderer.invoke('drive-status'),
  driveConnect: () => ipcRenderer.invoke('drive-connect'),
  driveDisconnect: () => ipcRenderer.invoke('drive-disconnect'),
  driveList: () => ipcRenderer.invoke('drive-list'),
  driveBackup: () => ipcRenderer.invoke('drive-backup'),
  driveRestore: (id) => ipcRenderer.invoke('drive-restore', id),
  driveAutomatic: (enabled) => ipcRenderer.invoke('drive-automatic', enabled),
  sourceLogin: id => ipcRenderer.invoke('source-login', id),
});
