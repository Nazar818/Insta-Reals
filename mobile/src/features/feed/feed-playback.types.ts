import type { ReactElement } from 'react';

export type PlaybackStatus = 'idle' | 'loading' | 'readyToPlay' | 'blocked' | 'error';
export type FeedPlayback = {
  view: ReactElement;
  status: PlaybackStatus;
  isPlaying: boolean;
  play(): void;
  pause(): void;
  retry(): void;
};
