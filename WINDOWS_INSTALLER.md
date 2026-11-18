# QuizClass Windows Desktop Installer

The installer is built from the latest application branch using GitHub Actions.
The desktop teacher interface runs in its own Electron window; student devices
continue to connect through a browser over the local Wi-Fi network.

## Build

Open the Actions tab and run **Build QuizClass Windows Installer**, or push to
`feature/electron-installer-latest`. Download the
`QuizClass-Windows-Installer` artifact after a successful run.

The SQLite database and uploaded media are stored in the current Windows user's
Electron application data directory, separate from the installation folder.

Unsigned builds may show Windows SmartScreen or publisher warnings. Do not disable
Windows Defender or Smart App Control globally. For a public release, configure a
trusted code-signing certificate using GitHub Actions secrets.
