import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ColorValue, TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { User } from '../types';

export const palette = {
  background: '#0c0c0f', surface: '#17171c', border: '#292930',
  text: '#fafafa', muted: '#9c9ca8', accent: '#fa507c', success: '#69d4ad',
};

export function Icon({ name, size = 22, color = palette.text }: {
  name: ComponentProps<typeof Feather>['name']; size?: number; color?: ColorValue;
}) { return <Feather name={name} size={size} color={color} />; }

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, variant === 'primary' ? styles.primary : variant === 'danger' ? styles.danger : variant === 'secondary' ? styles.secondary : undefined, { opacity: disabled || loading ? 0.45 : pressed ? 0.7 : 1 }]}>
      {loading ? <ActivityIndicator color={palette.text} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return <View style={styles.field}>{label && <Text style={styles.label}>{label}</Text>}<TextInput placeholderTextColor={palette.muted} {...props} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, props.style]} /></View>;
}

export function Screen({ title, children, back, right, scroll = true }: {
  title?: string; children: ReactNode; back?: boolean; right?: ReactNode; scroll?: boolean;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {title && <View style={styles.header}>{back && <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href)} accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12}><Icon name="arrow-left" /></Pressable>}<Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>{title}</Text>{right}</View>}
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView> : <View style={styles.fill}>{children}</View>}
    </SafeAreaView>
  );
}

export function ErrorNotice({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text>{onRetry && <Button title="Try again" onPress={onRetry} variant="ghost" />}</View>;
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.empty}><Icon name="compass" size={34} color={palette.muted} /><Text style={styles.emptyTitle}>{title}</Text>{detail && <Text style={styles.detail}>{detail}</Text>}</View>;
}

export function Avatar({ user, size = 48 }: { user: Pick<User, 'displayName' | 'avatarUrl'>; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (user.avatarUrl && failedUrl !== user.avatarUrl) return <Image source={{ uri: user.avatarUrl }} onError={() => setFailedUrl(user.avatarUrl)} accessibilityLabel={user.displayName} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return <View accessibilityLabel={user.displayName} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={{ color: palette.text, fontWeight: '700', fontSize: size * 0.36 }}>{user.displayName.trim().slice(0, 1).toUpperCase() || '?'}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  fill: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  heading: { flex: 1, color: palette.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  body: { padding: 20, gap: 16, paddingBottom: 40, flexGrow: 1 },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  primary: { backgroundColor: palette.accent }, secondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, danger: { backgroundColor: '#6b2839' },
  buttonText: { color: palette.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  field: { gap: 8 }, label: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: palette.surface, color: palette.text, borderWidth: 1, borderColor: palette.border, borderRadius: 14, minHeight: 50, padding: 14, fontSize: 16 },
  error: { backgroundColor: '#2a171f', borderRadius: 14, padding: 16, gap: 8 }, errorText: { color: '#ffb1c6', fontSize: 14, lineHeight: 21 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, flexGrow: 1 },
  emptyTitle: { color: palette.text, fontSize: 20, fontWeight: '600', textAlign: 'center' }, detail: { color: palette.muted, textAlign: 'center', lineHeight: 22 },
  avatar: { backgroundColor: '#653046', alignItems: 'center', justifyContent: 'center' },
});
