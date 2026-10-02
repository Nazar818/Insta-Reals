import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, palette } from '../../components/ui';
import type { FeedVideo } from '../../types';

export function VideoGrid({ videos }: { videos: FeedVideo[] }) {
  return (
    <View style={styles.grid}>
      {videos.map((video) => (
        <Pressable
          key={video.id}
          accessibilityRole="button"
          accessibilityLabel={`Play ${video.caption || 'video'} by ${video.creator.displayName}`}
          onPress={() => router.push({ pathname: '/video/[id]', params: { id: video.id } })}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} /> : <View style={styles.placeholder}><Icon name="film" size={30} color={palette.muted} /></View>}
          <View style={styles.badge}><Icon name="play" size={13} /><Text style={styles.count}>{video.likeCount} likes</Text></View>
          <View style={styles.caption}><Text numberOfLines={2} style={styles.captionText}>{video.caption || 'Untitled reel'}</Text></View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', aspectRatio: 0.64, backgroundColor: palette.surface, borderRadius: 12, overflow: 'hidden' },
  pressed: { opacity: 0.7 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, left: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#0009', padding: 5, borderRadius: 8 },
  count: { color: '#fff', fontSize: 10 },
  caption: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: '#0009' },
  captionText: { color: '#fff', fontSize: 11, lineHeight: 15 },
});
