const { app, dialog, Menu, Tray, shell } = require('electron');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
let serverStarted = false;
let tray = null;
let isQuitting = false;

// Prevent multiple local servers if the user clicks the desktop shortcut twice.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    void openBrowser();
  });
}

function startLocalServer() {
  if (serverStarted) return;

  // Keep user data outside the installation directory so updates do not
  // overwrite the SQLite database or uploaded media.
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(PORT);
  process.env.QUIZCLASS_DATA_DIR = path.join(app.getPath('userData'), 'app-data');
  process.env.QUIZCLASS_APP_ROOT = app.getAppPath();

  // Electron includes its own Node runtime; no separate Node.js install needed.
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

  throw new Error(
    'تعذر تشغيل خادم QuizClass المحلي. تحقق من عدم استخدام المنفذ 3000 من برنامج آخر ثم أعد المحاولة.'
  );
}

async function openBrowser() {
  try {
    await waitForServer();
    await shell.openExternal(LOCAL_URL);
  } catch (error) {
    dialog.showErrorBox(
      'تعذر تشغيل QuizClass',
      error.message || 'حدث خطأ غير متوقع أثناء تشغيل البرنامج.'
    );
  }
}

async function createTray() {
  try {
    const icon = await app.getFileIcon(process.execPath, { size: 'small' });
    tray = new Tray(icon);
    tray.setToolTip('QuizClass يعمل في الخلفية');
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: 'فتح QuizClass',
        click: () => { void openBrowser(); }
      },
      { type: 'separator' },
      {
        label: 'إغلاق QuizClass',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]));
    tray.on('double-click', () => { void openBrowser(); });
  } catch (error) {
    // The browser app remains usable even if Windows cannot create a tray icon.
    console.warn('QuizClass tray icon could not be created:', error);
  }
}

app.whenReady().then(async () => {
  try {
    app.setAppUserModelId('com.quizclass.desktop');
    startLocalServer();
    await waitForServer();
    await createTray();
    await shell.openExternal(LOCAL_URL);
  } catch (error) {
    dialog.showErrorBox(
      'تعذر تشغيل QuizClass',
      error.message || 'حدث خطأ غير متوقع أثناء تشغيل البرنامج.'
    );
    isQuitting = true;
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // There are no application windows: the local server stays available
  // until the user chooses "إغلاق QuizClass" from the system tray.
});

app.on('will-quit', () => {
  tray?.destroy();
  tray = null;
});
