/**
 * Followers and following.
 *
 * One screen with two tabs rather than two routes: they are the same list of
 * the same shape, differing only in direction, and a user comparing "who
 * follows me" against "who I follow" should not have to navigate between them.
 *
 * `?tab=following` opens on the second tab, so the Profile stat can deep-link
 * to the half it counted.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, FilterChips, LoadingState } from '@/components';
import { socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { User } from '@/types';

const TABS = ['Followers', 'Following'] as const;
type Tab = (typeof TABS)[number];

export default function ConnectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewerId } = useApp();
  const { tab: initial } = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<Tab>(initial === 'following' ? 'Following' : 'Followers');
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      socialService.getFollowers(viewerId),
      socialService.getFollowing(viewerId),
    ]);
    setFollowers(a);
    setFollowing(b);
    setBusy(false);
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const people = tab === 'Followers' ? followers : following;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <FilterChips options={TABS} value={tab} onChange={setTab} />

      {busy ? (
        <LoadingState height={200} />
      ) : people.length === 0 ? (
        <Text style={styles.muted}>
          {tab === 'Followers'
            ? 'Nobody follows you yet. Publishing a collection or showroom is how that starts.'
            : 'You are not following anyone yet. Explore is where collectors are.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {people.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => router.push({ pathname: '/collector/[id]', params: { id: person.id } })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar
        name={person.displayName}
        avatarId={person.avatar}
        verified={person.isAccountVerified}
        size={40}
      />
              <View style={styles.rowBody}>
                <Text style={styles.name}>{person.displayName}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  @{person.handle}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.cardTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },
  chevron: { color: colors.textTertiary, fontSize: 20 },
  pressed: { opacity: 0.75 },
});
