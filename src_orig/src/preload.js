const { ipcRenderer, contextBridge } = require('electron');

console.log("preload.js loaded");

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel, listener) => {
      if (typeof channel === 'string' && typeof listener === 'function') {
        ipcRenderer.on(channel, listener);
      } else {
        console.error('Invalid arguments for ipcRenderer.on');
      }
    },
    send: (channel, ...args) => {
      if (typeof channel === 'string') {
        ipcRenderer.send(channel, ...args);
      } else {
        console.error('Invalid arguments for ipcRenderer.send');
      }
    },
    // Add other methods that we need to expose
  }
});
