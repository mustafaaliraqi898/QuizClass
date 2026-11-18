# QuizClass Android Port — Architecture Decision

## Status

Investigation in progress. No Android runtime or application behavior has been changed yet.

## Current application architecture

The current `main` branch is not a static React-only application:

- React 19 + TypeScript + Vite frontend.
- Express API server started by `server.ts`.
- Local SQLite database opened with Node's built-in `node:sqlite` / `DatabaseSync`.
- Socket.IO server for live classroom sessions.
- Local media storage for uploaded question and quiz images.
- Frontend services call the local `/api/*` endpoints and use Socket.IO.

A plain Capacitor WebView wrapper would therefore display the frontend but would not provide the existing API, database, media storage, or live-session server.

## Candidate architecture to validate

Keep the existing Express + SQLite + Socket.IO backend running locally inside the Android application, while Capacitor hosts the existing Vite-built frontend.

Candidate components:

1. Capacitor Android shell for the existing React/Vite UI.
2. An embedded Android Node.js runtime, started by a small native Android/Capacitor bridge.
3. The existing server bundle, launched by that runtime on a loopback-only port.
4. App-private Android storage for the SQLite database and uploaded media.
5. The WebView frontend connects to the local server; no public network is required for core local features.

A current Node.js 24 mobile runtime project advertises full Android builds and distinguishes a full flavor from a lite flavor. Its release notes explicitly say the lite flavor omits SQLite/Web Storage, so only the full flavor is a candidate for this app. Node.js 24 documents `node:sqlite` and `DatabaseSync`. This is a candidate, not yet a proven compatibility claim for QuizClass.

References:
- https://github.com/fogtape/nodejs-mobile
- https://github.com/fogtape/nodejs-mobile/releases
- https://nodejs.org/download/release/v24.22.1/docs/api/sqlite.html
- https://capacitorjs.com/docs/android

## Validation gates before full integration

1. Build a minimal Android test app that starts the embedded Node runtime.
2. From Node, verify `node:sqlite`, create a database in app-private storage, and read/write a test row.
3. Start a minimal Express HTTP server and verify the Capacitor WebView can call it through loopback.
4. Verify Socket.IO works between the embedded server and WebView.
5. Verify file uploads and media paths work in Android app-private storage.
6. Only after these pass, integrate the current QuizClass server and frontend.
7. Build a debug APK in GitHub Actions and install/test it on Android 12 hardware.

## Non-goals and safety

- Do not modify or merge into `main`.
- Do not remove or rewrite the Windows/Electron files as part of this Android port.
- Do not replace the database layer with browser storage or mock data.
- Do not claim offline support, successful APK generation, or feature parity until validated on an Android device.
- Keep the original question bank, quizzes, interactive learning, live sessions, results archive, and media behavior intact.

## Open technical risks

- The embedded Node runtime needs a maintained and reproducible Android integration path.
- The exact full runtime binary and native bridge must be pinned and verified.
- Native Node modules, if any are introduced, need Android ABI-compatible builds.
- Android lifecycle, process startup/shutdown, permissions, WebView origin policy, and local-server security need explicit handling.


## First Android-specific backend change

The Android branch now has an isolated entry point at `server/mobile.ts`:

- It requires absolute `QUIZCLASS_APP_ROOT` and `QUIZCLASS_DATA_DIR` paths supplied by the native host.
- It opens the existing SQLite database and media directories under the supplied app-private data directory.
- It serves the existing Vite production build and the existing API routes.
- It exposes `GET /health` for native/WebView readiness checks.
- It binds only to `127.0.0.1`, unlike the desktop/server entry point.
- It starts the same Socket.IO live-session service.
- It does not change `server.ts` or Electron behavior.

A separate `build:mobile-server` script bundles this entry point for Node 24 into the future Android assets location:
`android/app/src/main/assets/quizclass/server.cjs`.

This is source-level groundwork only. The Android project, embedded runtime binary, JNI bridge, and device validation are not present yet. The build script has not yet been executed in CI or on an Android device.
