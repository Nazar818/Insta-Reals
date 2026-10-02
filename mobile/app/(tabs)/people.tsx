import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../src/auth/session';
import { Avatar, Button, EmptyState, ErrorNotice, Field, palette, Screen } from '../../src/components/ui';
import { useApi } from '../../src/lib/api';
import { errorText, usePagedResource, useRefreshOnReturn } from '../../src/features/social/use-paged-resource';
import type { User } from '../../src/types';

export default function PeopleScreen() {
  const api = useApi();
  const { userId } = useSession();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const users = usePagedResource<User>(`/users?query=${encodeURIComponent(search)}`);
  useRefreshOnReturn(users.refresh);

  async function follow(user: User) {
    if (followingId) return;
    setFollowingId(user.id); setActionError(null);
    try {
      const path = `/users/${encodeURIComponent(user.id)}/follow`;
      const updated = user.viewerIsFollowing ? await api.delete<User>(path) : await api.put<User>(path);
      users.setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) { setActionError(errorText(cause)); }
    finally { setFollowingId(null); }
  }

  return (
    <Screen title="Discover people" scroll={false}>
      <View style={styles.search}>
        <Text style={styles.subtitle}>Find creators. Make connections.</Text>
        <Field placeholder="Search names or usernames" accessibilityLabel="Search people" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        <ErrorNotice error={actionError} />
        <ErrorNotice error={users.error} onRetry={() => void users.refresh()} />
      </View>
      <FlatList
        data={users.items}
        keyExtractor={(user) => user.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={users.refreshing && !users.loading} onRefresh={() => void users.refresh()} tintColor={palette.accent} />}
        renderItem={({ item: user }) => <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${user.displayName}'s profile`} style={styles.person} onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } })}>
            <Avatar user={user} size={48} />
            <View style={styles.details}><Text numberOfLines={1} style={styles.name}>{user.displayName}</Text><Text numberOfLines={1} style={styles.username}>@{user.username}</Text><Text style={styles.followers}>{user.followerCount} followers</Text></View>
          </Pressable>
          {user.id !== userId && <Button title={user.viewerIsFollowing ? 'Following' : 'Follow'} variant={user.viewerIsFollowing ? 'secondary' : 'primary'} loading={followingId === user.id} disabled={Boolean(followingId)} onPress={() => void follow(user)} />}
        </View>}
        ListEmptyComponent={users.loading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : !users.error ? <EmptyState title={search ? 'No people found' : 'No other accounts yet'} detail={search ? 'Try a different name or username.' : 'New accounts will appear here when they join.'} /> : null}
        ListFooterComponent={users.hasMore ? <View style={styles.footer}><Button title="Load more people" variant="secondary" loading={users.loadingMore} onPress={() => void users.loadMore()} /></View> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 20, gap: 14, paddingBottom: 16 },
  subtitle: { color: palette.muted, fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 25, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border },
  person: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' },
  details: { flex: 1, gap: 4 },
  name: { color: palette.text, fontSize: 15, fontWeight: '600' },
  username: { color: palette.muted, fontSize: 12 },
  followers: { color: palette.muted, fontSize: 11 },
  loader: { padding: 40 },
  footer: { paddingTop: 22 },
});
