import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/auth/session';
import { Button, EmptyState, ErrorNotice, Field, Icon, palette, Screen } from '../../src/components/ui';
import { useApi } from '../../src/lib/api';
import { useResource } from '../../src/lib/use-resource';
import { useFocusedPolling } from '../../src/features/messages/use-focused-polling';
import { useMessageThread } from '../../src/features/messages/use-message-thread';
import { errorText, useRefreshOnReturn } from '../../src/features/social/use-paged-resource';
import type { Conversation, Message, Page, User } from '../../src/types';

export default function ConversationScreen() {
  const { id, name, otherUserId } = useLocalSearchParams<{ id: string; name?: string; otherUserId?: string }>();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { userId } = useSession();
  const thread = useMessageThread(id);
  const conversations = useResource<Page<Conversation>>(id && !otherUserId ? '/conversations' : null);
  const otherProfile = useResource<User>(otherUserId ? `/users/${encodeURIComponent(otherUserId)}` : null);
  const otherUser = otherProfile.data ?? conversations.data?.items.find((conversation) => conversation.id === id)?.otherUser;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);
  useFocusedPolling(thread.refresh);
  useRefreshOnReturn(thread.refresh);

  async function send() {
    if (!id || !text.trim() || sending) return;
    setSending(true); setError(null);
    try {
      const message = await api.post<Message>(`/conversations/${encodeURIComponent(id)}/messages`, { text: text.trim() });
      thread.addMessage(message);
      setText('');
      list.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (cause) { setError(errorText(cause)); }
    finally { setSending(false); }
  }

  return (
    <Screen title={otherUser?.displayName || name || 'Conversation'} back scroll={false} right={otherUser ? <Pressable accessibilityRole="button" accessibilityLabel="View profile" onPress={() => router.push({ pathname: '/users/[id]', params: { id: otherUser.id } })} style={styles.profileButton}><Icon name="user" size={20} /></Pressable> : undefined}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.notice}><ErrorNotice error={thread.error} onRetry={() => void thread.refresh()} /></View>
        {thread.loading ? <View style={styles.loader}><ActivityIndicator color={palette.accent} /></View> : thread.messages.length === 0 ? !thread.error ? <EmptyState title="Say hello" detail="Your messages are private to the two members of this conversation." /> : <View style={styles.fill} /> :
          <FlatList
            ref={list}
            data={thread.messages}
            inverted
            keyExtractor={(message) => message.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            renderItem={({ item }) => <View style={[styles.messageRow, item.senderId === userId ? styles.ownRow : styles.otherRow]}>
              <View style={[styles.bubble, item.senderId === userId ? styles.ownBubble : styles.otherBubble]}><Text style={styles.message}>{item.text}</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text></View>
            </View>}
            ListFooterComponent={thread.hasMore ? <View style={styles.older}><Button title="Load older messages" variant="ghost" loading={thread.loadingMore} onPress={() => void thread.loadMore()} /></View> : null}
          />
        }
        <View style={[styles.composer, { paddingBottom: 16 + insets.bottom }]}>
          <ErrorNotice error={error} />
          <Field placeholder="Message…" accessibilityLabel="Message text" value={text} onChangeText={setText} multiline maxLength={2000} editable={!sending} style={styles.input} />
          <View style={styles.composerFooter}><Text style={styles.counter}>{text.length}/2000</Text><Button title="Send" disabled={!text.trim() || !id || thread.loading} loading={sending} onPress={() => void send()} /></View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  profileButton: { padding: 8 },
  notice: { paddingHorizontal: 20, paddingTop: 8 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  messageRow: { flexDirection: 'row' },
  ownRow: { justifyContent: 'flex-end' },
  otherRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '86%', borderRadius: 18, padding: 14, gap: 8 },
  ownBubble: { backgroundColor: '#943450', borderBottomRightRadius: 5 },
  otherBubble: { backgroundColor: palette.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: palette.border },
  message: { color: palette.text, fontSize: 15, lineHeight: 22 },
  time: { color: '#ddd1d6', fontSize: 10 },
  older: { paddingVertical: 14 },
  composer: { backgroundColor: palette.background, borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, gap: 10 },
  input: { minHeight: 54, maxHeight: 130 },
  composerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: palette.muted, fontSize: 11 },
});
