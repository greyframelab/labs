'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('VLL_APP', {
  app: true,
  onStatus: (fn) => ipcRenderer.on('vll-status', (e, s) => fn(s)),
});
