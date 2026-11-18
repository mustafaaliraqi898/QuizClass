# QuizClass Android host (work in progress)

This directory is the native Android host for the Android-only branch. It is intentionally separate from Electron.

## Current structure

- Kotlin Activity hosts the WebView.
- C++ JNI bridge starts the embedded Node runtime using `node::Start()`.
- The Node server is expected to run on `127.0.0.1:3000`.
- The WebView waits for `GET /health` before loading the local application.
- App data is stored below Android's private `filesDir`.

## Required runtime inputs (not committed)

The full Node.js Mobile Android SDK must be downloaded from the pinned release and verified using that release's `SHA256SUMS`. Do not use the lite archive: QuizClass requires `node:sqlite`.

The SDK must provide `libnode.so`, any adjacent shared-library dependencies, and Node headers. The `Android APK (embedded Node.js)` GitHub Actions workflow downloads the pinned full archive, verifies its archive checksum against the release `SHA256SUMS`, stages the ABI libraries and headers, and assembles a debug APK. Runtime binaries are deliberately not stored in Git.

The current app scaffold sets Android-specific `TMPDIR`, `HOME`, persistent database/media storage under `noBackupFilesDir`, a cache directory for the V8 compile cache, and the Node working directory before calling `node::Start()`.

## Prepare app assets

From the repository root:

```sh
npm run build
npm run build:mobile-server
npm run prepare:android-assets
```

This stages the Vite build and bundled backend under `app/src/main/assets/quizclass/`.

## Current validation status

This is an initial native host scaffold. The automated APK workflow has been added but has not yet been observed completing successfully. Even if Gradle assembles an APK, runtime behavior still requires device/emulator checks for JNI startup, SQLite, HTTP, Socket.IO, and image uploads. Do not distribute an APK until those checks pass.
