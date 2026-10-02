import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Button, EmptyState, ErrorNotice, Icon, palette, Screen } from '../../src/components/ui';
import { useFocusedPolling } from '../../src/features/messages/use-focused-polling';
import { usePagedResource, useRefreshOnReturn } from '../../src/features/social/use-paged-resource';
import type { Conversation } from '../../src/types';

function messageDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function InboxScreen() {
  const inbox = usePagedResource<Conversation>('/conversations');
  useRefreshOnReturn(inbox.refresh);
  useFocusedPolling(inbox.refreshLatest);
  return (
    <Screen title="Messages" scroll={false} right={<Pressable accessibilityRole="button" accessibilityLabel="Find someone to message" onPress={() => router.push('/(tabs)/people')} style={styles.compose}><Icon name="edit" size={20} /></Pressable>}>
      <View style={styles.heading}><Text style={styles.subtitle}>A little conversation goes a long way.</Text><ErrorNotice error={inbox.error} onRetry={() => void inbox.refresh()} /></View>
      <FlatList
        data={inbox.items}
        keyExtractor={(conversation) => conversation.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={inbox.refreshing && !inbox.loading} onRefresh={() => void inbox.refresh()} tintColor={palette.accent} />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Chat with ${item.otherUser.displayName}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/conversations/[id]', params: { id: item.id, name: item.otherUser.displayName, otherUserId: item.otherUser.id } })}>
          <Avatar user={item.otherUser} size={54} />
          <View style={styles.details}><View style={styles.topRow}><Text numberOfLines={1} style={styles.name}>{item.otherUser.displayName}</Text>{item.lastMessage && <Text style={styles.date}>{messageDate(item.lastMessage.createdAt)}</Text>}</View><Text numberOfLines={2} style={styles.preview}>{item.lastMessage?.text || 'Say hello to start the conversation.'}</Text></View>
          <Icon name="chevron-right" color={palette.muted} size={16} />
        </Pressable>}
        ListEmptyComponent={inbox.loading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : !inbox.error ? <View><EmptyState title="Your inbox is waiting" detail="Open a person's profile and tap Message to start a private conversation." /><Button title="Find people" variant="secondary" onPress={() => router.push('/(tabs)/people')} /></View> : null}
        ListFooterComponent={inbox.hasMore ? <View style={styles.footer}><Button title="Load older conversations" variant="secondary" loading={inbox.loadingMore} onPress={() => void inbox.loadMore()} /></View> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  compose: { padding: 8 },
  heading: { paddingHorizontal: 20, gap: 12, paddingBottom: 14 },
  subtitle: { color: palette.muted, fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  row: { paddingVertical: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: palette.border },
  pressed: { opacity: 0.6 },
  details: { flex: 1, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '600' },
  date: { color: palette.muted, fontSize: 10 },
  preview: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  loader: { padding: 40 },
  footer: { paddingTop: 20 },
});
