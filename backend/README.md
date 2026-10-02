# Backend

NestJS REST API with PostgreSQL/Prisma persistence. The mobile API is documented
in [`../API_CONTRACT.md`](../API_CONTRACT.md).
NestJS and TypeScript API for the short-form video app.

## Run the complete local demo

Use Node **22.18 or newer on the 22.x release line**. No Clerk, Docker, Pexels,
Mux, or externally hosted database account is needed for this demo.

```bash
cd backend
npm ci
npm run demo
npm install
cp .env.example .env
# Replace the placeholder CLERK_SECRET_KEY in .env with your Clerk secret key.
npm run start:dev
```

Keep the terminal running. The launcher starts a local PostgreSQL server on
`127.0.0.1:5433`, applies the committed migration, builds Nest, and starts the API
on port `3000`. `Ctrl+C` stops both processes and flushes the database to disk.
The local database uses the PGlite PostgreSQL runtime also used by Prisma's
development server, served over PostgreSQL's wire protocol. All application
queries use the same Prisma services and migration as a normal PostgreSQL
deployment; there is no separate in-memory API.

Two development accounts, **Alex** and **Sam**, are available in mobile. Tokens
are signed with a randomly generated key saved in `.data/demo-signing-secret`
and expire after 24 hours. Profiles, follows, likes, comments, video history,
uploads and messages persist in `.data/postgres` across restarts. Uploaded
video bytes persist in `.data/videos`. `.data` is ignored by Git.

The demo feed starts with three externally hosted Blender Foundation films,
credited with their Creative Commons licenses. These sample sources have no
app owner. With `PEXELS_API_KEY` set, the Pexels adapter supplies credited stock
videos instead. Internet connectivity is required to play external clips.

For a phone on the same Wi-Fi, put your Mac's LAN IP in `mobile/.env` as
`EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:3000/v1`. You can also copy
`.env.example` to `.env` and set `API_PUBLIC_URL=http://YOUR_MAC_IP:3000` here.
That URL is used in upload and media responses. The API listens on all network
interfaces; the database listens only on loopback. `PORT` and
`DEMO_DATABASE_PORT` are configurable if a port is occupied. Run one demo
launcher per database directory.

The public health route is `GET http://localhost:3000/v1/health`.

`GET http://localhost:3000/v1/me` requires a Clerk session token:

Expected response:

```json
{ "status": "ok" }
```

## Configure real providers

Copy `.env.example` to `.env`, set `DATABASE_URL`, and keep `DEMO_MODE=false`.
Use `npm run db:migrate` followed by `npm run start:dev`, or `npm run build`
followed by `npm run start:prod` for a built server. Set `NODE_ENV=production`
in deployments. Demo mode and the local launcher refuse production use.

- **Clerk:** set `CLERK_SECRET_KEY` or a PEM `CLERK_JWT_KEY`. The backend verifies
  Clerk tokens and creates a local user from the trusted subject. Optional
  `CLERK_AUTHORIZED_PARTIES` limits expected session origins. Clerk secret keys
  belong only in this backend environment; mobile receives a publishable key.
- **Pexels:** set `PEXELS_API_KEY`. Stock metadata is cached for 15 minutes and
  upserted by provider ID. A provider outage keeps persisted feed metadata and
  retries after a minute. Creator credit and an external attribution link are
  preserved; external creators are never presented as app accounts.
- **Mux:** set `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and `MUX_WEBHOOK_SECRET`.
  Register the public HTTPS URL `API_PUBLIC_URL/v1/webhooks/mux` in Mux.
  Uploads go directly to Mux. The backend checks the webhook HMAC against the
  exact body, rejects timestamps outside five minutes, deduplicates event IDs,
  and publishes only a verified ready asset with public playback. Local byte
  uploads are restricted to explicit demo mode.

Local uploads accept MP4, MOV or WebM, enforce a 100 MB request limit, check the
declared MIME type and video signature, persist bytes, and serve byte ranges
for seeking. The authenticated account owns the upload. Failed uploads require
a new upload request. The local adapter is intended for development;
production media processing belongs to Mux.
The upload endpoint checks demo mode, session and ownership before reading raw
video bytes. At most two local uploads are buffered concurrently, and an
abandoned request releases its slot.

## Persistence and recommendations

Like and follow pairs are unique and idempotent. Conversations store a sorted,
unique participant pair; only its two members can read or send messages.
Comment authors and message senders always come from the verified session.
Text lengths and profile fields are validated on the server.

A meaningful view requires at least 2 seconds of watching, or a completed clip
watched for at least 500 ms. Repeat reports within 30 seconds are suppressed.
History lists each video once, most recently watched first.

Recommended ranking evaluates the latest 1000 ready videos: +30 for a followed
creator, +15 for an app creator whose video the viewer previously liked, +2 per
like capped at 20 likes, and +10 for an unwatched video. Ties use recency and ID.
Discovery uses recency; following contains uploaded videos by followed app
users. These are explicit initial recommendation rules, with no claim of ML.
Recommendation pagination freezes the ranked video IDs in a user-owned,
15-minute database snapshot. Watching or liking one page updates its metadata
without moving the unseen videos past its cursor. Refreshing starts a new
ranking session; expired sessions return a refresh error.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run demo:test
```

Run `demo:test` while the normal demo is stopped because it owns the same local
database port. With the demo running, use `DEMO_MODE=true` and the PostgreSQL
URL in `.data/demo-runtime.json` to run `npm run test:e2e` instead. Integration
tests create and clean up their own test records. They check session tampering,
unique interactions and conversation pairs, cross-user privacy, persistence
through a second database client, meaningful views, and upload ownership/type
validation. Unit tests check Mux signatures and video signatures.

Prisma CLI, client and adapter are pinned together at 7.10.0. `deepmerge-ts`
and `mysql2` overrides patch vulnerabilities in Prisma tooling; no MySQL driver
is used by application queries. The unused Nest deployment tool was removed.
The dependency audit reported zero vulnerabilities after these updates.
```http
Authorization: Bearer <Clerk session token>
```

For now, the route returns the verified Clerk user ID. The local profile record
and final `/v1/me` response will be added with the database migration. Set
`CLERK_AUTHORIZED_PARTIES` to the comma-separated client origins once the mobile
origins are known; configure this allowlist before production.
