# Insta Reals mobile

Phase 0 mobile baseline: Expo SDK 57, React Native, TypeScript, and Expo Router.
The app opens one branded launch screen. Backend integration starts in the next
milestone; no server or API keys are needed to run this scaffold.

## Install

Use Node.js 22 LTS (22.13.0 or newer) and npm. If you use nvm, `.nvmrc` selects
Node 22. From the shared `Insta-Reals/` repository:

```sh
cd mobile
nvm install # nvm users only
nvm use     # nvm users only
npm ci
```

If you installed Node 22 directly, skip the two nvm commands.

## Run

From `mobile/`:

```sh
npm start
```

Install the SDK 57 version of Expo Go on your phone, sign in if prompted, and
scan the terminal QR code. Keep the phone and computer on the same network.
The expected screen says **Insta Reals** and **A new perspective.**

Other launch options:

```sh
npm run web     # browser preview
npm run ios     # iOS Simulator; requires Xcode and an installed simulator
npm run android # Android emulator; requires Android Studio and a running emulator
```

The browser preview is useful for checking setup; still verify the app on an
iOS or Android device before merging the mobile baseline.

## Check before committing

```sh
npm run typecheck
npm run lint
npx expo install --check
npx expo-doctor
npx expo export --platform all
```

Exports go into the ignored `dist/` directory. Expo generates `.expo/` and
`expo-env.d.ts`; these are also ignored. Keep this package's `package-lock.json`
in Git so teammates can reproduce the installation with `npm ci`.

On 2026-10-01, `npm audit` reports 13 moderate findings inherited from Expo's
`xcode`/`uuid` tooling and Router's `query-string`/`decode-uri-component`
dependencies. The suggested automatic repair downgrades Expo across major
versions; resolving these findings needs a separate compatibility review before
deployment. The audit result is separate from the build and Expo Doctor checks.

## Files

- `app/_layout.tsx`: the Expo Router stack and status bar.
- `app/index.tsx`: the launch screen.
- `app.json`: app identity, portrait orientation, and Router configuration.
- `.env.example`: the future public API base URL, unused by this scaffold.

Each file in `app/` is a route. Add feature logic under `src/` when its milestone
arrives; keep screen components small.

## Team split

The mobile developer owns `mobile/**`; the backend developer owns `backend/**`.
Each app has its own npm package and lockfile. Root documentation and contract
changes need an agreed owner before either branch edits them. All commits,
pushes, pull requests, and merges are performed by the developers.

For a later API integration, copy `.env.example` to `.env` and set
`EXPO_PUBLIC_API_BASE_URL` to the backend's reachable `/v1` URL. A physical phone
needs the backend computer's LAN address rather than `localhost`. Values prefixed
with `EXPO_PUBLIC_` are public; keep backend secrets out of this package.

Setup references: [Expo Router installation](https://docs.expo.dev/router/installation/),
[SDK compatibility](https://docs.expo.dev/versions/latest/), and
[Expo Go for SDK 57](https://expo.dev/changelog/expo-go-57-login).
