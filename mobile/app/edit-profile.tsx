import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Button, ErrorNotice, Field, palette, Screen } from '../src/components/ui';
import { useApi } from '../src/lib/api';
import { useResource } from '../src/lib/use-resource';
import { errorText } from '../src/features/social/use-paged-resource';
import type { User } from '../src/types';

export default function EditProfileScreen() {
  const profile = useResource<User>('/me');
  return <Screen title="Edit profile" back>
    {profile.loading && !profile.data && <ActivityIndicator color={palette.accent} />}
    <ErrorNotice error={profile.error} onRetry={() => void profile.refresh()} />
    {profile.data && <ProfileEditor key={profile.data.id} user={profile.data} />}
  </Screen>;
}

function ProfileEditor({ user }: { user: User }) {
  const api = useApi();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    const name = displayName.trim();
    const handle = username.trim().toLowerCase();
    if (!name || name.length > 60) { setError('Enter a display name between 1 and 60 characters.'); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) { setError('Your username needs 3–30 lowercase letters, numbers or underscores.'); return; }
    if (bio.length > 160) { setError('Keep your bio to 160 characters.'); return; }
    setSaving(true); setError(null);
    try {
      await api.patch<User>('/me', { displayName: name, username: handle, bio: bio.trim() });
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile');
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }

  return (
      <View style={styles.content}>
          <View style={styles.avatar}><Avatar user={user} size={80} /><Text style={styles.hint}>Make your profile feel like you.</Text></View>
          <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={60} editable={!saving} autoComplete="name" />
          <Field label="Username" value={username} onChangeText={setUsername} maxLength={30} editable={!saving} autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.hint}>Lowercase letters, numbers and underscores. At least 3 characters.</Text>
          <Field label="Bio" value={bio} onChangeText={setBio} maxLength={160} editable={!saving} multiline numberOfLines={4} textAlignVertical="top" style={styles.bio} />
          <Text style={styles.counter}>{bio.length}/160</Text>
          <ErrorNotice error={error} />
          <Button title="Save changes" loading={saving} onPress={() => void save()} />
      </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  avatar: { alignItems: 'center', gap: 14, paddingVertical: 10 },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  bio: { minHeight: 110 },
  counter: { color: palette.muted, fontSize: 11, textAlign: 'right', marginTop: -10 },
});
