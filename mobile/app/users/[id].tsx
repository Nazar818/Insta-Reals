import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '../../src/components/ui';
import { ProfileScreen } from '../../src/features/social/profile-screen';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Screen back title="Profile"><EmptyState title="Profile unavailable" /></Screen>;
  return <ProfileScreen id={id} />;
}
