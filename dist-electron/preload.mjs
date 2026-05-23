let electron = require("electron");
//#region electron/preload.js
window.ipcRenderer = electron.ipcRenderer;
//#endregion
