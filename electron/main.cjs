const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
let mainWindow;
let serverStarted = false;

function startLocalServer() {
  if (serverStarted) return;
  // Keep all user data outside the installation directory so updates/uninstalls
  // do not overwrite the SQLite database or uploaded media.
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(PORT);
  process.env.QUIZCLASS_DATA_DIR = path.join(app.getPath('userData'), 'app-data');
  process.env.QUIZCLASS_APP_ROOT = app.getAppPath();

  // The bundled server starts Express + Socket.IO on 0.0.0.0.
  // Requiring it keeps it inside Electron's bundled Node runtime; no Node.js
  // installation is required on the user's computer.
  require(path.join(app.getAppPath(), 'electron', 'server.cjs'));
  serverStarted = true;
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(LOCAL_URL, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error('تعذر تشغيل خادم QuizClass المحلي. تحقق من عدم استخدام المنفذ 3000 من برنامج آخر ثم أعد المحاولة.');
}

async function createWindow() {
  startLocalServer();
  await waitForServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'QuizClass',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Keep the teacher interface inside the desktop app. Student devices
    // connect independently through the LAN address and browser.
    if (!url.startsWith(LOCAL_URL)) return { action: 'deny' };
    return { action: 'allow' };
  });

  await mainWindow.loadURL(LOCAL_URL);
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try {
    await createWindow();
  } catch (error) {
    console.error('QuizClass startup failed:', error);
    dialog.showErrorBox('تعذر تشغيل QuizClass', error.message || 'حدث خطأ غير متوقع أثناء تشغيل التطبيق.');
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        dialog.showErrorBox('تعذر تشغيل QuizClass', error.message || 'حدث خطأ غير متوقع.');
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
