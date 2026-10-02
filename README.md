# Insta Reals

A short-form video app built with Expo/React Native and a NestJS API. The local
demo has two accounts, persistent social activity and messages, and real video
uploads. Each app has its own npm package and lockfile.

## Run locally

Use **Node 22.18 or newer within Node 22.x**. With nvm, run `nvm install` and
`nvm use` from this repository; `.nvmrc` selects Node 22.

In terminal 1, from `Insta-Reals/`:

```bash
cd backend
npm ci
npm run demo
```

The launcher starts a local PostgreSQL runtime on port **5433**, applies the
Prisma migration and starts the API on **3000**. Docker and provider accounts
are not required. Keep this terminal running. `Ctrl+C` stops the API and flushes
the database to disk.

In terminal 2, from `Insta-Reals/`:

```bash
cd mobile
npm ci
npm start -- --clear
```

Press **w** for the browser. For a phone, use an Expo Go version compatible with
SDK 57 and scan the QR code. Keep the phone and computer on the same Wi-Fi.
The mobile app normally finds the API from Expo's development host.

If that address is unreachable, copy `mobile/.env.example` to `mobile/.env` and
set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000/v1`, then restart
Expo. For explicit media URLs, set `API_PUBLIC_URL=http://YOUR_COMPUTER_LAN_IP:3000`
in `backend/.env` and restart the backend. See [backend setup](backend/README.md)
and [mobile setup](mobile/README.md) for details.

## Try the features

1. Choose **Continue as Alex**. Swipe the feed; tap to pause or resume, unmute,
   like a clip and leave a comment.
2. Find **Sam** in Discover people, follow them and send a message from their
   profile. Edit your own profile from the **You** tab.
3. Open **Create**, pick an MP4, MOV or WebM video and upload it. Once ready, it
   appears on your profile and in the feed.
4. Open **You** → **Watch history** after watching a clip for a few seconds.
   **For you** uses an explicit ranking based on follows, likes and watch history.
5. Use **Switch demo account** on **You**, then continue as Sam. Open **Inbox**
   to read and reply. Conversations poll while visible; their history remains
   available after switching accounts and restarting the backend.

The demo uses the same Prisma services and relational migration as a normal
PostgreSQL deployment. Its PGlite PostgreSQL runtime serves the database over
PostgreSQL's wire protocol. Profiles, likes, comments, follows, messages and
history persist in `backend/.data/postgres`; video files persist in
`backend/.data/videos`. These directories are ignored by Git.

The starter feed contains credited Blender Foundation sample films with **no
app account owner**. Internet access is needed to stream those external clips.
Local uploads belong to the authenticated uploader. Demo accounts and local
uploads are explicitly development-only.

## Provider configuration and limits

Clerk, Pexels and Mux adapters are implemented, but no Clerk project or provider
credentials were supplied for this build. Live provider flows have not been
verified. Set the values described in the apps' `.env.example` files to use
Clerk sign-in, credited Pexels clips and Mux streaming/webhooks. Put server secrets
only in `backend/.env`; mobile `EXPO_PUBLIC_` values are public.

This is a working local learning project. Production setup and an actual
iOS/Android device review remain outstanding. Native exports confirm that the
bundles build; they do not substitute for device testing. The mobile dependency
audit currently reports **14 moderate findings** requiring compatibility review
before deployment.

## Checks

From `mobile/`:

```bash
npm run typecheck
npm run lint
npx expo export --platform all
```

From `backend/`:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run demo:test
```

Stop `npm run demo` before running `demo:test`: the test launcher owns the same
database port. It starts the local database, runs API integration tests and stops
the database afterwards. See [the API contract](API_CONTRACT.md) for routes and
response shapes.

## Collaboration

The default split is mobile for you and backend for your friend. For this build,
you explicitly authorized Codex to implement both apps; Codex also owns this
documentation change. The first proof of concept is on
`first-proof-of-concept-demo`. You explicitly authorized Codex to create this
branch, commit the demo and push it. You retain subsequent Git actions unless
you authorize a specific action. PR creation and merging remain for human review.

Review the changes, run the checks, and test on a device before merging. Never
commit `.env`, provider keys, `.data`, `node_modules` or generated exports.
