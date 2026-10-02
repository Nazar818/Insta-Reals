import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, EmptyState, ErrorNotice, palette, Screen } from '../src/components/ui';
import { usePagedResource, useRefreshOnReturn } from '../src/features/social/use-paged-resource';
import { VideoGrid } from '../src/features/social/video-grid';
import type { FeedVideo } from '../src/types';

export default function HistoryScreen() {
  const history = usePagedResource<FeedVideo>('/me/history');
  useRefreshOnReturn(history.refresh);
  return (
    <Screen title="Watch history" back scroll={false}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={history.refreshing && !history.loading} onRefresh={() => void history.refresh()} tintColor={palette.accent} />}>
        <Text style={styles.subtitle}>Good reels deserve a second look.</Text>
        <ErrorNotice error={history.error} onRetry={() => void history.refresh()} />
        {history.loading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : history.items.length ? <VideoGrid videos={history.items} /> : !history.error ? <EmptyState title="Nothing watched yet" detail="Videos you've spent time watching will appear here, with the most recent first." /> : null}
        {history.hasMore && <Button title="Load older videos" variant="secondary" loading={history.loadingMore} onPress={() => void history.loadMore()} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 30, gap: 20 },
  subtitle: { color: palette.muted, fontSize: 14 },
  loader: { padding: 40 },
});
