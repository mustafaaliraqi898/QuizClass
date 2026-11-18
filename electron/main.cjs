const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('node:path');
const PORT = Number(process.env.PORT || 3000);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
let mainWindow;
let serverStarted = false;
function startLocalServer() {
  if (serverStarted) return;
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(PORT);
  process.env.QUIZCLASS_DATA_DIR = path.join(app.getPath('userData'), 'app-data');
  process.env.QUIZCLASS_APP_ROOT = app.getAppPath();
  require(path.join(app.getAppPath(), 'electron', 'server.cjs'));
  serverStarted = true;
}
async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(LOCAL_URL, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch { await new Promise((resolve) => setTimeout(resolve, 300)); }
  }
  throw new Error('تعذر تشغيل خادم QuizClass المحلي. تحقق من عدم استخدام المنفذ 3000 من برنامج آخر ثم أعد المحاولة.');
}
async function createWindow() {
  startLocalServer();
  await waitForServer();
  mainWindow = new BrowserWindow({ width: 1440, height: 920, minWidth: 1024, minHeight: 700, show: false, title: 'QuizClass', backgroundColor: '#0f172a', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => url.startsWith(LOCAL_URL) ? { action: 'allow' } : { action: 'deny' });
  await mainWindow.loadURL(LOCAL_URL);
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try { await createWindow(); } catch (error) { console.error('QuizClass startup failed:', error); dialog.showErrorBox('تعذر تشغيل QuizClass', error.message || 'حدث خطأ غير متوقع أثناء تشغيل التطبيق.'); app.quit(); }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow().catch((error) => dialog.showErrorBox('تعذر تشغيل QuizClass', error.message || 'حدث خطأ غير متوقع.')); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
