import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, ErrorNotice, Icon, palette } from '../components/ui';
import { useSession } from './session';

export function Welcome() {
  const session = useSession();
  const { height, width } = useWindowDimensions();
  const compact = height < 740 || width < 380;
  const [busy, setBusy] = useState<string | null>(null);
  const login = async (account?: 'alex' | 'sam', mode?: 'sign-in' | 'sign-up') => {
    setBusy(account || mode || 'sign-in');
    try { await session.login(account, mode); } catch {} finally { setBusy(null); }
  };
  return <SafeAreaView style={styles.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.brand}><View style={styles.logo}><Icon name="play" size={36} /></View><Text style={styles.wordmark}>INSTA REALS</Text></View>
    <View style={styles.hero}><Text style={[styles.title, compact && styles.compactTitle]}>Find your{"\n"}next perspective.</Text><Text style={styles.subtitle}>Watch something new. Share a moment.{"\n"}Make a connection.</Text></View>
    <View style={styles.actions}>
      {session.isDemo ? <><Text style={styles.demoLabel}>TRY THE LOCAL DEMO</Text><Text style={styles.demoDetail}>Two accounts. Real posts, likes, and conversations.</Text><View style={styles.accounts}>{(['alex', 'sam'] as const).map(account => <View key={account} style={styles.account}><Avatar user={{ displayName: account === 'alex' ? 'Alex' : 'Sam', avatarUrl: null }} size={42} /><View style={styles.accountAction}><Button title={`Continue as ${account === 'alex' ? 'Alex' : 'Sam'}`} loading={busy === account} disabled={Boolean(busy)} onPress={() => void login(account)} variant="secondary" /></View></View>)}</View></> : <><Button title="Get started" onPress={() => void login(undefined, 'sign-up')} loading={busy === 'sign-up'} disabled={Boolean(busy)} /><Button title="I already have an account" variant="secondary" onPress={() => void login(undefined, 'sign-in')} loading={busy === 'sign-in'} disabled={Boolean(busy)} /></>}
      <ErrorNotice error={session.error} />
    </View>
  </ScrollView></SafeAreaView>;
}

export function SessionLoading() { return <View style={styles.loading}><ActivityIndicator color={palette.accent} size="large" /></View>; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, padding: 28, justifyContent: 'space-between', gap: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  logo: { width: 60, height: 60, backgroundColor: palette.accent, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: palette.text, fontSize: 15, fontWeight: '800', letterSpacing: 2.5 },
  hero: { paddingVertical: 24 }, title: { color: palette.text, fontSize: 44, lineHeight: 50, letterSpacing: -2, fontWeight: '800' }, compactTitle: { fontSize: 36, lineHeight: 43, letterSpacing: -1.5 },
  subtitle: { color: palette.muted, fontSize: 17, lineHeight: 26, marginTop: 20 },
  actions: { gap: 14, paddingBottom: 24 }, demoLabel: { color: palette.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  demoDetail: { color: palette.muted, fontSize: 14, lineHeight: 22 }, accounts: { gap: 12 }, account: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  accountAction: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
