/**
 * A community thread — J4 (PRD §10, §11 F5). Flow owner: Marcus.
 *
 * The social heart of a community: a pull worth showing off, an argument about
 * a patch, or two people arranging to play tonight.
 *
 * Everything moderation-shaped on this screen is decided by the service, not
 * here (see `threadService.getThreadView`). This file renders `nodes`,
 * `withheldCount` and `blockedCount` — it never filters a reply itself, because
 * a screen that could filter is a screen that can forget to.
 *
 * Two §9.2 rules made visible:
 *   - A reported reply is WITHHELD and said out loud, never silently deleted.
 *     Flags do not auto-remove, so pretending the reply never existed would
 *     misrepresent what the system actually did.
 *   - A blocked author's replies vanish for the blocker alone, and the count
 *     says so — hiding the fact that something was hidden is its own problem.
 *
 * §14 rung 3: posting is gated, reading never is.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ASSISTANT_CLEARANCE, Avatar, EmptyState, KeyboardSafe, LoadingState, PrimaryButton, SectionHeader, timeAgo } from '@/components';
import { FLAG_REASON_DESCRIPTIONS, FLAG_REASON_LABELS } from '@/domain/trust';
import * as haptics from '@/lib/haptics';
import { socialService, threadService } from '@/services';
import type { ThreadView } from '@/services';
import type { VoteDirection } from '@/domain/threads';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Community, User } from '@/types';

/** Content reasons only — an ownership dispute makes no sense against a reply. */
const REPORT_REASONS = ['abusive_content', 'spam'] as const;

type ReportTarget = { kind: 'thread' | 'comment'; id: string; label: string };

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { viewerId } = useApp();

  const [view, setView] = useState<ThreadView | null>(null);
  const [authors, setAuthors] = useState<ReadonlyMap<string, User>>(new Map());
  const [community, setCommunity] = useState<Community | null>(null);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportedIds, setReportedIds] = useState<ReadonlySet<string>>(new Set());
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(true);
  /**
   * Buried replies the reader has chosen to open.
   *
   * Screen state, not service state, and deliberately so: revealing something
   * is a disclosure this reader made on this visit. Putting it in the service
   * would make it look like a property of the reply.
   *
   * Kept across a reload of the view — voting refetches, and a reply
   * re-collapsing under the finger that just opened it would be maddening.
   */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    const next = await threadService.getThreadView(id, viewerId);
    if (!next) {
      setBusy(false);
      return;
    }
    const [users, group] = await Promise.all([
      socialService.getUsers(),
      socialService.getCommunity(next.thread.communityId),
    ]);
    setView(next);
    setAuthors(new Map(users.map((user) => [user.id, user])));
    setCommunity(group);
    setBusy(false);
  }, [id, viewerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * Cast the pressed direction and re-read the thread.
   *
   * Reloading rather than patching one row in place: a vote changes the ranking
   * as well as the score, and the ranking is the domain's to decide. Patching
   * locally would show a new number in an order the domain would not have
   * produced, and the two would disagree until the next navigation.
   *
   * `LATENCY_INSTANT` on the write and the read makes this imperceptible.
   */
  async function castVote(commentId: string, pressed: 'up' | 'down') {
    haptics.selection();
    await threadService.voteOnReply(viewerId, commentId, pressed);
    await load();
  }

  async function submitReply() {
    if (!view || draft.trim().length === 0) return;
    setPosting(true);
    try {
      await threadService.addReply({
        threadId: view.thread.id,
        userId: viewerId,
        body: draft,
        parentId: replyingTo,
      });
      setDraft('');
      setReplyingTo(null);
      await load();
    } finally {
      setPosting(false);
    }
  }

  async function report(reason: (typeof REPORT_REASONS)[number]) {
    if (!reportTarget) return;
    await threadService.report({
      targetType: reportTarget.kind,
      targetId: reportTarget.id,
      reporterId: viewerId,
      reason,
    });
    setReportedIds((prev) => new Set([...prev, reportTarget.id]));
    setReportTarget(null);
    // Re-read: a second report can cross the threshold, at which point the
    // service withholds the reply and this screen must stop showing it.
    await load();
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={240} />
      </View>
    );
  }

  if (!view) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState title="Thread not found" body="It may have been removed, or the link is wrong." />
      </View>
    );
  }

  const author = authors.get(view.thread.userId);
  /* Counts buried replies too — they are still replies, and a count that
     moved when something folded away would read as a bug. */
  const replyTotal = view.ranked.reduce((total, node) => total + 1 + node.children.length, 0);

  return (
    /* The reply composer sits at the bottom of this scroll view — without this
       the iOS keyboard covers the field the user just tapped. */
    <KeyboardSafe>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {community ? (
        <Pressable
          onPress={() => router.push({ pathname: '/community/[id]', params: { id: community.id } })}
          hitSlop={8}
        >
          <Text style={styles.breadcrumb}>‹ {community.name}</Text>
        </Pressable>
      ) : null}

      <View style={styles.threadHead}>
        {view.thread.pinned ? <Text style={styles.pinned}>PINNED</Text> : null}
        <Text style={styles.title}>{view.thread.title}</Text>
        <View style={styles.byline}>
          <Avatar
          name={author?.displayName ?? '?'}
          avatarId={author?.avatar}
          verified={author?.isAccountVerified}
          size={28}
        />
          <Text style={styles.muted}>
            {author?.displayName ?? 'Unknown'} · {timeAgo(view.thread.createdAt)}
          </Text>
        </View>
        {view.thread.body.length > 0 ? <Text style={styles.body}>{view.thread.body}</Text> : null}
        <Pressable
          onPress={() =>
            setReportTarget({ kind: 'thread', id: view.thread.id, label: view.thread.title })
          }
          hitSlop={8}
        >
          <Text style={styles.reportLink}>
            {reportedIds.has(view.thread.id) ? 'Reported' : 'Report thread'}
          </Text>
        </Pressable>
      </View>

      <SectionHeader title={`${replyTotal} ${replyTotal === 1 ? 'reply' : 'replies'}`} />

      {/*
        Said out loud, not hidden. §9.2 flags remove nothing, so a thread that
        quietly rendered fewer replies would misdescribe what happened.
      */}
      {view.withheldCount > 0 ? (
        <Text style={styles.withheld}>
          {view.withheldCount} {view.withheldCount === 1 ? 'reply is' : 'replies are'} withheld while
          reported content is reviewed. Nothing has been deleted.
        </Text>
      ) : null}
      {view.blockedCount > 0 ? (
        <Text style={styles.footnote}>
          {view.blockedCount} {view.blockedCount === 1 ? 'reply is' : 'replies are'} hidden because
          you blocked the author.
        </Text>
      ) : null}

      {view.ranked.length === 0 ? (
        <EmptyState
          title="No replies yet"
          body={view.canReply ? 'Be the first to say something.' : 'Nobody has replied to this thread.'}
        />
      ) : null}

      {view.ranked.map((node) => {
        const nodeAuthor = authors.get(node.reply.userId);
        /* Buried until the reader asks. `revealed` is per-reply and lives in
           the screen, not the service: it is a UI disclosure, not a vote, and
           it must not survive into anyone else's view of the thread. */
        if (node.buried && !revealed.has(node.reply.id)) {
          return (
            <View key={node.reply.id} style={styles.replyBlock}>
              <BuriedReply
                score={node.score}
                onShow={() => setRevealed((current) => new Set(current).add(node.reply.id))}
              />
            </View>
          );
        }
        return (
          <View key={node.reply.id} style={styles.replyBlock}>
            <ReplyRow
              body={node.reply.body}
              authorName={nodeAuthor?.displayName ?? 'Unknown'}
              authorAvatarId={nodeAuthor?.avatar}
              verified={nodeAuthor?.isAccountVerified}
              createdAt={node.reply.createdAt}
              likeCount={node.reply.likeCount}
              reported={reportedIds.has(node.reply.id)}
              score={node.score}
              vote={node.vote}
              onVote={(pressed) => castVote(node.reply.id, pressed)}
              onReport={() =>
                setReportTarget({
                  kind: 'comment',
                  id: node.reply.id,
                  label: `${nodeAuthor?.displayName ?? 'this'} reply`,
                })
              }
              onReply={view.canReply ? () => setReplyingTo(node.reply.id) : undefined}
            />

            {node.children.map((childNode) => {
              const child = childNode.reply;
              const childAuthor = authors.get(child.userId);
              /* Children are votable and scored, but never buried: a nested
                 reply is already subordinate to its parent, and folding one
                 away leaves the reply above it answering nobody. */
              return (
                <View key={child.id} style={styles.nested}>
                  <ReplyRow
                    body={child.body}
                    authorName={childAuthor?.displayName ?? 'Unknown'}
                    authorAvatarId={childAuthor?.avatar}
                    verified={childAuthor?.isAccountVerified}
                    createdAt={child.createdAt}
                    likeCount={child.likeCount}
                    reported={reportedIds.has(child.id)}
                    score={childNode.score}
                    vote={childNode.vote}
                    onVote={(pressed) => castVote(child.id, pressed)}
                    onReport={() =>
                      setReportTarget({
                        kind: 'comment',
                        id: child.id,
                        label: `${childAuthor?.displayName ?? 'this'} reply`,
                      })
                    }
                    // No onReply: one level of nesting (§11 F5). Replying to a
                    // child would render against its parent anyway, so offering
                    // it would promise depth the thread does not have.
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      {/* §9.2 — a report is a claim, not a takedown. Same reason picker as B4. */}
      {reportTarget ? (
        <View style={styles.reportPanel}>
          <Text style={styles.rowTitle}>Report {reportTarget.label}</Text>
          <Text style={styles.muted}>
            Reports join the same review queue as item disputes and remove nothing on their own.
          </Text>
          {REPORT_REASONS.map((reason) => (
            <Pressable key={reason} style={styles.reportReason} onPress={() => void report(reason)}>
              <Text style={styles.rowTitle}>{FLAG_REASON_LABELS[reason]}</Text>
              <Text style={styles.muted}>{FLAG_REASON_DESCRIPTIONS[reason]}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setReportTarget(null)} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {view.canReply ? (
        <View style={styles.composer}>
          {replyingTo ? (
            <View style={styles.replyingTo}>
              <Text style={styles.muted}>
                Replying to {authors.get(
                  view.ranked.find((n) => n.reply.id === replyingTo)?.reply.userId ?? '',
                )?.displayName ?? 'a reply'}
              </Text>
              <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Text style={styles.reportLink}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={replyingTo ? 'Write a reply' : 'Add to the thread'}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={styles.input}
          />
          <PrimaryButton
            label={posting ? 'Posting…' : 'Post reply'}
            disabled={posting || draft.trim().length === 0}
            onPress={() => void submitReply()}
          />
        </View>
      ) : (
        <Text style={styles.footnote}>{view.postingBlockedReason}</Text>
      )}

      {/* The floating assistant sits over this corner. Reserve its real height
          so the last row — including any rule above a footnote — is never
          resting underneath it. `spacing.xxl` was not enough: it is 32 against
          the launcher's 184. */}
      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
    </KeyboardSafe>
  );
}

function ReplyRow({
  body,
  authorName,
  authorAvatarId,
  verified,
  createdAt,
  likeCount,
  reported,
  score,
  vote,
  onVote,
  onReport,
  onReply,
}: {
  body: string;
  authorName: string;
  authorAvatarId?: string | null;
  verified?: boolean;
  createdAt: string;
  likeCount: number;
  reported: boolean;
  score: number;
  vote: VoteDirection;
  onVote: (pressed: 'up' | 'down') => void;
  onReport: () => void;
  onReply?: () => void;
}) {
  return (
    <View style={styles.reply}>
      {/* Name-only: a reply row is handed strings, not the author record.
          Passing the id through keeps the face consistent with the thread
          header above it, which does have the user. */}
      <Avatar name={authorName} avatarId={authorAvatarId} verified={verified} size={30} />
      <View style={styles.replyBody}>
        <Text style={styles.rowTitle}>
          {authorName} <Text style={styles.muted}>· {timeAgo(createdAt)}</Text>
        </Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.replyActions}>
          {/*
            Votes, and they sit APART from Report deliberately — different
            mechanisms, and putting a downvote next to a report invites the
            reader to treat one as a softer version of the other. The arrows
            are the leftmost thing in the row and Report stays where it was.

            Each arrow is its own Pressable, siblings of the score between
            them, so nothing here nests a button in a button.
          */}
          <View style={styles.voteGroup}>
            <Pressable
              onPress={() => onVote('up')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: vote === 'up' }}
              accessibilityLabel={vote === 'up' ? 'Remove your upvote' : 'Upvote this reply'}
              style={styles.voteButton}
            >
              <Text style={[styles.voteGlyph, vote === 'up' && styles.voteUpOn]}>▲</Text>
            </Pressable>
            {/* One number, and it is the net score — not "12 up, 3 down".
                Two numbers invite arithmetic; the thing a reader wants is
                whether the room agreed. */}
            <Text
              style={[
                styles.voteScore,
                vote === 'up' && styles.voteUpOn,
                vote === 'down' && styles.voteDownOn,
              ]}
              accessibilityLabel={`Score ${score}`}
            >
              {score}
            </Text>
            <Pressable
              onPress={() => onVote('down')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: vote === 'down' }}
              accessibilityLabel={vote === 'down' ? 'Remove your downvote' : 'Downvote this reply'}
              style={styles.voteButton}
            >
              <Text style={[styles.voteGlyph, vote === 'down' && styles.voteDownOn]}>▼</Text>
            </Pressable>
          </View>

          {likeCount > 0 ? <Text style={styles.footnote}>♥ {likeCount}</Text> : null}
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={8}>
              <Text style={styles.reportLink}>Reply</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onReport} hitSlop={8}>
            <Text style={styles.reportLink}>{reported ? 'Reported' : 'Report'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * A reply the room voted down, folded away.
 *
 * Collapsed rather than dimmed, and collapsed rather than removed. §9.2's rule
 * that flags never auto-remove is about reports, but the same principle is the
 * right one here for a softer reason: a downvote is an opinion, and an opinion
 * should be able to push something out of the way without deciding nobody may
 * read it. One tap opens it, and it opens into the ordinary row — including its
 * own Report control, because burying is not reporting.
 */
function BuriedReply({ score, onShow }: { score: number; onShow: () => void }) {
  return (
    <Pressable
      onPress={onShow}
      accessibilityRole="button"
      accessibilityLabel={`Show a reply with a score of ${score}`}
      style={({ pressed }) => [styles.buried, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.buriedText}>
        Reply hidden by downvotes · {score} — <Text style={styles.buriedShow}>show</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  breadcrumb: { ...typography.meta, color: colors.accent },
  threadHead: { gap: spacing.sm },
  pinned: { ...typography.meta, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  reportLink: { ...typography.meta, color: colors.textTertiary },

  withheld: {
    ...typography.meta,
    color: colors.warning,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },

  replyBlock: { gap: spacing.sm },
  reply: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  replyBody: { flex: 1, gap: 4 },
  /* Arrows + score as one tight cluster, so it reads as a single control and
     stays visually distinct from the text links beside it. */
  voteGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voteButton: { paddingHorizontal: 2, paddingVertical: 2 },
  voteGlyph: { ...typography.meta, fontSize: 11, color: colors.textTertiary },
  /* Tabular figures: the score sits between two arrows and changes width as it
     crosses 9 or goes negative, which would shuffle the arrows under the
     finger that just tapped one. */
  voteScore: {
    ...typography.meta,
    ...typography.numeric,
    color: colors.textSecondary,
    minWidth: 22,
    textAlign: 'center',
  },
  voteUpOn: { color: colors.accent },
  /* Not `danger`. A downvote is disagreement, not a warning, and the report
     path is the one that should own an alarming colour. */
  voteDownOn: { color: colors.textSecondary },

  buried: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  buriedText: { ...typography.meta, color: colors.textTertiary },
  buriedShow: { color: colors.accent },

  replyActions: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginTop: 2 },
  /** One level of indentation, and no deeper — the domain caps depth at 1. */
  nested: { paddingLeft: spacing.xl },

  reportPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reportReason: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 2,
  },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { ...typography.cardTitle, color: colors.textSecondary },

  composer: { gap: spacing.sm },
  replyingTo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    ...typography.body,
  },
});
