# Insta Reals: shared project context

Last reviewed: **2026-10-02**. Read this before changing code. The current API
contract is [API_CONTRACT.md](API_CONTRACT.md); exact run commands are in
[README.md](README.md).

## Current implementation and authorization

The shared repository is `Insta-Reals/`, with remote
`https://github.com/Nazar818/Insta-Reals.git`. The parent directory is a separate
Git repository; keep project Git commands and files inside `Insta-Reals/`.
The baseline mobile and backend scaffolds were merged previously. The first
functional proof of concept is on `first-proof-of-concept-demo`. The user
explicitly authorized Codex to create this branch, commit the demo and push it.

The original plan restricted the first milestone to scaffolding. That milestone
is historical. The user subsequently requested the complete functional app and
explicitly selected **"Build both mobile and backend here"**. This authorizes
Codex to implement both apps for this change. The user has no Clerk project.
Codex is the named owner of root documentation and the API contract for this
build. Humans retain Git actions unless they explicitly authorize a specific
action, as they did for this demo branch. PR creation and merging have not been
authorized.

Implemented mobile and API features include:

- Authenticated profiles, editing, user search and follows.
- A paginated vertical video feed with visible-item playback, pause, mute,
  credited external clips, likes and comments.
- Real local video picking/uploading and ready-video playback in the demo;
  Mux direct-upload and verified-webhook adapters for configured deployments.
- Persistent, member-only one-to-one conversations and paginated messages;
  mobile polls while focused and pauses polling in the background.
- Meaningful view recording, watch history and a documented initial ranking.
- Loading, empty, error and retry states, validation and ownership checks.

## Runtime and provider boundaries

Use Node **22.18 or newer within Node 22.x**. Mobile is Expo SDK 57, React Native,
TypeScript and Expo Router with `expo-video`. Backend is NestJS with PostgreSQL
and Prisma 7.10.0. Each app has an independent npm package and lockfile; there
is no root workspace manager or shared package.

From `backend/`, `npm run demo` starts the PGlite PostgreSQL runtime over the
PostgreSQL wire protocol on port 5433, applies the committed migration and starts
the API on port 3000. It runs the same Prisma services as ordinary PostgreSQL.
Data persists under ignored `backend/.data/postgres`; uploaded bytes persist in
`backend/.data/videos`. Demo account tokens are signed with a local generated
secret and expire after 24 hours. Demo mode refuses production use.

The labelled development accounts, Alex and Sam, use real persisted profiles,
likes, comments, follows, messages, uploads and history. They are the available
local authentication path until Clerk is configured. Starter clips are credited
Blender Foundation sample films with no app owner. Pexels creators also have no
app account owner; never turn a provider credit into a fake user profile.

Configured deployments require an ordinary `DATABASE_URL`, Clerk verification
credentials and mobile's matching Clerk publishable key. Pexels needs a backend
API key; Mux needs backend API credentials, a webhook signing secret and a
reachable HTTPS webhook. Only verified ready Mux assets enter the feed.
Provider adapters exist but have **not been tested against live provider
accounts**. Do not describe the project as production-ready.

Mobile normally uses Expo's development host for the API. Override
`EXPO_PUBLIC_API_BASE_URL` with a reachable LAN or tunnel `/v1` URL as needed.
Backend `API_PUBLIC_URL` controls returned upload and media URLs. Public Expo
values are visible to users; backend secrets remain in ignored `.env` files.

## Ownership and architecture

Default collaboration remains:

| Developer | Ownership |
| --- | --- |
| You | `mobile/**` |
| Your friend | `backend/**` |

Agree on file ownership before concurrent changes. Root documentation and
contracts need a named owner. The user's explicit scope can override the default
split, as it did for this functional build.

Keep screens thin; feature code owns client state and calls the typed HTTP
client. Backend controllers validate requests, services enforce ownership, and
provider adapters isolate external APIs. Database records own app identities and
social data; Clerk owns credentials. Tokens determine authors and senders, never
client-supplied IDs. Stock/sample videos have no app owner; local and Mux uploads
have a verified uploader. Messages are accessible only to conversation members.

## Verification and next review

Run mobile typecheck, lint and exports, and backend typecheck, lint, unit tests,
build and `demo:test`. Stop the normal demo before `demo:test` because both own
the database port. Integration tests cover persistent interactions, membership,
session validation, upload ownership and meaningful views. Details are in the
app READMEs.

Web behavior and native bundles can be verified locally. A complete native
iOS/Android UI session has **not** been verified. Before merging, humans should
check playback/backgrounding, uploads, keyboard/composer layout and account
switching on devices. Live Clerk/Pexels/Mux integration and deployment setup
remain separate work. Mobile's current audit has 14 moderate transitive findings
to review before deployment; the scaffold previously recorded 13.

Keep future changes reviewable, add meaningful tests for rules and provider
boundaries, and run the relevant checks. Never commit provider keys, `.env`,
`.data`, raw media, `node_modules` or generated exports. Codex may inspect Git
and explain commands, but must not commit, push, merge or create a PR without
explicit permission for that specific action.
