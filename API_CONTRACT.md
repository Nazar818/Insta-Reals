# Implemented API target

Owner for this change: Codex, working on both apps at the user's explicit request.
All routes use `/v1`, JSON, opaque IDs, UTC ISO timestamps, and authenticated
Bearer tokens except health, config, demo session creation and webhook ingress.
This document extends PROJECT_CONTEXT.md for the functional build.

## Shapes

```ts
type Page<T> = { items: T[]; nextCursor: string | null };
type User = {
  id: string; username: string; displayName: string; avatarUrl: string | null;
  bio: string; followerCount: number; followingCount: number;
  viewerIsFollowing: boolean;
};
type FeedVideo = {
  id: string; source: 'pexels' | 'mux' | 'local' | 'sample';
  playbackUrl: string; thumbnailUrl: string | null; caption: string | null;
  creator: { displayName: string; appUserId: string | null; attributionUrl: string | null };
  likeCount: number; commentCount: number; viewerHasLiked: boolean;
};
type Comment = { id: string; text: string; author: User; createdAt: string };
type Conversation = { id: string; otherUser: User; lastMessage: Message | null };
type Message = { id: string; senderId: string; text: string; createdAt: string };
type Upload = {
  id: string; uploadUrl: string | null; status: 'pending' | 'processing' | 'ready' | 'failed';
  provider: 'local' | 'mux'; videoId: string | null;
};
```

## Routes

| Method/path | Request | Response |
| --- | --- | --- |
| GET `/health` | — | `{status:'ok'}` |
| GET `/config` | — | `{demoMode:boolean, uploadProvider:'local'|'mux'}` |
| POST `/demo/sessions` | `{account:'alex'|'sam'}` | `{token:string,user:User}`; development demo mode only |
| GET `/me` | — | User, synchronised from verified identity |
| PATCH `/me` | `{displayName?,username?,bio?}` | User |
| GET `/users?query=...` | — | Page<User> |
| GET `/users/:id` | — | User |
| GET `/users/:id/videos?cursor=...` | — | Page<FeedVideo> |
| PUT/DELETE `/users/:id/follow` | — | User |
| GET `/feed?cursor=...&mode=discover|following|recommended` | — | Page<FeedVideo> |
| GET `/videos/:id` | — | FeedVideo |
| PUT/DELETE `/videos/:id/like` | — | FeedVideo |
| GET `/videos/:id/comments?cursor=...` | — | Page<Comment> |
| POST `/videos/:id/comments` | `{text:string}` | Comment |
| POST `/videos/:id/views` | `{watchDurationMs:number,completed:boolean}` | `{ok:true}` |
| GET `/me/history?cursor=...` | — | Page<FeedVideo> |
| GET `/conversations` | — | Page<Conversation> |
| POST `/conversations` | `{userId:string}` | Conversation; unique unordered participant pair |
| GET `/conversations/:id/messages?cursor=...` | — | Page<Message>, newest first |
| POST `/conversations/:id/messages` | `{text:string}` | Message |
| POST `/uploads` | `{caption:string,contentType:'video/mp4'|'video/quicktime'|'video/webm'}` | Upload |
| PUT `/uploads/:id/content` | video bytes with video Content-Type | Upload; local demo only, owner bearer token |
| GET `/uploads/:id` | — | Upload, owner only |
| POST `/webhooks/mux` | verified provider event | `{ok:true}` |

Upload bytes go to returned uploadUrl using PUT. Local upload URLs require the
same bearer token. Mux URLs use provider authorization already in the URL.
Poll GET `/uploads/:id` until ready or failed. Only ready videos enter the feed.
Messages and comments are limited to 2000 characters; captions 500; bio 160;
display names 60; usernames 3–30 lowercase letters, numbers and underscores.
Page size is 12 feed/history/user videos, 30 comments/messages/users.
Errors use HTTP status plus `{message:string|string[]}`. Mobile shows loading,
empty, error and retry states. Missing providers never fabricate user accounts.

## Local demo and deployed configuration

DEMO_MODE is an explicit development-only backend setting. Demo accounts share
the same relational data and authorization rules as Clerk accounts. Reject demo
mode when NODE_ENV is production. External sample clips retain their original
credit and have no app owner. Local uploads are available only in demo mode.
Configured deployments use Clerk, Pexels and Mux credentials kept in backend/.env.
