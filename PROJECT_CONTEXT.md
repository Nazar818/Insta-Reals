# Short-form video app: shared project context

Last reviewed: 2026-10-01. This is the shared plan for two developers and their Codex sessions. It describes intended work; it does not claim that any application feature is implemented.

## Current repository state

- The shared project repository is `Insta-Reals/`. It is on `main`, has no commits yet, and has `origin` set to `https://github.com/Nazar818/Insta-Reals.git`.
- There is no `README`, `package.json`, mobile app, backend app, database schema, or configuration yet.
- The parent folder is a separate local Git repository containing `Git-Cheat-Sheet.md` and `tmp/pdfs/`. Those files are outside the shared `Insta-Reals/` repository. Keep Git commands and new project files inside `Insta-Reals/`.
- The first code change should establish a clean baseline, then future work should happen through small branches and pull requests.

## Product goal and scope

Build a portfolio-quality iOS/Android short-form vertical video app over multiple milestones. The completed learning project should support a full-screen swipe feed, visibility-based playback, Clerk accounts, profiles, likes, comments, follows, user video uploads and streaming through Mux, watch history, a basic personalized feed, and persisted one-to-one text messages between users.

Pexels supplies credited stock videos for the initial feed. These are external videos, not posts uploaded by app users. A Pexels creator must not be presented as an app account. Later, user uploads will become a separate source in the same feed. The first milestone is repository setup and architecture only; no product features should be built during that milestone.

This is a multi-session project. A full stack app with authentication, messaging, uploads, and recommendations is not a credible one-hour deliverable. For the first hour, aim to agree on this contract, create and review the Git baseline, and scaffold only the two apps if time permits.

## Chosen stack and decisions

| Concern | Choice | Reason |
| --- | --- | --- |
| Mobile | React Native, Expo, TypeScript | Shared iOS/Android app with a fast development loop. |
| Navigation | Expo Router | File-based screens included in the standard Expo workflow. |
| Video playback | `expo-video` | Expo-supported player with playback controls and preloading support. |
| Backend | Node.js, NestJS, TypeScript, REST/JSON | Clear modules and a simple mobile API contract. |
| Database | PostgreSQL | Durable relational data for social interactions and messages. |
| Database access | Prisma, introduced when the first persistent model is built | Type-safe queries and reviewed migrations; verify the then-current setup commands before installing. |
| Authentication | Clerk Expo SDK on mobile; verified Clerk session tokens in NestJS | Clerk owns credentials and sessions; our database owns app profiles and social data. |
| Initial videos | Pexels Videos API, called only by NestJS | Protects the API key and provides one stable feed contract to mobile. |
| User uploads | Mux Direct Uploads plus verified webhooks | Mobile uploads straight to Mux; backend controls upload authorization and records readiness. |
| Collaboration | GitHub, short-lived branches, pull requests | Reviewable changes and practice with Git commands. |

Start with two independent app packages and lockfiles. Do not add a root workspace manager or a shared package until duplicate code makes one worthwhile. Use the built-in `fetch` client initially. Add a library only when an actual milestone needs it; document the reason in the pull request.

## Proposed monorepo layout

The following is the target layout, not a set of directories to create immediately:

```text
/
  AGENTS.md                    # Brief Codex rules; points here
  PROJECT_CONTEXT.md           # This shared plan and API contract
  README.md                    # How to run, test, and demo the project
  .gitignore
  mobile/
    app/                       # Expo Router screens and layouts
    src/
      features/                # feed, auth, profiles, messages, uploads...
      components/              # shared presentational components
      lib/api/                 # typed API client and token attachment
      types/                   # mobile-facing API types, initially local
    assets/
    .env.example
    package.json
    package-lock.json
  backend/
    src/
      auth/                    # Clerk token verification and guard
      users/
      feed/
      videos/
      interactions/            # likes, comments, follows
      messages/
      providers/pexels/
      providers/mux/
      database/
      common/
    prisma/                    # Schema and migrations when Prisma is added
    test/
    .env.example
    package.json
    package-lock.json
```

Keep screen components thin. Mobile feature code owns local view state and calls the API. NestJS controllers validate requests, services enforce rules, and provider modules isolate Pexels/Mux. PostgreSQL stores application records; it does not store video binaries or Clerk passwords.

## Two-developer ownership

At the start of each milestone, agree on one branch each and the files each person may edit. The default ownership is:

| Developer | Primary ownership | Examples |
| --- | --- | --- |
| You | Mobile | `mobile/**`, feed playback, navigation, auth UI, messaging UI. |
| Your friend | Backend | `backend/**`, database migrations, Clerk guard, Pexels/Mux adapters, message API. |

Both people review the API contract before coding. Root files, environment examples, and any shared API schema need a named owner for each pull request. If one side is waiting on the other, agree on the response shape first; then one developer can build the real component against that shape while the other implements the real endpoint. Avoid a mock service that becomes a second backend.

Split work by a small vertical outcome rather than giving one Codex a prompt for the whole mobile app and the other a prompt for the whole backend. A milestone is complete when a real mobile action reaches a real backend endpoint, is stored or fetched as intended, and can be demonstrated.

## Initial API contract to agree on before implementation

Use `/v1` for backend routes. Exact field names may evolve in a reviewed contract change. Use opaque string IDs in API responses and cursor pagination for feed and message lists. Use UTC ISO timestamps.

```ts
type FeedVideo = {
  id: string;
  source: 'pexels' | 'mux';
  playbackUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  creator: {
    displayName: string;
    appUserId: string | null;
    attributionUrl: string | null;
  };
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
};

type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
```

Plan these routes only when their milestone arrives:

| Area | Proposed routes | Notes |
| --- | --- | --- |
| Session/profile | `GET /v1/me`, `PATCH /v1/me`, `GET /v1/users/:id` | First authenticated request may create the local user row from the verified Clerk ID. |
| Feed | `GET /v1/feed?cursor=...` | Initially Pexels-backed; same shape later includes ready Mux uploads. |
| Likes/comments | `PUT/DELETE /v1/videos/:id/like`, `GET/POST /v1/videos/:id/comments` | Idempotent likes; server derives author from token. |
| Follows | `PUT/DELETE /v1/users/:id/follow` | No self-follow. |
| Uploads | `POST /v1/uploads`, `GET /v1/uploads/:id` | Server creates Mux direct upload; `ready` only after verified webhook. |
| Messages | `GET/POST /v1/conversations`, `GET/POST /v1/conversations/:id/messages` | Persistent one-to-one text messages; members only. |
| History | `POST /v1/videos/:id/views`, `GET /v1/me/history` | Record meaningful views, not every render or scroll event. |

An authenticated mobile request sends `Authorization: Bearer <Clerk session token>`. NestJS verifies the token and uses its subject as the trusted Clerk user ID. Client-supplied author or sender IDs must never decide ownership. Public feed access can be considered later; for the first integrated slice, signed-in feed access keeps the contract simple.

## Data model, introduced incrementally

Do not create every table in the first migration. Add each group with the feature that uses it.

1. `User`: internal ID, unique `clerkId`, unique username, display name, avatar, timestamps.
2. `Video`: internal ID, source (`PEXELS` or `MUX`), source ID unique together with source, optional owner user ID, caption, thumbnail, source/attribution URL, playback reference, status, timestamps. Pexels rows have no app owner; Mux rows do.
3. `Like`: unique `(userId, videoId)`; `Comment`: video ID, author ID, text, timestamps; `Follow`: unique `(followerId, followedId)`.
4. `Conversation`: one-to-one participant pair with uniqueness for that pair; `Message`: conversation ID, sender ID, text, created time. The first messaging milestone uses server persistence and refresh/polling; real-time delivery can be a later enhancement.
5. `VideoView`: user ID, video ID, viewed time and watch duration or completion indicator. Use it to build an explainable initial ranking later.

The API may fetch a Pexels page and upsert the returned video metadata by `(source, sourceId)`, so likes/comments have stable app IDs. Cache Pexels responses within its published limits. Preserve Pexels attribution and refresh playback metadata as needed. Mux upload status should move through `pending -> processing -> ready` or `failed`; only ready uploads appear in the feed.

## Build order: small reviewed milestones

Each numbered item should be its own pull request or a few even smaller pull requests. Do not combine unrelated features into a single large commit.

| Phase | Backend slice | Mobile slice | Done when |
| --- | --- | --- | --- |
| 0. Baseline | Scaffold NestJS and a health route; document local PostgreSQL setup only when needed. | Scaffold Expo app and launch it. | Both apps start; README has exact commands; no product features. |
| 1. Account | Add first `User` migration and Clerk token verification. | Clerk sign-in and a signed-in home screen. | Two people can sign in and receive distinct `/v1/me` records. |
| 2. Feed | Pexels adapter, attribution, normalized `/v1/feed`, pagination. | Full-screen vertical feed with `expo-video`; play only visible item and pause on background. | A signed-in user can swipe real, credited Pexels videos. |
| 3. Social | Likes, comments, follows with ownership checks and migrations. | Like/comment/profile/follow screens. | Two accounts see each other's persistent actions. |
| 4. Upload | Authenticated Mux direct upload URL and verified webhooks. | Pick a local video, upload it, show processing/ready state. | Uploaded video is playable from Mux in the feed. |
| 5. Messages | Conversations and messages, pagination, member-only access. | Inbox and one-to-one chat UI, refresh/poll for new messages. | Account A sends text; account B receives it after refresh; both retain history. |
| 6. History/recommendations | View recording and a documented simple ranking formula. | History and recommended feed affordances. | Feed ranking changes predictably from follows/likes/views and can be explained. |
| 7. Portfolio finish | Validation, error handling, deployment configuration. | Empty/loading/error states and device QA. | A new developer can run the demo from README; key flows work on device. |

Prioritize real end-to-end behavior. A polished demo with a few complete flows is better portfolio evidence than many disconnected screens.

## Git and Codex working agreement

1. The shared GitHub remote and `main` branch already exist in `Insta-Reals/`. Make a reviewed baseline commit there. Keep commands in that repository rather than the parent directory.
2. Each person clones the GitHub repository into their own local folder. Work on short-lived branches such as `feature/account-mobile` and `feature/account-api`. Open a pull request for each coherent slice; the other person reviews it before merging.
3. Before coding, both developers write the small API request/response contract in the issue or PR. The backend owner updates this document when the contract changes.
4. Each developer gives Codex one bounded task with file ownership, acceptance criteria, and a requirement to explain important decisions. Codex should explain briefly before significant edits and report changed files and checks afterward.
5. To practice Git, the humans run `git status`, `git diff`, `git add -p` or targeted `git add`, `git commit`, `git push`, `git pull --ff-only`, and PR merge commands themselves. Codex may explain commands and review diffs but should not commit, push, merge, or create PRs unless directly asked for that particular action.
6. Keep commits small and descriptive, e.g. `chore: scaffold Expo app`, `feat(api): verify Clerk session`, `feat(mobile): pause off-screen videos`. Run the relevant lint/typecheck/test/build before opening a PR. Add tests for rules and provider boundaries where they catch real mistakes.
7. Never commit keys, `.env` files, `node_modules`, local build artifacts, or raw media. Commit `.env.example` with variable names and setup guidance.

### First shared Git baseline: humans run these commands

From inside `Insta-Reals/`, one developer can publish just the planning files:

```bash
git status --short
git remote -v
git add AGENTS.md PROJECT_CONTEXT.md
git diff --cached
git commit -m "docs: agree on project plan and collaboration rules"
git push -u origin main
```

Your friend then runs `git clone https://github.com/Nazar818/Insta-Reals.git` in their own parent directory. The first implementation branches can be `feature/scaffold-mobile` and `feature/scaffold-api`; assign ownership of the root `README.md` and `.gitignore` to one of those branches or handle them in a tiny separate PR. The cheat sheet and `tmp/` files stay in the parent folder unless you deliberately move them into the shared repository.

### First bounded Codex tasks after the baseline

**Your mobile Codex prompt:** “Read `AGENTS.md` and `PROJECT_CONTEXT.md`. Inspect the repository. Implement only the Expo/React Native/TypeScript scaffold under `mobile/`. Keep the generated app minimal, make it launch, and document the exact run command. Do not touch `backend/` or create product features. Explain the scaffold choice before editing, run the available checks, show the diff, and leave Git commits to me.”

**Your friend's backend Codex prompt:** “Read `AGENTS.md` and `PROJECT_CONTEXT.md`. Inspect the repository. Implement only the NestJS/TypeScript scaffold under `backend/` with a health route. Make it start and document the exact run command. Do not touch `mobile/`, add a database model, or create product features. Explain the scaffold choice before editing, run the available checks, show the diff, and leave Git commits to me.”

Example next prompt for either Codex session:

> Read `AGENTS.md` and `PROJECT_CONTEXT.md`. Inspect Git status and the current files. Work only on phase 0 and only in the files I assign you. Briefly explain the change before editing. Make one small reviewable step, run the relevant checks, and show me the diff and exact Git commands I should run myself. Do not commit or push.

## Secrets and external services

- Mobile may contain `EXPO_PUBLIC_API_BASE_URL` and Clerk's publishable key. Expo public environment values are visible to the app user.
- Backend owns `DATABASE_URL`, Clerk verification credentials, `PEXELS_API_KEY`, Mux API credentials, and the Mux webhook signing secret.
- Pexels requires a prominent link back to Pexels, encourages creator credit, and publishes API rate limits. Keep the key on the backend. Do not represent its stock content as user uploads or silently re-host it through Mux.
- Mux Direct Uploads let the app send bytes directly to Mux. A verified webhook, rather than the client, determines when the asset is ready. For the first public feed, public playback IDs are a simpler choice; review access needs before publishing private content.
- For local device testing, the phone must reach the backend address. `localhost` inside a phone or simulator may not mean the developer's computer; document the chosen LAN/tunnel setup in `README.md` when implemented.

## References for implementation time

- [Expo video](https://docs.expo.dev/versions/latest/sdk/video/)
- [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart)
- [Clerk backend request verification](https://clerk.com/docs/reference/backend/authenticate-request)
- [Pexels API documentation and guidelines](https://www.pexels.com/api/documentation/)
- [Mux Direct Uploads](https://www.mux.com/docs/guides/upload-files-directly)
- [Mux webhooks](https://www.mux.com/docs/core/listen-for-webhooks)
- [Prisma with NestJS](https://www.prisma.io/docs/guides/frameworks/nestjs)

Check current documentation and package versions when implementing each phase. This plan records intent and boundaries, not version-pinned installation instructions.
