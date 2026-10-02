# Insta Reals mobile

Expo SDK 57, React Native, TypeScript and Expo Router. The app now has a vertical
video feed, profiles, search, likes, comments, follows, uploads, messages, watch
history and a recommended feed. Screens use the real backend API, with loading,
empty, error and retry states.

## Install and run

Use **Node 22.18+ on the 22.x line** so both apps use a compatible runtime.
From `Insta-Reals/`, nvm users can run `nvm install` and `nvm use`.

First start the backend in its own terminal:

```bash
cd backend
npm ci
npm run demo
```

In another terminal, from `Insta-Reals/`:

```bash
cd mobile
npm ci
npm start -- --clear
```

Press **w** for a browser preview, or scan the QR code with an Expo Go version
compatible with SDK 57. Other options are `npm run ios` for an installed Xcode
simulator and `npm run android` for a running Android emulator.

Choose **Alex** or **Sam** on the welcome screen. The backend saves their
profiles, social actions, uploads and private conversations in its local
PostgreSQL database. Switch accounts from Profile to try both sides of a chat.
The inbox and active conversation poll every five seconds while visible.
Messages and comments have controls to load older pages.

Upload a video from Create, then check your Profile and the feed. The demo accepts
MP4, MOV and WebM files up to 100 MB. External sample films remain credited to
their original creators and are not presented as app users.

## API address and authentication

The API defaults to Expo's development host on port 3000 with the `/v1` prefix.
If your phone cannot reach it, copy `.env.example` to `.env` and set:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000/v1
```

Restart Expo after changing environment values. The phone and computer should
share a network. `localhost` on a phone refers to the phone itself.

Leave `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` empty for the labelled local demo.
To use Clerk, supply a publishable key and configure verification credentials
for the same Clerk project in `backend/.env`. Clerk sign-in, Pexels and Mux
adapters still need live credentials and provider testing. Never put server
secrets in mobile; all `EXPO_PUBLIC_` values are visible to app users.

## Check before committing

```bash
npm run typecheck
npm run lint
node --test src/features/feed/playback-request.test.cjs
npx expo install --check
npx expo-doctor
npx expo export --platform all
```

Exports go into ignored `dist/`. Expo also generates ignored `.expo/` files.
Commit this app's `package-lock.json` so `npm ci` reproduces dependencies.
Build checks and successful iOS/Android exports do not confirm native device
behavior; check playback, keyboard layout, uploads and account switching on an
actual device before merging.

The current mobile dependency audit reports **14 moderate findings** in
transitive dependencies. The previous scaffold recorded 13. Resolve these with
an Expo compatibility review before deployment; do not force a major-version
change through an automatic audit repair.

## Code layout

- `app/(tabs)/`: feed, people, Create, inbox and your profile.
- `app/users`, `app/comments`, `app/conversations`, `app/video`: detail routes.
- `src/auth/`: demo sessions, Clerk sessions and the welcome screen.
- `src/features/`: playback, social lists and messaging.
- `src/lib/`: authenticated HTTP requests and resource loading.
- `src/components/`: shared controls and dark theme.
- `src/types.ts`: mobile API response types.

The apps have separate npm packages and lockfiles. Humans own all Git actions;
see the [root README](../README.md) and [API contract](../API_CONTRACT.md).
