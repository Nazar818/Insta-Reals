import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorNotice, palette } from '../../src/components/ui';
import { VideoCard } from '../../src/features/feed/video-card';
import { usePagedResource, useRefreshOnReturn } from '../../src/features/social/use-paged-resource';
import type { FeedVideo } from '../../src/types';

type Mode = 'discover' | 'following' | 'recommended';
const viewabilityConfig = { itemVisiblePercentThreshold: 80 };
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('discover');
  const feed = usePagedResource<FeedVideo>(`feed?mode=${mode}`);
  const [height, setHeight] = useState(600);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const list = useRef<FlatList<FeedVideo>>(null);
  const onVisible = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedVideo>[] }) => {
    const visible = viewableItems.find(item => item.isViewable);
    if (visible?.index !== null && visible?.index !== undefined) setIndex(visible.index);
  }, []);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const { setItems } = feed;
  const updateVideo = useCallback((next: FeedVideo) => { setItems(previous => previous.map(video => video.id === next.id ? next : video)); }, [setItems]);
  const refresh = async () => { setIndex(0); list.current?.scrollToOffset({ offset: 0, animated: false }); await feed.refresh(); };
  useRefreshOnReturn(refresh);
  const changeMode = (next: Mode) => { setMode(next); setIndex(0); list.current?.scrollToOffset({ offset: 0, animated: false }); };
  return <View style={styles.screen} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
    {feed.loading && !feed.items.length ? <View style={styles.center}><ActivityIndicator size="large" color={palette.accent} /></View> : feed.items.length ? <FlatList
      ref={list} data={feed.items} keyExtractor={video => video.id} renderItem={({ item, index: itemIndex }) => <VideoCard video={item} active={focused && index === itemIndex} height={height} onUpdate={updateVideo} />}
      pagingEnabled snapToInterval={height} decelerationRate="fast" showsVerticalScrollIndicator={false} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
      getItemLayout={(_, itemIndex) => ({ length: height, offset: height * itemIndex, index: itemIndex })}
      onViewableItemsChanged={onVisible} viewabilityConfig={viewabilityConfig}
      onEndReached={() => void feed.loadMore()} onEndReachedThreshold={1}
      refreshControl={<RefreshControl refreshing={feed.refreshing} tintColor={palette.accent} onRefresh={() => void refresh()} />}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={palette.accent} style={{ padding: 20 }} /> : feed.error ? <ErrorNotice error={feed.error} onRetry={() => void (feed.hasMore ? feed.loadMore() : refresh())} /> : null}
    /> : <View style={styles.center}><ErrorNotice error={feed.error} onRetry={() => void refresh()} />{!feed.error && <EmptyState title={mode === 'following' ? 'Your people, your feed' : 'No Reals yet'} detail={mode === 'following' ? 'Follow creators from Discover to see their uploads here.' : 'Upload your first moment or refresh to check for new videos.'} />}<Button title="Refresh feed" variant="secondary" onPress={() => void refresh()} /></View>}
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>{(['discover', 'following', 'recommended'] as const).map(value => <Pressable key={value} onPress={() => changeMode(value)} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} style={styles.mode}><Text style={[styles.modeText, mode === value && styles.selected]}>{value === 'discover' ? 'Explore' : value === 'following' ? 'Following' : 'For you'}</Text>{mode === value && <View style={styles.underline} />}</Pressable>)}</View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background }, center: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', gap: 24, justifyContent: 'center', paddingBottom: 18, backgroundColor: '#00000055' },
  mode: { alignItems: 'center', gap: 8 }, modeText: { fontSize: 14, color: '#ccccd4', fontWeight: '600', textShadowColor: '#000', textShadowRadius: 6 }, selected: { color: palette.text, fontWeight: '800' }, underline: { width: 22, height: 3, borderRadius: 3, backgroundColor: palette.accent },
});
