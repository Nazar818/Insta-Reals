import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../src/auth/session';
import { SessionLoading, Welcome } from '../src/auth/welcome';
import { Button, ErrorNotice, Screen } from '../src/components/ui';

function Routes() {
  const session = useSession();
  if (!session.ready) return <SessionLoading />;
  if (!session.signedIn) return <Welcome />;
  if (!session.userId) return <Screen title="Connecting your account"><SessionLoading /><ErrorNotice error={session.error} onRetry={() => void session.refreshIdentity()} /><Button title="Sign out" variant="ghost" onPress={() => void session.signOut()} /></Screen>;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#101014' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="comments/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <SessionProvider><Routes /></SessionProvider>;
}
