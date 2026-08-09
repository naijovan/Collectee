/**
 * Who runs each community — one leader and four co-leaders.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  ADDING A COMMUNITY? Add a row here too. `validate-fixtures` fails  │
 * │  on a community with no roles, a role holder who is not a member,   │
 * │  and a leader who is also listed as a co-leader.                    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Why a config file and not fields on `Community` ──────────────────────
 * `src/types/` is the team's merge contract (§12.3), and widening an entity
 * mid-build for something only one screen reads is how two people end up
 * resolving the same conflict twice. This sits beside `communityArt` and
 * `itemLooks`, which exist for the same reason: real data the app needs,
 * keyed by id, that does not belong in the schema.
 *
 * ── Why not "the first five in memberIds" ────────────────────────────────
 * That was the cheaper option and it is the one worth refusing. Array position
 * carrying meaning is invisible: re-order a roster for an unrelated reason and
 * the community silently changes hands, with nothing to fail. Naming the roles
 * makes the check above possible.
 *
 * ── What this is NOT ─────────────────────────────────────────────────────
 * Not permissions. Nothing in the build gates on a role — posting is gated on
 * membership alone (`threadService.canPostIn`). These are titles shown next to
 * a face, so a community reads as a place people run rather than a member
 * count. Real moderation powers are phase 2.
 */

export interface CommunityRoles {
  leaderId: string;
  /** Exactly four, so "Collectors Here" is always a five-strong top table. */
  coLeaderIds: readonly string[];
}

export const COMMUNITY_ROLES: Record<string, CommunityRoles> = {
  'comm-blueprint-vault': {
    /* Syafiq wrote the pinned "what belongs here" thread — the person setting
       the rules is the person running the place. */
    leaderId: 'user-syafiq',
    coLeaderIds: ['user-rei', 'user-tarek', 'user-iman', 'user-kai'],
  },
  'comm-knife-collectors': {
    leaderId: 'user-mei',
    coLeaderIds: ['user-kai', 'user-bo', 'user-nova', 'user-zennx'],
  },
  'comm-land-of-dawn': {
    leaderId: 'user-danish',
    coLeaderIds: ['user-nadia', 'user-priya', 'user-arya', 'user-rei'],
  },
  'comm-cross-game': {
    leaderId: 'user-arya',
    coLeaderIds: ['user-zennx', 'user-nova', 'user-iman', 'user-kai'],
  },
  'comm-mythic-drop': {
    leaderId: 'user-zennx',
    coLeaderIds: ['user-syafiq', 'user-tarek', 'user-bo', 'user-rei'],
  },
  'comm-hero-skins': {
    leaderId: 'user-priya',
    coLeaderIds: ['user-danish', 'user-nadia', 'user-arya', 'user-iman'],
  },
  'comm-vandal-club': {
    leaderId: 'user-bo',
    coLeaderIds: ['user-mei', 'user-kai', 'user-nova', 'user-zennx'],
  },
  'comm-epic-nights': {
    leaderId: 'user-nadia',
    coLeaderIds: ['user-iman', 'user-danish', 'user-priya', 'user-rei'],
  },
  'comm-shelf-tours': {
    leaderId: 'user-nova',
    coLeaderIds: ['user-kai', 'user-arya', 'user-iman', 'user-zennx'],
  },
};

export type CommunityRole = 'leader' | 'co-leader';

/** What to print beside a face. */
export const ROLE_LABELS: Record<CommunityRole, string> = {
  leader: 'Leader',
  'co-leader': 'Co-leader',
};

/** The role a user holds here, or null if they are an ordinary member. */
export function roleFor(communityId: string, userId: string): CommunityRole | null {
  const roles = COMMUNITY_ROLES[communityId];
  if (!roles) return null;
  if (roles.leaderId === userId) return 'leader';
  return roles.coLeaderIds.includes(userId) ? 'co-leader' : null;
}

/**
 * The five to show under "Collectors Here", leader first.
 *
 * A community of four thousand cannot list its members, and a random slice of
 * five says nothing. The people running it is the answer to "who is this place"
 * — and it is stable, so the section does not reshuffle between visits.
 */
export function topTableFor(communityId: string): readonly string[] {
  const roles = COMMUNITY_ROLES[communityId];
  return roles ? [roles.leaderId, ...roles.coLeaderIds] : [];
}
