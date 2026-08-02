/**
 * J2 — Create & publish a collection (PRD §10, §11 F3). Flow owner: Bernard.
 *
 * §11 F3 fixes the Figma's stepper bug and this screen is where the fix lands:
 * the bar is driven by `COLLECTION_STEPS` from `domain/collections.ts`, so the
 * count on screen cannot drift from the count in code. Preview and Preview
 * Details are confirm states OUTSIDE the numbered bar, exactly as specified —
 * that is why `preview` is a boolean here and not a sixth step.
 *
 * "This flow is not one of the five AI features but it is where value is
 *  actually created — the moment an inventory dump becomes an identity.
 *  AI does the tedious part, the player does the expressive part."
 *
 * The AI half is `collectionService.suggest()`: suggested groupings and titles,
 * deterministic because the demo is mocked (§12.1). The curation is human.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ItemCard, LoadingState, PrimaryButton, SecondaryButton, StepperHeader } from '@/components';
import {
  COLLECTION_STEPS,
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
} from '@/domain/collections';
import type { CollectionSuggestion } from '@/domain/collections';
import { collectionService, inventoryService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Visibility } from '@/types';

const THEME_TAGS = ['cross-game', 'set-completion', 'mythic', 'event', 'launch-day', 'nostalgia'];
const VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private'];

export default function CreateCollectionScreen() {
  const router = useRouter();
  const { viewerId, inventory } = useApp();

  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [showOnProfile, setShowOnProfile] = useState(true);

  const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const owned = await inventoryService.getOwnedItems(viewerId);
      const next = await collectionService.suggest(owned);
      if (cancelled) return;
      setSuggestions(next);
      setSuggesting(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

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

  async function publish() {
    const collection = await collectionService.createCollection({
      userId: viewerId,
      name: name.trim() || 'Untitled collection',
      description: description.trim(),
      coverUrl: `covers/${Date.now()}.png`,
      themeTags: tags,
      itemIds: selected,
      visibility,
      allowComments,
      showOnProfile,
    });
    setPublishedId(collection.id);
  }

  const canAdvance =
    step === 0 ? name.trim().length > 0 : step === 1 ? selected.length > 0 : true;

  // ── Posted ────────────────────────────────────────────────────────────
  if (publishedId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

        <PrimaryButton
          label="Build a room from this"
          onPress={() =>
            router.replace({ pathname: '/room/new', params: { collectionId: publishedId } })
          }
        />
        <SecondaryButton
          label="View collection"
          onPress={() =>
            router.replace({ pathname: '/collection/[id]', params: { id: publishedId } })
          }
        />
      </ScrollView>
    );
  }

  // ── Preview — a confirm state, deliberately outside the numbered bar ───
  if (preview) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.overline}>Preview</Text>
        <Text style={styles.title}>{name || 'Untitled collection'}</Text>
        <Text style={styles.body}>{description}</Text>
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {selected.map((itemId) => {
            const entry = inventory.find((i) => i.item.id === itemId);
            return entry ? (
              <ItemCard
                key={itemId}
                item={entry.item}
                trustLevel={entry.owned.trustLevel}
                width="30%"
                artHeight={80}
              />
            ) : null;
          })}
        </View>

        <PrimaryButton label={`Publish as ${VISIBILITY_LABELS[visibility]}`} onPress={() => void publish()} />
        <SecondaryButton label="Keep editing" onPress={() => setPreview(false)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StepperHeader
        steps={COLLECTION_STEPS}
        current={step}
        onBack={step === 0 ? () => router.back() : () => setStep(step - 1)}
      />

      {step === 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Crown Jewels"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="The three things I would not trade."
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />

          <Text style={styles.label}>Suggested groupings</Text>
          <Text style={styles.footnote}>
            AI does the tedious part — the curation below is yours to change.
          </Text>
          {suggesting ? (
            <LoadingState height={80} />
          ) : (
            suggestions.map((suggestion) => (
              <Pressable
                key={suggestion.name}
                style={styles.suggestion}
                onPress={() => {
                  setName(suggestion.name);
                  setSelected(suggestion.itemIds);
                }}
              >
                <Text style={styles.rowTitle}>{suggestion.name}</Text>
                <Text style={styles.muted}>{suggestion.reason}</Text>
                <Text style={styles.footnote}>{suggestion.itemIds.length} items</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.block}>
          <Text style={styles.muted}>
            {selected.length} of {inventory.length} selected · items can belong to multiple
            collections (§11 F3)
          </Text>
          <View style={styles.grid}>
            {inventory.map((entry) => {
              const active = selected.includes(entry.item.id);
              return (
                <Pressable
                  key={entry.owned.id}
                  onPress={() => toggleItem(entry.item.id)}
                  style={[styles.selectable, active && styles.selectableActive]}
                >
                  <ItemCard
                    item={entry.item}
                    trustLevel={entry.owned.trustLevel}
                    width="100%"
                    artHeight={72}
                  />
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.block}>
          <Text style={styles.muted}>Tags help this surface in Explore and to matched collectors.</Text>
          <View style={styles.tagRow}>
            {THEME_TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() =>
                    setTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }
                  style={[styles.tag, active && styles.tagActive]}
                >
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.block}>
          <Text style={styles.muted}>
            Order decides the cover and the room&apos;s focal item. First is the headline.
          </Text>
          {selected.map((itemId, index) => {
            const entry = inventory.find((i) => i.item.id === itemId);
            if (!entry) return null;
            return (
              <View key={itemId} style={styles.arrangeRow}>
                <Text style={styles.position}>{index + 1}</Text>
                <ItemCard item={entry.item} width={56} artHeight={42} />
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {entry.item.name}
                </Text>
                <Pressable onPress={() => move(index, -1)} hitSlop={8}>
                  <Text style={styles.arrow}>▲</Text>
                </Pressable>
                <Pressable onPress={() => move(index, 1)} hitSlop={8}>
                  <Text style={styles.arrow}>▼</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.block}>
          {VISIBILITIES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setVisibility(option)}
              style={[styles.option, visibility === option && styles.optionActive]}
            >
              <Text style={styles.rowTitle}>{VISIBILITY_LABELS[option]}</Text>
              <Text style={styles.muted}>{VISIBILITY_DESCRIPTIONS[option]}</Text>
            </Pressable>
          ))}

          <Toggle label="Allow comments" value={allowComments} onChange={setAllowComments} />
          <Toggle label="Show on profile" value={showOnProfile} onChange={setShowOnProfile} />
        </View>
      ) : null}

      <View style={styles.footer}>
        {step < COLLECTION_STEPS.length - 1 ? (
          <PrimaryButton
            label="Continue"
            disabled={!canAdvance}
            onPress={() => setStep(step + 1)}
          />
        ) : (
          <PrimaryButton label="Preview" onPress={() => setPreview(true)} />
        )}
      </View>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <Text style={styles.rowTitle}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  block: { gap: spacing.md },

  overline: { ...typography.meta, color: colors.accent, letterSpacing: 0.5 },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  label: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  suggestion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 2,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  selectable: {
    width: '30%',
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  selectableActive: { borderColor: colors.accent },
  check: { position: 'absolute', top: 6, right: 8, color: colors.accent, fontSize: 16 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  position: { ...typography.cardTitle, color: colors.textTertiary, width: 18 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },
  arrow: { color: colors.accent, fontSize: 14, paddingHorizontal: spacing.sm },

  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  optionActive: { borderColor: colors.accent },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
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

  footer: { marginTop: spacing.lg },
  done: { fontSize: 44, color: colors.success },
});
