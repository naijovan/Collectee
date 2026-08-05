/**
 * J2 — Create & publish a collection (PRD §10, §11 F3). Flow owner: Bernard.
 *
 * Built to the Figma frames in group "Create & Publish Flow":
 *   3:42 Details · 3:44 Select items · 3:50 Suggestions · 3:49 Arrange ·
 *   3:48 Preview details · 3:47 Preview · Posted
 *
 * The bar is driven by `COLLECTION_STEPS` from `domain/collections.ts`, so the
 * count on screen cannot drift from the count in code. Step 3 has two sub-views
 * (suggestions, then arrange) exactly as the Figma draws them — both read
 * "3 of 4". Preview Details and Preview are confirm states outside the bar,
 * which is why `stage` is separate from `step`.
 *
 * "This flow is not one of the five AI features but it is where value is
 *  actually created — the moment an inventory dump becomes an identity.
 *  AI does the tedious part, the player does the expressive part."
 *
 * The AI half is `collectionService.suggestForSelection()`: a theme for what
 * you picked, plus owned items that would extend it, each carrying its reason
 * (§11 F5). Deterministic because the demo is mocked (§12.1).
 *
 * Two deliberate departures from the Figma, both because the mockup shows data
 * this build does not have:
 *   - Item art is `ItemArt`, not the Figma's rendered skins, and the titles are
 *     CODM / Valorant / MLBB rather than Overwatch / Dota / LoL. The fixtures
 *     are the three confirmed titles (§8.1).
 *   - "Add a section" on Arrange is omitted. `Collection` has no section field,
 *     and a control that cannot persist is worse than an absent one.
 */

import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  FadeInView,
  ItemArt,
  LoadingState,
  PrimaryButton,
  RarityBadge,
  SecondaryButton,
} from '@/components';
import { FEATURES } from '@/config/features';
import {
  COLLECTION_STEPS,
  headlineItem,
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
} from '@/domain/collections';
import type { ItemFit, ThemeSuggestion } from '@/domain/collections';
import { byRarityDesc } from '@/domain/rarity';
import { roomEligibility } from '@/domain/trust';
import type { RoomEligibility } from '@/domain/trust';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import * as haptics from '@/lib/haptics';
import {
  collectionService,
  formatBytes,
  inventoryService,
  mediaService,
  socialService,
} from '@/services';
import type { OwnedItemView, PickedImage } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { Item, OwnedItem, TrustLevel, Visibility } from '@/types';

/**
 * Drawn from the vocabulary the seeded collections already use
 * (`fixtures/collections.ts`) plus the three title slugs. Generated tags and
 * seeded tags have to come from one list or Explore ends up with two dialects.
 * The glyph is the Figma's per-chip icon, kept to unicode (§13.1 — no new deps).
 */
const THEME_TAGS: readonly { tag: string; glyph: string }[] = [
  { tag: 'cross-game', glyph: '✦' },
  { tag: 'set-completion', glyph: '◈' },
  { tag: 'mythic', glyph: '♛' },
  { tag: 'collector', glyph: '★' },
  { tag: 'codm', glyph: '◆' },
  { tag: 'valorant', glyph: '◆' },
  { tag: 'mlbb', glyph: '◆' },
];

const VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private'];

/** The Figma pairs each visibility with an icon; unlisted is ours, not its. */
const VISIBILITY_GLYPHS: Record<Visibility, string> = {
  public: '◉',
  unlisted: '◎',
  private: '○',
};

/**
 * Frame 3:42 uses short card copy ("Everyone can view") where
 * `VISIBILITY_DESCRIPTIONS` in `domain/collections.ts` is a full sentence. That
 * constant is shared with the Room flow (Jovan's `room/new.tsx`), so the Figma
 * wording lives here rather than being changed out from under it.
 */
const VISIBILITY_SHORT: Record<Visibility, string> = {
  public: 'Everyone can view',
  unlisted: 'Anyone with the link',
  private: 'Only you can view',
};

/** Figma frames 3:42 and 3:48 both show these counters. The limits are enforced. */
const NAME_LIMIT = 50;
const DESCRIPTION_LIMIT = 300;

/** Select-items filter tabs, per frame 3:44. */
const ITEM_FILTERS = ['All', 'Games', 'Rarity', 'Themes'] as const;
type ItemFilter = (typeof ITEM_FILTERS)[number];

/** Screens outside the numbered bar. `steps` is the bar; `stage` is where we are. */
type Stage = 'steps' | 'preview' | 'posted';

export default function CreateCollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory } = useApp();

  // J1's completion screen can hand us a suggestion to start from (§14 chain).
  const params = useLocalSearchParams<{ name?: string; itemIds?: string }>();

  const [stage, setStage] = useState<Stage>('steps');
  const [step, setStep] = useState(0);
  /** Step 3 shows suggestions first, then the arrange list — both read "3 of 4". */
  const [arranging, setArranging] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [name, setName] = useState(params.name ?? '');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>(
    params.itemIds ? params.itemIds.split(',').filter(Boolean) : [],
  );
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [showOnProfile, setShowOnProfile] = useState(true);

  const [coverItemId, setCoverItemId] = useState<string | null>(null);
  const [pickingCover, setPickingCover] = useState(false);
  /** An uploaded cover outranks the item-derived one until it is removed. */
  const [coverUpload, setCoverUpload] = useState<PickedImage | null>(null);
  const [coverNote, setCoverNote] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('All');

  /** Each step and sub-view opens at the top, not at the last one's offset. */
  const scrollRef = useTopOnFocus(`${stage}:${step}:${arranging}`);

  const [theme, setTheme] = useState<ThemeSuggestion | null>(null);
  const [fits, setFits] = useState<ItemFit[]>([]);
  const [fitting, setFitting] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const selectedItems = useMemo(
    () =>
      selected
        .map((id) => inventory.find((entry) => entry.item.id === id)?.item)
        .filter((item): item is Item => item !== undefined),
    [selected, inventory],
  );

  /**
   * §9.4 — can this selection become a Showroom?
   *
   * A collection takes anything the user owns; the room is the verified perk on
   * top. Answering it live, while they pick, is the difference between a feature
   * they understand and one that silently refuses them two screens later.
   *
   * Derived from the ownership claims, not the catalogue entries — trust belongs
   * to `OwnedItem`, and `deriveTrust`/`roomEligibility` both key off it.
   */
  const selectedOwned = useMemo(
    () =>
      selected
        .map((id) => inventory.find((entry) => entry.item.id === id)?.owned)
        .filter((owned): owned is OwnedItem => owned !== undefined),
    [selected, inventory],
  );

  const eligibility = useMemo(
    () => roomEligibility(selectedOwned, (ownedItemId) => socialService.isUnderReview(ownedItemId)),
    [selectedOwned],
  );

  /** Drop every claim that cannot enter a room, leaving a room-ready selection. */
  function keepRoomEligibleOnly() {
    const blocked = new Set(eligibility.blockedOwnedItemIds);
    setSelected((prev) =>
      prev.filter((itemId) => {
        const owned = inventory.find((entry) => entry.item.id === itemId)?.owned;
        return owned !== undefined && !blocked.has(owned.id);
      }),
    );
  }

  /** Cover defaults to the headline item — the rarest thing in the collection. */
  const chosenCover = coverItemId
    ? selectedItems.find((item) => item.id === coverItemId)
    : undefined;
  const cover: Item | null = chosenCover ?? headlineItem(selectedItems);

  /**
   * Open the file dialog for a cover image.
   *
   * The empty state used to reveal a grid of the selected items, which on the
   * first step is always empty — so "Choose cover" appeared broken. Uploading is
   * what the button says and what the Figma implies, and the item grid stays as
   * the second route to a cover for people who have already picked some.
   */
  async function chooseCoverFile() {
    const result = await mediaService.pickImage();
    switch (result.status) {
      case 'picked':
        setCoverUpload(result.image);
        setCoverItemId(null);
        setPickingCover(false);
        setCoverNote(null);
        return;
      case 'unsupported-type':
        setCoverNote(`${result.name} isn't a PNG or JPG.`);
        return;
      case 'too-large':
        setCoverNote(`${result.name} is ${formatBytes(result.bytes)} — keep covers under 8 MB.`);
        return;
      case 'unavailable':
        // Native has no picker until expo-image-picker lands (§13.1).
        setPickingCover(true);
        setCoverNote('Uploading needs the web build — pick one of your items instead.');
        return;
      case 'cancelled':
        return;
    }
  }

  // Only fetch on the suggestions sub-view, so changing the selection earlier
  // in the flow does not fire a request per tap.
  useEffect(() => {
    if (step !== 2 || arranging || selected.length === 0) return;
    let cancelled = false;
    async function load() {
      setFitting(true);
      const owned = await inventoryService.getOwnedItems(viewerId);
      const next = await collectionService.suggestForSelection(selected, owned);
      if (cancelled) return;
      setTheme(next.theme);
      setFits(next.fits);
      setFitting(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [step, arranging, selected, viewerId]);

  function toggleItem(itemId: string) {
    setSelected((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }

  /** Arrange without a drag dependency (§13.1) — order is still fully editable. */
  function move(index: number, direction: -1 | 1) {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  /** The featured item is simply first in order — it drives cover and focal item. */
  function makeFeatured(itemId: string) {
    setSelected((prev) => [itemId, ...prev.filter((id) => id !== itemId)]);
  }

  async function publish() {
    // Without this guard a double tap creates two collections — the service has
    // no idempotency key and every call mints a fresh id.
    if (publishing) return;
    setPublishing(true);
    try {
      const collection = await collectionService.createCollection({
        userId: viewerId,
        name: name.trim() || 'Untitled collection',
        description: description.trim(),
        coverUrl: coverUpload?.uri ?? cover?.renderUrl ?? '',
        themeTags: tags,
        itemIds: selected,
        visibility,
        allowComments,
        showOnProfile,
      });
      setPublishedId(collection.id);
      haptics.success();
      setStage('posted');
    } finally {
      setPublishing(false);
    }
  }

  /* The native header is off for this route — the nav row below carries the
     step title, so a stack header duplicated it. This screen therefore owns
     its own top inset, on every stage including `preview` and `posted`. */
  const topPad = [styles.content, { paddingTop: insets.top + spacing.md }];

  const canAdvance = step === 0 ? name.trim().length > 0 : step === 1 ? selected.length > 0 : true;

  const stepTitle =
    step === 0
      ? 'Create collection'
      : step === 1
        ? 'Select items'
        : step === 2
          ? arranging
            ? 'Arrange collection'
            : 'Build your collection'
          : 'Collection details';

  // ── Posted ────────────────────────────────────────────────────────────
  if (stage === 'posted' && publishedId) {
    return (
      <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={topPad}>
        <Text style={styles.done}>✓</Text>
        <Text style={styles.title}>{name} is live</Text>
        <Text style={styles.muted}>
          {selected.length} items · {VISIBILITY_LABELS[visibility]}
        </Text>
        <Text style={styles.footnote}>
          {visibility === 'public'
            ? 'Public collections are link-shareable and render a preview card off-platform (§11 F3).'
            : VISIBILITY_DESCRIPTIONS[visibility]}
        </Text>

        {/*
          §9.4 — offering "Build a room" on a selection that cannot become one
          sends the user into a picker that will refuse them, with no way to
          know why. Say it here, where the fix is one tap away.
        */}
        {eligibility.eligible ? (
          <PrimaryButton
            label="Build a room from this"
            onPress={() =>
              router.replace({ pathname: '/room/new', params: { collectionId: publishedId } })
            }
          />
        ) : (
          <View style={styles.gate}>
            <Text style={styles.rowTitle}>🔒 Rooms are a verified perk</Text>
            <Text style={styles.muted}>{eligibility.reason}</Text>
            <SecondaryButton
              label="Link a game account"
              onPress={() => router.replace('/link-account')}
            />
          </View>
        )}
        <SecondaryButton
          label="View collection"
          onPress={() =>
            router.replace({ pathname: '/collection/[id]', params: { id: publishedId } })
          }
        />
      </ScrollView>
    );
  }

  // ── Preview — frame 3:47, a confirm state outside the numbered bar ─────
  if (stage === 'preview') {
    return (
      <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.contentFlush}>
        <View style={styles.previewHeader}>
          <Pressable onPress={() => setStage('steps')} hitSlop={8}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.navTitle}>Preview</Text>
          <View style={styles.navSpacer} />
        </View>

        {/* An uploaded cover replaces the item fan — it is what the user chose. */}
        {coverUpload ? (
          <Image
            source={{ uri: coverUpload.uri }}
            style={styles.bannerUpload}
            resizeMode="cover"
            accessible
            accessibilityLabel={`Collection cover: ${coverUpload.name}`}
          />
        ) : (
          <View style={styles.banner}>
            {selectedItems.slice(0, 5).map((item) => (
              <ItemArt
                key={item.id}
                seed={item.id}
                tier={item.rarityTier}
                style={styles.bannerSlice}
              />
            ))}
          </View>
        )}

        <View style={styles.previewBody}>
          <Text style={styles.title}>{name || 'Untitled collection'}</Text>
          {description ? <Text style={styles.body}>{description}</Text> : null}

          <View style={styles.ownerRow}>
            <Avatar name={viewer?.displayName ?? '?'} verified={viewer?.isAccountVerified} size={40} />
            <Text style={styles.rowTitle}>{viewer?.displayName ?? 'You'}</Text>
          </View>
          <Text style={styles.muted}>{selected.length} items</Text>

          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{glyphFor(tag)} {tag}</Text>
              </View>
            ))}
          </View>

          <PrimaryButton
            label={publishing ? 'Publishing…' : '↥  Publish collection'}
            disabled={publishing}
            onPress={() => void publish()}
          />
          <SecondaryButton label="✎  Edit" onPress={() => setStage('steps')} />

          <Text style={styles.label}>Collection contents</Text>
          {selectedItems.map((item, index) => (
            <View key={item.id} style={styles.contentRow}>
              <View style={styles.thumbWrap}>
                <ItemArt seed={item.id} tier={item.rarityTier} style={styles.thumb} />
                {index === 0 ? (
                  <View style={styles.featuredTag}>
                    <Text style={styles.featuredTagText}>FEATURED</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.muted}>{GAME_LABELS[item.title]}</Text>
              </View>
              <RarityBadge tier={item.rarityTier} title={item.title} />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={topPad}>
      <View style={styles.navRow}>
        <Pressable
          hitSlop={8}
          onPress={
            step === 0
              ? () => router.back()
              : step === 2 && arranging
                ? () => setArranging(false)
                : () => setStep(step - 1)
          }
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>{stepTitle}</Text>
        <Avatar name={viewer?.displayName ?? '?'} verified={viewer?.isAccountVerified} size={36} />
      </View>

      <FlowStepper steps={COLLECTION_STEPS} current={step} />

      {/* Cross-fades the step body on every step change, matching J1. The key
          includes `arranging` because step 2 has two distinct bodies and the
          switch between them is as much a step as the numbered ones. Nav row,
          stepper and footer stay fixed — the footer especially, because its
          label changes per step and animating it would hide that. */}
      <FadeInView key={`${step}-${arranging}`} style={styles.stepBody}>
      {/* ── Step 1 — Details (frame 3:42) ───────────────────────────────── */}
      {step === 0 ? (
        <View style={styles.block}>
          {coverUpload ? (
            <View style={styles.coverCard}>
              <Image
                source={{ uri: coverUpload.uri }}
                style={styles.coverArt}
                resizeMode="cover"
                accessible
                accessibilityLabel={`Collection cover: ${coverUpload.name}`}
              />
              <Text style={styles.footnote}>
                {coverUpload.name} · {formatBytes(coverUpload.bytes)}
              </Text>
              <SecondaryButton label="▣  Change cover" onPress={() => void chooseCoverFile()} />
              <Pressable onPress={() => setCoverUpload(null)} hitSlop={8}>
                <Text style={styles.coverLink}>Remove upload</Text>
              </Pressable>
            </View>
          ) : cover ? (
            <View style={styles.coverCard}>
              <ItemArt seed={cover.id} tier={cover.rarityTier} style={styles.coverArt} />
              <Text style={styles.footnote}>Cover from {cover.name}</Text>
              <SecondaryButton label="▣  Upload a cover" onPress={() => void chooseCoverFile()} />
              <Pressable onPress={() => setPickingCover((prev) => !prev)} hitSlop={8}>
                <Text style={styles.coverLink}>
                  {pickingCover ? 'Hide your items' : 'Or use one of your items'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.coverEmpty}>
              <Text style={styles.coverGlyph}>⊕</Text>
              <Text style={styles.rowTitle}>Add a cover</Text>
              <Text style={styles.mutedCentre}>
                Show off your collection with epic artwork.
              </Text>
              <SecondaryButton label="▣  Choose cover" onPress={() => void chooseCoverFile()} />
              <Text style={styles.mutedCentre}>
                PNG or JPG, up to 8 MB — or leave it and we&apos;ll use your rarest item.
              </Text>
            </View>
          )}

          {coverNote ? <Text style={styles.warn}>{coverNote}</Text> : null}

          {pickingCover && selectedItems.length > 0 ? (
            <View style={styles.coverPicker}>
              {selectedItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setCoverItemId(item.id);
                    setCoverUpload(null);
                    setPickingCover(false);
                  }}
                  style={[styles.coverOption, cover?.id === item.id && styles.coverOptionActive]}
                >
                  <ItemArt seed={item.id} tier={item.rarityTier} style={styles.coverThumb} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>Collection name</Text>
          <View style={styles.field}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={NAME_LIMIT}
              placeholder="e.g. Neon Ronin Vault"
              placeholderTextColor={colors.textTertiary}
              style={styles.fieldInput}
            />
            <Text style={styles.counter}>
              {name.length}/{NAME_LIMIT}
            </Text>
          </View>

          <Text style={styles.label}>
            Add a description <Text style={styles.optional}>(optional)</Text>
          </Text>
          <View style={[styles.field, styles.fieldMultiline]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={DESCRIPTION_LIMIT}
              placeholder="Tell others what your collection is about…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.fieldInput, styles.fieldInputMultiline]}
            />
            <Text style={styles.counterEnd}>
              {description.length}/{DESCRIPTION_LIMIT}
            </Text>
          </View>

          <Text style={styles.label}>
            Choose a theme <Text style={styles.optional}>(optional)</Text>
          </Text>
          <View style={styles.tagRow}>
            {THEME_TAGS.map(({ tag, glyph }) => {
              const active = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() =>
                    setTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }
                  style={[styles.tag, active && styles.tagActive]}
                >
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>
                    {glyph} {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.visRow}>
            {VISIBILITIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setVisibility(option)}
                style={[styles.visCard, visibility === option && styles.visCardActive]}
              >
                <Text style={styles.visGlyph}>{VISIBILITY_GLYPHS[option]}</Text>
                <Text style={styles.rowTitle}>{VISIBILITY_LABELS[option]}</Text>
                <Text style={styles.muted}>{VISIBILITY_SHORT[option]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Step 2 — Select items (frame 3:44) ──────────────────────────── */}
      {step === 1 ? (
        <SelectItems
          inventory={inventory}
          selected={selected}
          query={query}
          onQuery={setQuery}
          filter={itemFilter}
          onFilter={setItemFilter}
          collectionName={name}
          onToggle={toggleItem}
          onDeselectAll={() => setSelected([])}
          eligibility={eligibility}
          onKeepRoomEligible={keepRoomEligibleOnly}
        />
      ) : null}

      {/* ── Step 3a — Suggestions (frame 3:50) ──────────────────────────── */}
      {step === 2 && !arranging ? (
        <View style={styles.block}>
          <Text style={styles.sparkle}>✦ Suggestions for your collection</Text>
          <Text style={styles.muted}>
            Based on your selected items, Collectee found a matching theme and items.
          </Text>

          {fitting ? <LoadingState height={140} /> : null}

          {!fitting && theme ? (
            <View style={styles.themeCard}>
              <Text style={styles.themeName}>{theme.name} ✦</Text>
              <Text style={styles.body}>{theme.description}</Text>
              <View style={styles.themeAction}>
                <PrimaryButton
                  label="Use this theme"
                  onPress={() => {
                    setName(theme.name.slice(0, NAME_LIMIT));
                    if (description.trim() === '') {
                      setDescription(theme.description.slice(0, DESCRIPTION_LIMIT));
                    }
                    setTags(theme.tags);
                    setSkipped(false);
                  }}
                />
              </View>
            </View>
          ) : null}

          {!fitting && fits.length > 0 ? (
            <>
              <Text style={styles.label}>Items that fit</Text>
              <View style={styles.grid}>
                {fits.map(({ item, reason }) => {
                  // A suggestion is the one place eligibility can break without
                  // the user touching the picker — so the pip travels with it.
                  const suggestedTrust = inventory.find((entry) => entry.item.id === item.id)?.owned
                    .trustLevel;
                  return (
                    <View key={item.id} style={styles.fitCard}>
                      <ItemArt seed={item.id} tier={item.rarityTier} style={styles.fitArt} />
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.gameLine}>{GAME_LABELS[item.title]}</Text>
                      {suggestedTrust ? <TrustPip level={suggestedTrust} /> : null}
                      {/* §11 F5 — the reason ships with the recommendation, always. */}
                      <Text style={styles.fitReason}>{reason}</Text>
                      <SecondaryButton
                        label="Add"
                        onPress={() => setSelected((prev) => [...prev, item.id])}
                      />
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {!fitting && !theme ? (
            <Text style={styles.footnote}>
              Pick a few items first and Collectee will suggest a theme for them.
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              setSkipped(true);
              setArranging(true);
            }}
            hitSlop={8}
            style={styles.skip}
          >
            <Text style={styles.skipText}>{skipped ? 'Suggestions skipped' : 'Skip suggestions'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Step 3b — Arrange (frame 3:49) ──────────────────────────────── */}
      {step === 2 && arranging ? (
        <View style={styles.block}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryArt}>
              {selectedItems.slice(0, 4).map((item) => (
                <ItemArt
                  key={item.id}
                  seed={item.id}
                  tier={item.rarityTier}
                  style={styles.summarySlice}
                />
              ))}
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{name || 'Untitled collection'}</Text>
              <Text style={styles.muted}>{selected.length} items</Text>
            </View>
          </View>

          <View style={styles.arrangeHint}>
            {/* Honest wording: there is no drag dependency (§13.1), arrows reorder. */}
            <Text style={styles.muted}>Use the arrows to change their display order.</Text>
            <Text style={styles.featuredHint}>★ First is featured</Text>
          </View>

          {selectedItems.map((item, index) => (
            <View
              key={item.id}
              style={[styles.arrangeRow, index === 0 && styles.arrangeRowFeatured]}
            >
              <Text style={styles.position}>{index === 0 ? '★' : index + 1}</Text>
              <ItemArt seed={item.id} tier={item.rarityTier} style={styles.thumb} />
              <View style={styles.rowBody}>
                {index === 0 ? <Text style={styles.featuredLabel}>✦ Featured item</Text> : null}
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.gameLine}>{GAME_LABELS[item.title]}</Text>
                  <RarityBadge tier={item.rarityTier} title={item.title} />
                </View>
              </View>
              <View style={styles.arrangeControls}>
                <Pressable onPress={() => move(index, -1)} hitSlop={8}>
                  <Text style={styles.arrow}>▲</Text>
                </Pressable>
                <Pressable onPress={() => move(index, 1)} hitSlop={8}>
                  <Text style={styles.arrow}>▼</Text>
                </Pressable>
                {index !== 0 ? (
                  <Pressable onPress={() => makeFeatured(item.id)} hitSlop={8}>
                    <Text style={styles.star}>☆</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Step 4 — Publish / Collection details (frame 3:48) ──────────── */}
      {step === 3 ? (
        <View style={styles.block}>
          {cover ? (
            <View style={styles.coverCard}>
              <ItemArt seed={cover.id} tier={cover.rarityTier} style={styles.coverArt} />
              <Pressable onPress={() => setStep(0)} hitSlop={8} style={styles.pencil}>
                <Text style={styles.pencilGlyph}>✎</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.label}>Collection name</Text>
          <View style={styles.field}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={NAME_LIMIT}
              placeholder="e.g. Neon Ronin Vault"
              placeholderTextColor={colors.textTertiary}
              style={styles.fieldInput}
            />
            <Text style={styles.counter}>
              {name.length}/{NAME_LIMIT}
            </Text>
          </View>

          <Text style={styles.label}>Description</Text>
          <View style={[styles.field, styles.fieldMultiline]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={DESCRIPTION_LIMIT}
              placeholder="Tell others what your collection is about…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.fieldInput, styles.fieldInputMultiline]}
            />
            <Text style={styles.counterEnd}>
              {description.length}/{DESCRIPTION_LIMIT}
            </Text>
          </View>

          <Text style={styles.label}>Theme</Text>
          <View style={styles.tagRow}>
            {tags.length === 0 ? (
              <Text style={styles.footnote}>No theme chosen.</Text>
            ) : (
              tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>
                    {glyphFor(tag)} {tag}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.visRow}>
            {VISIBILITIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setVisibility(option)}
                style={[styles.visCard, visibility === option && styles.visCardActive]}
              >
                <Text style={styles.visGlyph}>{VISIBILITY_GLYPHS[option]}</Text>
                <Text style={styles.rowTitle}>{VISIBILITY_LABELS[option]}</Text>
                <Text style={styles.muted}>{VISIBILITY_SHORT[option]}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleCard}>
            <Toggle
              label="Allow comments"
              hint="Others can comment on this collection"
              value={allowComments}
              onChange={setAllowComments}
            />
            <Toggle
              label="Show on profile"
              hint="Display this collection on your public profile"
              value={showOnProfile}
              onChange={setShowOnProfile}
            />
          </View>

          {/*
            Restated here because step 3's suggestions can add an unverified item
            after the picker's note has scrolled out of the flow — this is the
            last screen before publish, so it is the last honest moment to say it.
          */}
          {FEATURES.trustUi ? (
            <Text style={styles.footnote}>
              {eligibility.eligible
                ? `✓ Every item is verified — this collection can become a Showroom (§9.4).`
                : `🔒 ${eligibility.reason}. Publishing the collection is unaffected.`}
            </Text>
          ) : null}

          <View style={styles.ownerCard}>
            <Avatar name={viewer?.displayName ?? '?'} verified={viewer?.isAccountVerified} size={40} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{viewer?.displayName ?? 'You'}</Text>
              <Text style={styles.muted}>{selected.length} items</Text>
            </View>
            <Pressable onPress={() => setStage('preview')} hitSlop={8} style={styles.previewPill}>
              <Text style={styles.previewPillText}>◉ Preview</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      </FadeInView>

      <View style={styles.footer}>
        {step === 0 ? (
          <PrimaryButton label="Choose items" disabled={!canAdvance} onPress={() => setStep(1)} />
        ) : step === 1 ? (
          <PrimaryButton
            label={`Continue with ${selected.length} item${selected.length === 1 ? '' : 's'}`}
            disabled={!canAdvance}
            onPress={() => {
              setArranging(false);
              setStep(2);
            }}
          />
        ) : step === 2 && !arranging ? (
          <PrimaryButton label="Continue" onPress={() => setArranging(true)} />
        ) : step === 2 ? (
          <PrimaryButton label="Preview collection" onPress={() => setStep(3)} />
        ) : (
          <PrimaryButton label="Preview  →" onPress={() => setStage('preview')} />
        )}
      </View>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

/**
 * Numbered-circle bar with a label under each step, as drawn on every Create &
 * Publish frame (3:42, 3:44, 3:49). The shared `StepperHeader` renders
 * "Step N of M" over plain segments instead, and it belongs to Jovan (§13.3)
 * and is used by J1 and J3 as well — so this local one matches the Figma
 * without changing a shared component under someone else's name.
 *
 * Still driven by `COLLECTION_STEPS`, so the count on screen cannot drift from
 * the count in code — the property §11 F3 actually cares about.
 */
function FlowStepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <View style={styles.stepperRow}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={styles.stepCol}>
            <View style={styles.stepLine}>
              <View style={[styles.connector, index > 0 && done && styles.connectorOn]} />
              <View
                style={[styles.circle, active && styles.circleActive, done && styles.circleDone]}
              >
                <Text style={[styles.circleText, (active || done) && styles.circleTextOn]}>
                  {done ? '✓' : index + 1}
                </Text>
              </View>
              <View
                style={[
                  styles.connector,
                  index < steps.length - 1 && index < current && styles.connectorOn,
                ]}
              />
            </View>
            <Text
              style={[styles.stepLabel, active && styles.stepLabelActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Frame 3:44 — search, filter tabs, selectable grid and the selected tray. */
function SelectItems({
  inventory,
  selected,
  query,
  onQuery,
  filter,
  onFilter,
  collectionName,
  onToggle,
  onDeselectAll,
  eligibility,
  onKeepRoomEligible,
}: {
  inventory: readonly OwnedItemView[];
  selected: string[];
  query: string;
  onQuery: (next: string) => void;
  filter: ItemFilter;
  onFilter: (next: ItemFilter) => void;
  collectionName: string;
  onToggle: (itemId: string) => void;
  onDeselectAll: () => void;
  eligibility: RoomEligibility;
  onKeepRoomEligible: () => void;
}) {
  const matching = useMemo(
    () =>
      inventory.filter((entry) =>
        entry.item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [inventory, query],
  );

  /**
   * The Figma's tabs are filter categories with no stated behaviour, so they
   * group rather than hide — nothing disappears from a grid you are picking
   * from, which would be the more annoying reading.
   */
  const groups = useMemo(() => {
    if (filter === 'All') return [{ key: 'all', label: null, entries: matching }];

    const by = new Map<string, OwnedItemView[]>();
    for (const entry of matching) {
      const key =
        filter === 'Games'
          ? GAME_LABELS[entry.item.title]
          : filter === 'Rarity'
            ? entry.item.rarityLabel
            : (entry.item.setId ?? 'No set');
      const bucket = by.get(key);
      if (bucket) bucket.push(entry);
      else by.set(key, [entry]);
    }
    return [...by.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, entries]) => ({
        key: label,
        label,
        entries: [...entries].sort((x, y) => byRarityDesc(x.item, y.item)),
      }));
  }, [matching, filter]);

  const selectedEntries = selected
    .map((id) => inventory.find((entry) => entry.item.id === id))
    .filter((entry): entry is OwnedItemView => entry !== undefined);

  return (
    <View style={styles.block}>
      {collectionName ? (
        <View style={styles.nameChip}>
          <Text style={styles.nameChipText}>◈ {collectionName}</Text>
        </View>
      ) : null}

      <View style={styles.search}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search your collection"
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.chipRow}>
        {ITEM_FILTERS.map((option) => (
          <Pressable
            key={option}
            onPress={() => onFilter(option)}
            style={[styles.chip, option === filter && styles.chipActive]}
          >
            <Text style={[styles.chipText, option === filter && styles.chipTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.selectHead}>
        <Text style={styles.selectCount}>{selected.length} items selected</Text>
        {selected.length > 0 ? (
          <Pressable onPress={onDeselectAll} hitSlop={8}>
            <Text style={styles.deselect}>Deselect all</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.footnote}>Items can belong to multiple collections (§11 F3).</Text>

      {/*
        §9.4 made visible while the user picks, rather than sprung on them at
        the room picker. Unverified items are never blocked HERE — a collection
        takes anything you own, and that is the point of the tier. This only
        reports what the selection can go on to become.
      */}
      {FEATURES.trustUi && selected.length > 0 ? (
        <View style={[styles.roomNote, eligibility.eligible && styles.roomNoteOk]}>
          <Text style={eligibility.eligible ? styles.roomNoteOkText : styles.rowTitle}>
            {eligibility.eligible ? '✓ Room-eligible selection' : '🔒 Collection only'}
          </Text>
          <Text style={styles.muted}>{eligibility.reason}</Text>
          {!eligibility.eligible && eligibility.verifiedCount > 0 ? (
            <Pressable onPress={onKeepRoomEligible} hitSlop={8}>
              <Text style={styles.coverLink}>
                Keep only the {eligibility.verifiedCount} verified{' '}
                {eligibility.verifiedCount === 1 ? 'item' : 'items'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.key} style={styles.block}>
          {group.label ? <Text style={styles.groupHead}>{group.label}</Text> : null}
          <View style={styles.grid}>
            {group.entries.map((entry) => {
              const active = selected.includes(entry.item.id);
              return (
                <Pressable
                  key={entry.owned.id}
                  onPress={() => onToggle(entry.item.id)}
                  style={[styles.selectCard, active && styles.selectCardActive]}
                >
                  <ItemArt
                    seed={entry.item.id}
                    tier={entry.item.rarityTier}
                    style={styles.selectArt}
                  />
                  <View style={[styles.check, active && styles.checkOn]}>
                    {active ? <Text style={styles.checkGlyph}>✓</Text> : null}
                  </View>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {entry.item.name}
                  </Text>
                  <Text style={styles.gameLine}>{GAME_LABELS[entry.item.title]}</Text>
                  <View style={styles.badgeRow}>
                    <RarityBadge tier={entry.item.rarityTier} title={entry.item.title} />
                    <TrustPip level={entry.owned.trustLevel} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {selectedEntries.length > 0 ? (
        <View style={styles.tray}>
          <Text style={styles.footnote}>Selected</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.trayRow}>
              {selectedEntries.map((entry) => (
                <Pressable
                  key={entry.owned.id}
                  onPress={() => onToggle(entry.item.id)}
                  style={styles.trayItem}
                >
                  <ItemArt
                    seed={entry.item.id}
                    tier={entry.item.rarityTier}
                    style={styles.trayArt}
                  />
                  <View style={styles.trayRemove}>
                    <Text style={styles.trayRemoveGlyph}>×</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function glyphFor(tag: string): string {
  return THEME_TAGS.find((t) => t.tag === tag)?.glyph ?? '✦';
}

/**
 * Compact trust marker for the picker grid.
 *
 * `ItemCard`'s `TrustBadge` is the equivalent on shared cards, but that
 * component is Jovan's (§13.3) and the picker card is bespoke to this screen —
 * so this is the local one rather than a change to a shared component under
 * someone else's name. Same rule, same flag.
 */
function TrustPip({ level }: { level: TrustLevel }) {
  if (!FEATURES.trustUi) return null;
  const verified = level === 'verified';
  return (
    <View style={[styles.pip, verified ? styles.pipVerified : styles.pipUnverified]}>
      <Text style={[styles.pipText, verified && styles.pipTextVerified]}>
        {verified ? '✓ Verified' : 'Unverified'}
      </Text>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{label}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  stepBody: { gap: spacing.md },
  contentFlush: { paddingBottom: spacing.xxl },
  block: { gap: spacing.md },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navTitle: {
    ...typography.screenTitle,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  navSpacer: { width: 24 },
  back: { fontSize: 22, color: colors.textPrimary },

  // Numbered-circle stepper (frames 3:42 / 3:44 / 3:49)
  stepperRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  stepCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  stepLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  connector: { flex: 1, height: 2, backgroundColor: colors.border },
  connectorOn: { backgroundColor: colors.accent },
  circle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  circleDone: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  circleText: { ...typography.meta, color: colors.textSecondary },
  circleTextOn: { color: colors.textOnAccent },
  stepLabel: { ...typography.meta, color: colors.textTertiary },
  stepLabelActive: { color: colors.accent },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  label: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  optional: { ...typography.meta, color: colors.textTertiary },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  mutedCentre: { ...typography.meta, color: colors.textSecondary, textAlign: 'center' },
  footnote: { ...typography.meta, color: colors.textTertiary },
  gameLine: { ...typography.meta, color: colors.textTertiary },

  // Cover
  coverEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  coverGlyph: { fontSize: 40, color: colors.accent },
  coverCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coverArt: { width: '100%', height: 150, borderRadius: radius.card },
  coverLink: { ...typography.meta, color: colors.accent },
  warn: { ...typography.meta, color: colors.warning },
  pencil: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilGlyph: { color: colors.textOnAccent, fontSize: 15 },
  coverPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  coverOption: { borderRadius: radius.card, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  coverOptionActive: { borderColor: colors.accent },
  coverThumb: { width: 56, height: 42 },

  // Fields with inline counters (frames 3:42 / 3:48)
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldMultiline: { flexDirection: 'column', alignItems: 'stretch' },
  fieldInput: { flex: 1, color: colors.textPrimary, ...typography.body },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  counter: { ...typography.meta, color: colors.textTertiary },
  counterEnd: { ...typography.meta, color: colors.textTertiary, alignSelf: 'flex-end' },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tagText: { ...typography.meta, color: colors.textSecondary },
  tagTextActive: { color: colors.textOnAccent },

  // Visibility cards
  visRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  visCard: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  visCardActive: { borderColor: colors.accent },
  visGlyph: { fontSize: 18, color: colors.accent },

  // Select items
  nameChip: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameChipText: { ...typography.meta, color: colors.textPrimary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchGlyph: { fontSize: 18, color: colors.textTertiary },
  searchInput: { flex: 1, color: colors.textPrimary, ...typography.body },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.meta, color: colors.textSecondary },
  chipTextActive: { color: colors.textOnAccent },
  selectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectCount: { ...typography.cardTitle, color: colors.accent },
  deselect: { ...typography.meta, color: colors.accent },
  groupHead: { ...typography.cardTitle, color: colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  selectCard: {
    width: '47%',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  selectCardActive: { borderColor: colors.accent },
  selectArt: { width: '100%', height: 92 },
  check: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkGlyph: { color: colors.textOnAccent, fontSize: 13, fontWeight: '700' },

  // §9.4 trust surfaces — the room gate, stated while the user picks.
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  pip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  pipVerified: { borderColor: colors.success },
  pipUnverified: { borderColor: colors.border },
  pipText: { ...typography.meta, fontSize: 9, color: colors.textTertiary },
  pipTextVerified: { color: colors.success },
  roomNote: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  roomNoteOk: { borderColor: colors.success },
  roomNoteOkText: { ...typography.cardTitle, color: colors.success },
  gate: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  tray: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  trayRow: { flexDirection: 'row', gap: spacing.sm },
  trayItem: { width: 56 },
  trayArt: { width: 56, height: 42 },
  trayRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayRemoveGlyph: { color: colors.textOnAccent, fontSize: 11, fontWeight: '700' },

  // Suggestions
  sparkle: { ...typography.sectionHeader, color: colors.textPrimary },
  themeCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  themeName: { ...typography.screenTitle, fontSize: 22, color: colors.textPrimary },
  themeAction: { marginTop: spacing.sm },
  fitCard: {
    width: '47%',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  fitArt: { width: '100%', height: 84 },
  fitReason: { ...typography.meta, color: colors.textSecondary },
  skip: { alignSelf: 'center', paddingVertical: spacing.sm },
  skipText: { ...typography.meta, color: colors.accent },

  // Arrange
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryArt: { flexDirection: 'row', gap: 2, borderRadius: radius.sm, overflow: 'hidden' },
  summarySlice: { width: 32, height: 56 },
  arrangeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredHint: { ...typography.meta, color: colors.accent },
  arrangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  arrangeRowFeatured: { borderColor: colors.accent },
  position: { ...typography.cardTitle, color: colors.textTertiary, width: 18 },
  thumb: { width: 56, height: 42 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  featuredLabel: { ...typography.meta, color: colors.accent },
  arrangeControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrow: { color: colors.accent, fontSize: 14 },
  star: { color: colors.accent, fontSize: 16 },

  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },

  // Publish / details
  toggleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    padding: 3,
  },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.textPrimary },
  knobOn: { alignSelf: 'flex-end' },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  previewPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  previewPillText: { ...typography.meta, color: colors.accent },

  // Preview
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  banner: { flexDirection: 'row', height: 200, gap: 2 },
  bannerSlice: { flex: 1, height: 200, borderRadius: 0 },
  bannerUpload: { width: '100%', height: 200 },
  previewBody: { padding: spacing.lg, gap: spacing.md },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  thumbWrap: { position: 'relative' },
  featuredTag: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  featuredTagText: { ...typography.meta, fontSize: 8, color: colors.textOnAccent },

  footer: { marginTop: spacing.lg },
  done: { fontSize: 44, color: colors.success },
});
