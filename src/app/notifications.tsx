/**
 * Notifications — PRD §11 F6 ("Following management, notifications, saved
 * articles"). Flow owner: Marcus (J5).
 *
 * `socialService.getNotifications` and `markAllRead` have existed since the
 * foundational base and had no screen: the unread dot on Home counted something
 * nobody could open. This is that screen.
 *
 * Each kind routes to the thing it is about, because a notification that cannot
 * be acted on is just a label. The mapping lives in `TARGETS` below rather than
 * in a switch inside the row, so an unroutable kind degrades to a non-tappable
 * row instead of a dead press.
 *
 * §14 rung 1: J5 is the first descope candidate. This screen reads seeded data
 * through the service layer and adds no new dependency, so cutting News does not
 * strand it — it simply stops being linked.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { EmptyState, LoadingState, SecondaryButton, timeAgo } from '@/components';
import { socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Notification, NotificationKind } from '@/types';

/**
 * Where each kind leads, and what it looks like.
 *
 * `href` returns null for kinds with nowhere sensible to go — the row still
 * renders, it just is not pressable. A notification about a resolved flag has no
 * destination the user should be sent to (§9.2 keeps moderation decisions out of
 * the reporter's hands), so it says its piece and stops there.
 */
const TARGETS: Record<
  NotificationKind,
  { glyph: string; href: (targetId: string) => Href | null }
> = {
  follow: {
    glyph: '＋',
    href: (id) => ({ pathname: '/collector/[id]', params: { id } }),
  },
  comment: {
    glyph: '❝',
    href: (id) => ({ pathname: '/collection/[id]', params: { id } }),
  },
  like: {
    glyph: '♥',
    href: (id) => ({ pathname: '/collection/[id]', params: { id } }),
  },
  community_post: {
    glyph: '▦',
    href: (id) => ({ pathname: '/community/[id]', params: { id } }),
  },
  news: {
    glyph: '◆',
    href: (id) => ({ pathname: '/article/[id]', params: { id } }),
  },
  flag_resolved: {
    glyph: '⚑',
    href: () => null,
  },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { viewerId, markNotificationsRead } = useApp();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setNotifications(await socialService.getNotifications(viewerId));
    setBusy(false);
  }, [viewerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function markAll() {
    // Through context, not the service directly: the unread dot on Home reads
    // from context, and marking read in one place only would leave the two
    // disagreeing.
    await markNotificationsRead();
    await load();
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="Follows, comments and news about items you own will show up here."
        />
      ) : null}

      {unread > 0 ? (
        <View style={styles.headRow}>
          <Text style={styles.muted}>
            {unread} unread of {notifications.length}
          </Text>
          <SecondaryButton label="Mark all read" onPress={() => void markAll()} />
        </View>
      ) : notifications.length > 0 ? (
        <Text style={styles.muted}>All caught up.</Text>
      ) : null}

      {notifications.map((notification) => {
        const target = TARGETS[notification.kind];
        const href = target.href(notification.targetId);

        const row = (
          <View style={[styles.row, !notification.read && styles.rowUnread]}>
            <View style={styles.glyphWrap}>
              <Text style={styles.glyph}>{target.glyph}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.body}>{notification.body}</Text>
              <Text style={styles.footnote}>
                {timeAgo(notification.createdAt)}
                {href ? '' : ' · no action needed'}
              </Text>
            </View>
            {notification.read ? null : <View style={styles.unreadDot} />}
          </View>
        );

        return href ? (
          <Pressable key={notification.id} onPress={() => router.push(href)}>
            {row}
          </Pressable>
        ) : (
          <View key={notification.id}>{row}</View>
        );
      })}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.sm },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { ...typography.meta, color: colors.textSecondary },
  body: { ...typography.body, color: colors.textPrimary },
  footnote: { ...typography.meta, color: colors.textTertiary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowUnread: { borderColor: colors.accent },
  rowBody: { flex: 1, gap: 2 },
  glyphWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 16, color: colors.accent },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
