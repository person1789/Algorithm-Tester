import { ipcRenderer } from 'electron'

// Expose IPC renderer
window.ipcRenderer = ipcRenderer
