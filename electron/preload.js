const {contextBridge, ipcRenderer} = require('electron');

const subscribe = (channel, callback) => {
	const handler = (event, payload) => callback(payload);
	ipcRenderer.on(channel, handler);
	return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('pyide', {
	pythonInfo: () => ipcRenderer.invoke('py:info'),
	run: code => ipcRenderer.invoke('py:run', code),
	sendInput: text => ipcRenderer.invoke('py:input', text),
	stop: () => ipcRenderer.invoke('py:stop'),
	onData: callback => subscribe('py:data', callback),
	onExit: callback => subscribe('py:exit', callback),
	saveFile: options => ipcRenderer.invoke('file:save', options),
	openFile: options => ipcRenderer.invoke('file:open', options)
});
