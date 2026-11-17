# QuizClass Windows Desktop Packaging

The Windows installer is built by GitHub Actions; users do not need Node.js, Git,
Python, Visual Studio, or development tools installed.

## Build

1. Open the repository's Actions tab.
2. Run **Build QuizClass Windows Installer** using **Run workflow**, or push a
   version tag such as `v0.1.0`.
3. Download the `QuizClass-Windows-Installer` artifact from the completed run.

The installer packages the React/Vite interface and the local Express + Socket.IO
server inside Electron. The server listens on the LAN interfaces on port 3000 so
student phones can join through the laptop's Wi-Fi hotspot.

User data is stored under Electron's per-user application data directory
(`QuizClass/app-data`), not in the installation folder. This keeps the SQLite
database and uploaded media separate from application updates.

## Important

The installer build does not itself configure Windows Firewall or turn on the
Windows Mobile Hotspot. Those steps must be checked on the target Windows laptop.
A real phone-on-hotspot test is required before declaring LAN operation verified.
