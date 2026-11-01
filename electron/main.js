const {app, BrowserWindow, dialog, ipcMain, shell} = require('electron');
const {spawn, spawnSync} = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const GFX_MODULE = path.join(__dirname, 'python', 'pyide_gfx.py');

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.wasm': 'application/wasm',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=utf-8'
};

// Интерфейс отдаётся с 127.0.0.1, чтобы работал как обычная веб-страница (воркеры, fetch, wasm)
const startServer = () => new Promise((resolve, reject) => {
	const server = http.createServer((request, response) => {
		const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
		const file = path.normalize(path.join(BUILD_DIR, pathname === '/' ? 'editor.html' : pathname));
		if (!file.startsWith(BUILD_DIR)) {
			response.writeHead(403);
			response.end();
			return;
		}
		fs.readFile(file, (error, data) => {
			if (error) {
				response.writeHead(404);
				response.end();
				return;
			}
			response.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
			response.end(data);
		});
	});
	server.on('error', reject);
	server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

// Ищем настоящий Python на этом компьютере
const findPython = () => {
	const candidates = process.platform === 'win32' ?
		[['python', []], ['py', ['-3']], ['python3', []]] :
		[['python3', []], ['python', []]];
	for (const [command, prefix] of candidates) {
		const result = spawnSync(command, [...prefix, '--version'], {encoding: 'utf8', timeout: 5000});
		if (result.status === 0) {
			return {found: true, command, prefix, version: (result.stdout || result.stderr).trim()};
		}
	}
	return {found: false};
};

let python = null;
let child = null;
let workDir = null;

const send = (channel, payload) => {
	for (const window of BrowserWindow.getAllWindows()) {
		window.webContents.send(channel, payload);
	}
};

const stopProgram = () => {
	if (child) {
		child.kill();
		child = null;
	}
};

ipcMain.handle('py:info', () => {
	if (!python) python = findPython();
	return python.found ? {found: true, version: python.version} : {found: false};
});

ipcMain.handle('py:run', (event, code) => {
	if (!python) python = findPython();
	if (!python.found) return {started: false, error: 'Python не найден. Установи Python 3 и перезапусти приложение.'};
	stopProgram();

	if (!workDir) workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pyide-'));
	fs.copyFileSync(GFX_MODULE, path.join(workDir, 'pyide_gfx.py'));
	fs.writeFileSync(path.join(workDir, 'main.py'), code, 'utf8');

	const current = spawn(python.command, [...python.prefix, '-u', 'main.py'], {
		cwd: workDir,
		env: Object.assign({}, process.env, {PYTHONIOENCODING: 'utf-8', PYTHONPATH: workDir})
	});
	child = current;
	current.stdout.setEncoding('utf8');
	current.stderr.setEncoding('utf8');
	current.stdout.on('data', text => send('py:data', {stream: 'stdout', text}));
	current.stderr.on('data', text => send('py:data', {stream: 'stderr', text}));
	current.stdin.on('error', () => {});
	current.on('error', error => {
		send('py:data', {stream: 'stderr', text: `${error.message}\n`});
	});
	current.on('close', (exitCode, signal) => {
		if (child === current) child = null;
		send('py:exit', {code: exitCode, signal});
	});
	return {started: true};
});

ipcMain.handle('py:input', (event, text) => {
	if (child) child.stdin.write(`${text}\n`);
});

ipcMain.handle('py:stop', () => stopProgram());

ipcMain.handle('file:save', async (event, {defaultName, filters, data}) => {
	const result = await dialog.showSaveDialog({defaultPath: defaultName, filters});
	if (result.canceled || !result.filePath) return {saved: false};
	fs.writeFileSync(result.filePath, typeof data === 'string' ? data : Buffer.from(data));
	return {saved: true, path: result.filePath};
});

ipcMain.handle('file:open', async (event, {filters}) => {
	const result = await dialog.showOpenDialog({properties: ['openFile'], filters});
	if (result.canceled || result.filePaths.length === 0) return null;
	const file = result.filePaths[0];
	return {name: path.basename(file), data: new Uint8Array(fs.readFileSync(file))};
});

const createWindow = async () => {
	const port = await startServer();
	const window = new BrowserWindow({
		width: 1280,
		height: 800,
		backgroundColor: '#111318',
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	window.webContents.setWindowOpenHandler(({url}) => {
		shell.openExternal(url);
		return {action: 'deny'};
	});
	await window.loadURL(`http://127.0.0.1:${port}/editor.html`);
};

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
	stopProgram();
	if (workDir) fs.rmSync(workDir, {recursive: true, force: true});
	app.quit();
});
