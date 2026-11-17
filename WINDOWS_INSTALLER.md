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

## Windows code signing

Unsigned test builds can be blocked by Windows Smart App Control or show publisher
warnings. A successful build does not mean Windows has verified the publisher.

For signed release builds, obtain a code-signing certificate from a trusted
certificate authority. Store the certificate as a password-protected PKCS#12
(`.p12` or `.pfx`) file, then add these repository Actions secrets:

- `WINDOWS_CERTIFICATE_BASE64`: Base64 encoding of the complete certificate file.
- `WINDOWS_CERTIFICATE_PASSWORD`: The certificate's export password.

The workflow decodes the certificate only on the temporary GitHub Actions runner
and passes it to electron-builder through its standard `CSC_LINK` and
`CSC_KEY_PASSWORD` environment variables. Never commit the certificate, its
password, or a decoded certificate file to the repository.

A certificate allows Windows to verify the publisher and signature. Smart App
Control/reputation decisions can still depend on Microsoft's trust and reputation
systems; signing alone is not a promise that every warning disappears immediately.

## Important

The installer build does not itself configure Windows Firewall or turn on the
Windows Mobile Hotspot. Those steps must be checked on the target Windows laptop.
A real phone-on-hotspot test is required before declaring LAN operation verified.
