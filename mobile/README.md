# SGAM mobile

Android app. It is the **same web client**, built and packaged inside a native shell by
[Capacitor](https://capacitorjs.com) — not a rewrite. Every screen, every fix and every new
feature in `client/` shows up here on the next `npm run sync`, because there is only one UI
codebase.

```
mobile/
  capacitor.config.json   appId, appName, webDir
  api-url.txt             the API the APK talks to (not gitignored — it is not a secret)
  assets/icon.svg         source for every launcher icon and splash screen
  scripts/build-web.mjs   builds client/ and copies the result into www/
  scripts/build-apk.mjs   finds the Android SDK, then runs Gradle
  android/                the native project Capacitor generates
  www/                    the built client (gitignored — regenerated every build)
```

## Why Capacitor and not React Native

React Native would mean rewriting all ~40 screens in components that do not exist here —
`View`/`Text` instead of `div`/`span`, no Tailwind, no React Router, no React Query cache shared
with the web. That is a second frontend to maintain, and it would not have been finished for this
course. Capacitor ships the client that already works.

The trade-off is honest: this is a WebView, so it will not feel quite like a native app, and it
has no access to native APIs until a plugin is added. For a project-management app that is almost
all lists, forms and text, that costs very little.

## Build an APK

Needs the **Android SDK** (install Android Studio once) and **JDK 17 exactly** — see below.

### The JDK version is pinned, and it is not arbitrary

This is on **Capacitor 6**, which compiles against Java 17. Capacitor 7 and 8 compile against
Java 21 and fail on a JDK 17 machine with:

```
error: invalid source release: 21
```

The development machine here has JDK 17, so 6 is the version that builds. To move up, install
JDK 21 first, then:

```bash
npm i @capacitor/core@latest @capacitor/android@latest
npm i -D @capacitor/cli@latest
rm -rf android && npx cap add android
npx capacitor-assets generate --android
```

Nothing in `client/` changes — the shell is the only thing with a version.

```bash
cd mobile
npm install
npm run apk
```

That builds the client against the API in `api-url.txt`, copies it into `www/`, syncs it into the
native project and runs Gradle. The APK lands at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to a phone and open it — Android will ask you to allow installing from this source — or
`adb install -r <path>` with the phone plugged in.

The first build downloads Gradle itself and takes several minutes. Later builds take seconds.

## Point it at a different API

The APK has no server of its own, so the API address is **baked in at build time**. A relative
`/api` cannot work the way it does in the browser.

```bash
echo https://pm-api-zdtj.onrender.com/api > api-url.txt   # the default
API_URL=https://my-other-api.com/api npm run apk          # just for one build
```

It must be `https`. Android 9+ blocks cleartext HTTP, and `allowMixedContent` is off in the
config on purpose.

## Working on it day to day

```bash
npm run sync     # rebuild the web bundle into the native project
npm run open     # open the project in Android Studio (emulator, logcat, device debugging)
npm run doctor   # Capacitor's own environment check
```

To watch the live dev server on a phone instead of a bundled build, add `server.url` to
`capacitor.config.json` pointing at your machine's LAN address, run `npm run sync`, and remove it
before building anything you intend to hand out.

## Things that will bite you

- **The API must allow the native origin.** A Capacitor app reports `https://localhost` on
  Android and `capacitor://localhost` on iOS. `server/src/config/cors.ts` names both in
  `NATIVE_ORIGINS`; without that the app opens to a blank screen with CORS errors in logcat and
  nothing on screen to explain it.
- **Changing `client/` is not enough.** The APK carries a copy of the build. Run `npm run sync`
  (or `npm run apk`) or the phone keeps showing the old UI.
- **Icons come from `assets/icon.svg`.** After changing it, run
  `npx capacitor-assets generate --android` to regenerate all 74 files.
- **`android/` is committed, `android/build/` is not.** The native project is part of the repo so
  a teammate does not need to re-run `cap add android`; the build output is noise.

## Releasing to the Play Store

Out of scope for the course, and it needs things this repo does not have: a $25 developer
account, a signing keystore kept out of git, a privacy policy URL, and a bundle
(`./gradlew bundleRelease`) rather than a debug APK. The debug APK is signed with Android's
throwaway debug key — fine for sideloading onto a phone for a demo, and refused by the Play Store.

## iOS

`npx cap add ios` would work, but building it needs a Mac with Xcode and a $99/year Apple
Developer account to run on a real device. Nothing in the code is Android-specific.
