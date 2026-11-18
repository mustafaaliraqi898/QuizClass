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

The SDK must provide:

- `libnode.so` for each packaged ABI under `app/src/main/jniLibs/<abi>/`
- Node headers under `app/src/main/cpp/libnode/include/node/`

The runtime archive is deliberately not stored in Git.

## Prepare app assets

From the repository root:

```sh
npm run build
npm run build:mobile-server
npm run prepare:android-assets
```

This stages the Vite build and bundled backend under `app/src/main/assets/quizclass/`.

## Current validation status

This is an initial native host scaffold, not a validated Android app yet. A complete APK build requires the verified full Node SDK, Android SDK/NDK, Gradle build, and device/emulator checks for JNI startup, SQLite, HTTP, Socket.IO, and image uploads. Do not distribute an APK until those checks pass.
