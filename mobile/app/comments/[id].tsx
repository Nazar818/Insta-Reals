import { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, EmptyState, ErrorNotice, Field, palette, Screen } from '../../src/components/ui';
import { useApi } from '../../src/lib/api';
import { errorText, uniqueItems, usePagedResource } from '../../src/features/social/use-paged-resource';
import type { Comment } from '../../src/types';

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const comments = usePagedResource<Comment>(id ? `/videos/${encodeURIComponent(id)}/comments` : null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    if (!id || !text.trim() || posting) return;
    setPosting(true); setError(null);
    try {
      const comment = await api.post<Comment>(`/videos/${encodeURIComponent(id)}/comments`, { text: text.trim() });
      setText('');
      await comments.refresh();
      comments.setItems((current) => uniqueItems([comment, ...current]));
    } catch (cause) { setError(errorText(cause)); }
    finally { setPosting(false); }
  }

  return (
    <Screen title="Comments" back scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <View style={styles.notice}><ErrorNotice error={comments.error} onRetry={() => void comments.refresh()} /></View>
        <FlatList
          data={comments.items}
          keyExtractor={(comment) => comment.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={comments.refreshing && !comments.loading} onRefresh={() => void comments.refresh()} tintColor={palette.accent} />}
          renderItem={({ item }) => <View style={styles.comment}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.author.displayName}'s profile`} onPress={() => router.push({ pathname: '/users/[id]', params: { id: item.author.id } })}><Avatar user={item.author} size={38} /></Pressable>
            <View style={styles.body}><View style={styles.commentHeading}><Pressable onPress={() => router.push({ pathname: '/users/[id]', params: { id: item.author.id } })}><Text style={styles.author}>{item.author.displayName}</Text></Pressable><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text></View><Text style={styles.text}>{item.text}</Text></View>
          </View>}
          ListEmptyComponent={comments.loading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : !comments.error ? <EmptyState title="Start the conversation" detail="Be the first to leave a comment on this reel." /> : null}
          ListFooterComponent={comments.hasMore ? <View style={styles.footer}><Button title="Load older comments" variant="secondary" loading={comments.loadingMore} onPress={() => void comments.loadMore()} /></View> : null}
        />
        <View style={[styles.composer, { paddingBottom: 16 + insets.bottom }]}>
          <ErrorNotice error={error} />
          <Field accessibilityLabel="Your comment" placeholder="Add a comment…" multiline maxLength={2000} value={text} onChangeText={setText} editable={!posting} style={styles.input} />
          <View style={styles.composerFooter}><Text style={styles.counter}>{text.length}/2000</Text><Button title="Post comment" disabled={!text.trim() || !id} loading={posting} onPress={() => void post()} /></View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  notice: { paddingHorizontal: 20, paddingTop: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  comment: { flexDirection: 'row', gap: 12, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: palette.border },
  body: { flex: 1, gap: 7 },
  commentHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  author: { color: palette.text, fontSize: 13, fontWeight: '700' },
  date: { color: palette.muted, fontSize: 10 },
  text: { color: palette.text, fontSize: 14, lineHeight: 21 },
  loader: { padding: 40 },
  footer: { paddingTop: 20 },
  composer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background },
  input: { minHeight: 54, maxHeight: 120 },
  composerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: palette.muted, fontSize: 11 },
});
