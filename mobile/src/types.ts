export type Page<T> = { items: T[]; nextCursor: string | null };
export type User = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  followerCount: number;
  followingCount: number;
  viewerIsFollowing: boolean;
};
export type FeedVideo = {
  id: string;
  source: 'pexels' | 'mux' | 'local' | 'sample';
  playbackUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  creator: { displayName: string; appUserId: string | null; attributionUrl: string | null };
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
};
export type Comment = { id: string; text: string; author: User; createdAt: string };
export type Message = { id: string; senderId: string; text: string; createdAt: string };
export type Conversation = { id: string; otherUser: User; lastMessage: Message | null };
export type Upload = {
  id: string;
  uploadUrl: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  provider: 'local' | 'mux';
  videoId: string | null;
};
