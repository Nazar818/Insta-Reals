import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, palette } from '../../components/ui';
import { API_BASE_URL, errorMessage, useApi } from '../../lib/api';
import type { FeedVideo } from '../../types';
import { useFeedPlayback } from './use-feed-playback';

export function localMediaUrl(url: string) {
  const parsed = new URL(url, API_BASE_URL);
  if (['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    const base = new URL(API_BASE_URL);
    parsed.protocol = base.protocol; parsed.host = base.host;
  }
  return parsed.toString();
}

function count(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value); }

export function VideoCard({ video, active, height, onUpdate }: {
  video: FeedVideo; active: boolean; height: number; onUpdate?: (next: FeedVideo) => void;
}) {
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [liking, setLiking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const source = video.source === 'local' ? localMediaUrl(video.playbackUrl) : video.playbackUrl;
  const watch = useRef({ duration: 0, completed: false });
  const onComplete = useCallback(() => { if (active) watch.current.completed = true; }, [active]);
  const playback = useFeedPlayback(source, active && foreground && !paused, muted, onComplete);
  const { status, isPlaying } = playback;
  const playing = useRef(false);
  useEffect(() => { playing.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!active) return;
    watch.current = { duration: 0, completed: false };
    let previous = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (playing.current && AppState.currentState === 'active') watch.current.duration += Math.min(now - previous, 1000);
      previous = now;
    }, 500);
    return () => {
      clearInterval(interval);
      const watched = watch.current;
      if (watched.duration >= 2000 || watched.completed) {
        void api.post(`videos/${encodeURIComponent(video.id)}/views`, { watchDurationMs: Math.round(watched.duration), completed: watched.completed }).catch(() => {});
      }
    };
  }, [active, api, video.id]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const like = useCallback(async () => {
    if (liking) return;
    setLiking(true);
    try {
      const path = `videos/${encodeURIComponent(video.id)}/like`;
      const next = video.viewerHasLiked ? await api.delete<FeedVideo>(path) : await api.put<FeedVideo>(path);
      onUpdate?.(next);
    } catch (err) { setNotice(errorMessage(err)); }
    finally { setLiking(false); }
  }, [liking, video, api, onUpdate]);
  const openCreator = () => {
    if (video.creator.appUserId) router.push({ pathname: '/users/[id]', params: { id: video.creator.appUserId } });
    else if (video.creator.attributionUrl) void Linking.openURL(video.creator.attributionUrl).catch(() => setNotice('Could not open the creator credit.'));
  };

  return <View style={[styles.card, { height }]}>
    {playback.view}
    <Pressable style={StyleSheet.absoluteFill} onPress={() => {
      if (!active || !foreground) return;
      if (isPlaying) { setPaused(true); playback.pause(); }
      else { setPaused(false); playback.play(); }
    }} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}>
      {!isPlaying && status !== 'loading' && status !== 'error' && <View style={styles.playIndicator}><Icon name="play" size={50} />{status === 'blocked' && <Text style={styles.errorTitle}>Tap to play</Text>}</View>}
    </Pressable>
    {status === 'loading' && active && <ActivityIndicator style={styles.loading} size="large" color={palette.text} />}
    {status === 'error' && <View style={styles.videoError}><Text style={styles.errorTitle}>This video couldn’t load</Text><Button title="Retry playback" variant="secondary" onPress={() => { if (active && foreground) { setPaused(false); playback.retry(); } }} /></View>}
    <View pointerEvents="none" style={styles.bottomShade} />
    <Pressable onPress={() => setMuted(value => !value)} style={[styles.mute, { top: insets.top + 72 }]} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}><Icon name={muted ? 'volume-x' : 'volume-2'} size={20} /></Pressable>
    <View style={styles.metadata}>
      <Pressable onPress={openCreator} disabled={!video.creator.appUserId && !video.creator.attributionUrl} accessibilityRole="button" accessibilityLabel={`View ${video.creator.displayName}`}><Text style={styles.creator}>{video.creator.displayName}</Text></Pressable>
      <Text numberOfLines={4} style={styles.caption}>{video.caption || 'A new perspective.'}</Text>
      {!video.creator.appUserId && <Pressable onPress={openCreator} accessibilityRole="link"><Text style={styles.credit}>{video.source === 'pexels' ? 'Pexels' : 'Sample film'} · Creator credit ↗</Text></Pressable>}
      <View style={styles.sound}><Icon name="music" size={13} /><Text style={styles.soundText}>Original sound · {video.creator.displayName}</Text></View>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={video.viewerHasLiked ? 'Unlike video' : 'Like video'} disabled={liking} onPress={() => void like()} style={styles.action}><Icon name="heart" size={30} color={video.viewerHasLiked ? palette.accent : palette.text} /><Text style={styles.actionCount}>{count(video.likeCount)}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open comments" onPress={() => router.push({ pathname: '/comments/[id]', params: { id: video.id } })} style={styles.action}><Icon name="message-circle" size={29} /><Text style={styles.actionCount}>{count(video.commentCount)}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Share video" onPress={() => { void Share.share({ message: `${video.caption || 'Watch this Real'}\n${source}` }).catch(() => setNotice('Sharing is unavailable on this device.')); }} style={styles.action}><Icon name="send" size={28} /><Text style={styles.actionCount}>Share</Text></Pressable>
    </View>
    {notice && <View accessibilityRole="alert" style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#000', overflow: 'hidden' },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 210, backgroundColor: '#00000055' },
  metadata: { position: 'absolute', left: 20, right: 88, bottom: 28, gap: 12 },
  creator: { color: palette.text, fontSize: 17, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  caption: { color: palette.text, fontSize: 14, lineHeight: 21, textShadowColor: '#000', textShadowRadius: 4 },
  credit: { color: '#ddd', fontSize: 12 }, sound: { flexDirection: 'row', gap: 8, alignItems: 'center' }, soundText: { color: '#eee', fontSize: 11 },
  actions: { position: 'absolute', right: 14, bottom: 38, gap: 26 }, action: { alignItems: 'center', gap: 6, minWidth: 48 }, actionCount: { color: palette.text, fontSize: 12, fontWeight: '600' },
  mute: { position: 'absolute', right: 18, backgroundColor: '#00000066', borderRadius: 22, padding: 12 },
  playIndicator: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.8 }, loading: { position: 'absolute', top: '45%', alignSelf: 'center' },
  videoError: { position: 'absolute', top: '35%', alignSelf: 'center', gap: 16, padding: 24 }, errorTitle: { color: palette.text, fontSize: 18, textAlign: 'center' },
  notice: { position: 'absolute', top: 140, left: 20, right: 20, backgroundColor: '#371e28', borderRadius: 14, padding: 16 }, noticeText: { color: '#ffb1c6', textAlign: 'center' },
});
