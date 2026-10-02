import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedPlayback, PlaybackStatus } from './feed-playback.types';
import { requestPlayback } from './playback-request';

export function useFeedPlayback(source: string, shouldPlay: boolean, muted: boolean, onComplete: () => void): FeedPlayback {
  const element = useRef<HTMLVideoElement>(null);
  const eligible = useRef(false);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const lastTime = useRef(0);
  const [status, setStatus] = useState<PlaybackStatus>('loading');
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const media = element.current;
    if (!media) return;
    const version = ++requestVersion.current;
    eligible.current = shouldPlay;
    media.muted = muted;
    if (shouldPlay) {
      void requestPlayback(media, () => eligible.current, setStatus, () => requestVersion.current === version);
    } else {
      media.pause();
    }
    return () => { requestVersion.current += 1; eligible.current = false; media.pause(); };
  }, [source, shouldPlay, muted]);

  // Start directly in the click handler so browsers retain user activation.
  const play = useCallback(() => {
    const media = element.current;
    if (!media) return;
    const version = ++requestVersion.current;
    eligible.current = true;
    setStatus(media.readyState >= 2 ? 'readyToPlay' : 'loading');
    void requestPlayback(media, () => eligible.current, setStatus, () => mounted.current && requestVersion.current === version);
  }, []);
  const pause = useCallback(() => { requestVersion.current += 1; eligible.current = false; element.current?.pause(); }, []);
  const retry = useCallback(() => {
    lastTime.current = 0;
    element.current?.load();
    play();
  }, [play]);

  return {
    view: <video key={source} ref={element} src={source} loop muted={muted} playsInline preload="metadata" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      onLoadStart={() => { lastTime.current = 0; setStatus('loading'); setIsPlaying(false); }}
      onLoadedData={() => setStatus('readyToPlay')}
      onCanPlay={() => setStatus('readyToPlay')}
      onWaiting={() => { setIsPlaying(false); if (eligible.current) setStatus('loading'); }}
      onPlaying={() => { if (!eligible.current) element.current?.pause(); else { setStatus('readyToPlay'); setIsPlaying(true); } }}
      onPause={() => setIsPlaying(false)}
      onError={() => { setStatus('error'); setIsPlaying(false); }}
      onEnded={onComplete}
      onTimeUpdate={event => {
        const time = event.currentTarget.currentTime;
        if (time < lastTime.current && eligible.current) onComplete();
        lastTime.current = time;
      }} />,
    status, isPlaying, play, pause, retry,
  };
}
