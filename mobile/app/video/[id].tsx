import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorNotice, palette, Screen } from '../../src/components/ui';
import { VideoCard } from '../../src/features/feed/video-card';
import { useResource } from '../../src/lib/use-resource';
import { useRefreshOnReturn } from '../../src/features/social/use-paged-resource';
import type { FeedVideo } from '../../src/types';

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const video = useResource<FeedVideo>(id ? `videos/${encodeURIComponent(id)}` : null);
  useRefreshOnReturn(video.refresh);
  const [height, setHeight] = useState(600);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return <Screen title="Real" back scroll={false}><View style={{ flex: 1 }} onLayout={event => setHeight(event.nativeEvent.layout.height)}>{video.data ? <VideoCard video={video.data} active={focused} height={height} onUpdate={video.setData} /> : <View style={{ padding: 24, flex: 1, justifyContent: 'center' }}>{video.loading && <ActivityIndicator color={palette.accent} />}<ErrorNotice error={video.error} onRetry={() => void video.refresh()} /></View>}</View></Screen>;
}
