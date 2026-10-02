import { Tabs } from 'expo-router';
import { Icon, palette } from '../../src/components/ui';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.text, tabBarInactiveTintColor: palette.muted, tabBarStyle: { backgroundColor: palette.background, borderTopColor: palette.border }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Reals', tabBarIcon: ({ color }) => <Icon name="play" color={color} /> }} />
    <Tabs.Screen name="people" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Icon name="search" color={color} /> }} />
    <Tabs.Screen name="upload" options={{ title: 'Create', tabBarIcon: ({ focused }) => <Icon name="plus-square" size={28} color={focused ? palette.text : palette.accent} /> }} />
    <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: ({ color }) => <Icon name="message-circle" color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <Icon name="user" color={color} /> }} />
  </Tabs>;
}
