import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { FeedPlayback } from './feed-playback.types';
import { requestPlayback } from './playback-request';

export function useFeedPlayback(source: string, shouldPlay: boolean, muted: boolean, onComplete: () => void): FeedPlayback {
  const player = useVideoPlayer(source, instance => { instance.loop = true; instance.muted = true; });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === source;
  const eligible = useRef(false);
  const generation = useRef(0);
  useEventListener(player, 'playToEnd', onComplete);

  const play = useCallback(() => {
    eligible.current = true;
    if (player.status !== 'readyToPlay') return;
    const version = generation.current;
    void requestPlayback(player, () => eligible.current, () => setFailedSource(source), () => generation.current === version);
  }, [player, source]);
  const pause = useCallback(() => {
    eligible.current = false;
    try { player.pause(); } catch { /* A released native handle no longer needs pausing. */ }
  }, [player]);

  useEffect(() => {
    generation.current += 1;
    return () => {
      generation.current += 1;
      eligible.current = false;
      try { player.pause(); } catch { /* Already released. */ }
    };
  }, [player]);

  // Expo VideoPlayer is an imperative native handle, not immutable React state.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    eligible.current = shouldPlay;
    player.muted = muted;
    if (!shouldPlay || failed || status === 'error') pause();
    else if (status === 'readyToPlay') play();
    return () => { eligible.current = false; };
  }, [player, shouldPlay, muted, status, failed, play, pause]);
  /* eslint-enable react-hooks/immutability */

  const retry = useCallback(() => {
    eligible.current = true;
    const version = ++generation.current;
    setFailedSource(null);
    void player.replaceAsync(source).then(() => { if (generation.current === version && eligible.current) play(); }).catch(() => {
      if (generation.current === version && eligible.current) setFailedSource(source);
    });
  }, [player, source, play]);

  return {
    view: <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />,
    status: failed ? 'error' : status, isPlaying, play, pause, retry,
  };
}
