import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../auth/session';
import { Avatar, Button, EmptyState, ErrorNotice, Icon, palette, Screen } from '../../components/ui';
import { useApi } from '../../lib/api';
import { useResource } from '../../lib/use-resource';
import type { Conversation, FeedVideo, User } from '../../types';
import { errorText, usePagedResource, useRefreshOnReturn } from './use-paged-resource';
import { VideoGrid } from './video-grid';

export function ProfileScreen({ id }: { id?: string }) {
  const api = useApi();
  const { userId, isDemo, signOut } = useSession();
  const profile = useResource<User>(id ? `/users/${encodeURIComponent(id)}` : '/me');
  const videos = usePagedResource<FeedVideo>(profile.data ? `/users/${encodeURIComponent(profile.data.id)}/videos` : null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [action, setAction] = useState<'follow' | 'message' | 'signout' | null>(null);
  const own = !id || profile.data?.id === userId;
  useRefreshOnReturn(profile.refresh);
  useRefreshOnReturn(videos.refresh);

  async function refresh() { await Promise.all([profile.refresh(), videos.refresh()]); }
  async function follow() {
    if (!profile.data || action) return;
    setAction('follow'); setActionError(null);
    try {
      const path = `/users/${encodeURIComponent(profile.data.id)}/follow`;
      const updated = profile.data.viewerIsFollowing ? await api.delete<User>(path) : await api.put<User>(path);
      profile.setData(updated);
    } catch (cause) { setActionError(errorText(cause)); }
    finally { setAction(null); }
  }
  async function message() {
    if (!profile.data || action) return;
    setAction('message'); setActionError(null);
    try {
      const conversation = await api.post<Conversation>('/conversations', { userId: profile.data.id });
      router.push({ pathname: '/conversations/[id]', params: { id: conversation.id, name: profile.data.displayName, otherUserId: profile.data.id } });
    } catch (cause) { setActionError(errorText(cause)); }
    finally { setAction(null); }
  }
  async function exit() {
    setAction('signout'); setActionError(null);
    try { await signOut(); }
    catch (cause) { setActionError(errorText(cause)); }
    finally { setAction(null); }
  }

  return (
    <Screen title={own ? 'Your profile' : 'Profile'} back={Boolean(id)} scroll={false}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={videos.refreshing && !videos.loading} onRefresh={() => void refresh()} tintColor={palette.accent} />}>
        {profile.loading && !profile.data && <ActivityIndicator color={palette.accent} style={styles.loader} />}
        <ErrorNotice error={profile.error} onRetry={() => void profile.refresh()} />
        {profile.data && <>
          <View style={styles.hero}>
            <View style={styles.avatarRing}><Avatar user={profile.data} size={90} /></View>
            <Text style={styles.name}>{profile.data.displayName}</Text>
            <Text style={styles.username}>@{profile.data.username}</Text>
            {Boolean(profile.data.bio) && <Text style={styles.bio}>{profile.data.bio}</Text>}
            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.statValue}>{profile.data.followerCount}</Text><Text style={styles.statLabel}>Followers</Text></View>
              <View style={styles.stat}><Text style={styles.statValue}>{profile.data.followingCount}</Text><Text style={styles.statLabel}>Following</Text></View>
            </View>
          </View>
          <ErrorNotice error={actionError} />
          <View style={styles.actions}>
            {own ? <>
              <View style={styles.action}><Button title="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} /></View>
              <View style={styles.action}><Button title="Watch history" variant="secondary" onPress={() => router.push('/history')} /></View>
            </> : <>
              <View style={styles.action}><Button title={profile.data.viewerIsFollowing ? 'Following' : 'Follow'} variant={profile.data.viewerIsFollowing ? 'secondary' : 'primary'} loading={action === 'follow'} disabled={Boolean(action)} onPress={() => void follow()} /></View>
              <View style={styles.action}><Button title="Message" variant="secondary" loading={action === 'message'} disabled={Boolean(action)} onPress={() => void message()} /></View>
            </>}
          </View>
          <View style={styles.sectionHeading}><Icon name="grid" size={18} color={palette.muted} /><Text style={styles.sectionTitle}>Reels</Text></View>
          <ErrorNotice error={videos.error} onRetry={() => void videos.refresh()} />
          {videos.loading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : videos.items.length > 0 ? <VideoGrid videos={videos.items} /> : !videos.error ? <EmptyState title={own ? 'Your first reel starts here' : 'No reels yet'} detail={own ? 'Share a video from the Create tab to see it on your profile.' : 'Reels will appear here when this person uploads a video.'} /> : null}
          {videos.hasMore && <Button title="Load more reels" variant="secondary" loading={videos.loadingMore} onPress={() => void videos.loadMore()} />}
          {own && <View style={styles.account}>
            <Text style={styles.accountText}>{isDemo ? 'Local demo account · your changes are saved on this backend.' : 'Your profile and activity are saved to your account.'}</Text>
            <Button title={isDemo ? 'Switch demo account' : 'Sign out'} variant="ghost" loading={action === 'signout'} onPress={() => void exit()} />
          </View>}
        </>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 30, gap: 18 },
  loader: { padding: 28 },
  hero: { alignItems: 'center', paddingTop: 20, gap: 8 },
  avatarRing: { borderWidth: 2, borderColor: palette.accent, padding: 5, borderRadius: 56, marginBottom: 8 },
  name: { fontSize: 25, fontWeight: '700', color: palette.text },
  username: { fontSize: 14, color: palette.muted },
  bio: { fontSize: 14, lineHeight: 21, color: palette.text, textAlign: 'center', marginTop: 5 },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 50, paddingTop: 16 },
  stat: { alignItems: 'center', gap: 5 },
  statValue: { color: palette.text, fontSize: 21, fontWeight: '700' },
  statLabel: { color: palette.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: palette.text },
  account: { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 14, paddingTop: 20, gap: 8 },
  accountText: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
