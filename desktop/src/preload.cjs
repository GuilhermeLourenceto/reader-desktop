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
  chooseBackupDirectory: () => ipcRenderer.invoke('choose-backup-directory'),
  restore: () => ipcRenderer.invoke('restore'),
  sourceLogin: id => ipcRenderer.invoke('source-login', id),
  diagnostics: {
    list: options => ipcRenderer.invoke('diagnostics-list', options),
    report: event => ipcRenderer.invoke('diagnostics-report', event),
    export: () => ipcRenderer.invoke('diagnostics-export'),
    clear: () => ipcRenderer.invoke('diagnostics-clear'),
    copy: text => ipcRenderer.invoke('diagnostics-copy', text),
    openIssue: () => ipcRenderer.invoke('diagnostics-open-issue'),
  },
});
