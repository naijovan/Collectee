/**
 * Tab group — PRD §13.4 section 8.
 *
 * The bar itself is `@/components/TabBar`, passed in whole rather than
 * configured tab-by-tab, because two things in it are not standard tab
 * behaviour: the raised blue Import action and the onboarding gate on
 * Collections and Profile.
 *
 * The gate reads `hasImported` from context inside TabBar. Do not add a
 * `redirect` here as a second implementation of the same rule (§13.4).
 */

import { Tabs } from 'expo-router';

import { TabBar } from '@/components';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <TabBar />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="collections" options={{ title: 'Collections' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
