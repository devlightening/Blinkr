import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Check, CircleHelp, ListChecks, Minus, X } from 'lucide-react-native';

import { getPlaceAttributes, votePlaceAttribute } from '../../api';
import { success } from '../../haptics';
import { attributeLabel, confirmationLine, orderedAttributes, stateLabel, type AttributeKey, type PlaceAttributes } from '../../placeAttributes';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/**
 * "Yer özellikleri" (D-040): Wi-Fi, outlets, quiet... as people who were verifiably here say, with how many and how
 * recently - knowledge that fades unless someone confirms it. Anyone with a recent verified signal here can answer;
 * the server decides who that is (`canVote`), the app only shows it.
 */
export function PlaceAttributesCard({ auth, placeId, refresh = {} }: { auth: AuthResponse | null; placeId: string; refresh?: Refresh }) {
  const [data, setData] = useState<PlaceAttributes | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<AttributeKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setEditing(false);
    getPlaceAttributes(placeId, auth, controller.signal, refresh)
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { /* a missing card is better than an error here */ });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, auth?.userId]);

  const vote = async (key: AttributeKey, value: boolean | null) => {
    if (!auth || busy) return;
    setBusy(key);
    setError(null);
    try {
      setData(await votePlaceAttribute(auth, placeId, key, value, refresh));
      success();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 403
        ? tx('map:attr.notEligible', 'Bilgi vermek için son 30 günde burada konumda doğrulanmış bir sinyalin olmalı.')
        : status === 429 ? tx('map:attr.tooMany', 'Bugün yeterince katkı verdin, yarın tekrar dene.') : tx('map:attr.failed', 'Kaydedilemedi. Tekrar dene.'));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return null;
  const known = orderedAttributes(data.attributes);
  if (known.length === 0 && !data.canVote) return null;
  const mineOf = (key: AttributeKey) => data.attributes.find((a) => a.key === key)?.myVote ?? null;

  return (
    <View style={styles.card} testID="place-attributes">
      <View style={styles.head}>
        <ListChecks color={colors.primary} size={16} />
        <Text accessibilityRole="header" style={styles.title}>{tx('map:attr.title', 'Yer özellikleri')}</Text>
        {data.canVote ? (
          <AnimatedPressable accessibilityRole="button" accessibilityState={{ expanded: editing }} onPress={() => setEditing((v) => !v)} pressScale={0.95}>
            <Text style={styles.edit}>{editing ? tx('common:actions.done', 'Tamam') : tx('map:attr.contribute', 'Bilgi ver')}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      {known.length === 0 ? <Text style={styles.muted}>{tx('map:attr.empty', 'Henüz kimse bilgi vermedi. Buradaysan ilk sen söyle.')}</Text> : null}
      {!editing && known.map((a) => (
        <View accessibilityLabel={`${attributeLabel(a.key)}: ${stateLabel(a.state)}. ${confirmationLine(a)}${a.fading ? `. ${tx('map:attr.fading', 'teyit gerekiyor')}` : ''}`} accessible key={a.key} style={[styles.row, a.fading && styles.faded]}>
          <View style={[styles.mark, a.state === 'yes' ? styles.markYes : a.state === 'no' ? styles.markNo : styles.markMixed]}>
            {a.state === 'yes' ? <Check color={colors.ink} size={13} strokeWidth={2.6} /> : a.state === 'no' ? <X color={colors.text} size={13} /> : <Minus color={colors.text} size={13} />}
          </View>
          <Text style={styles.name}>{attributeLabel(a.key)}</Text>
          <Text numberOfLines={1} style={styles.line}>{a.fading ? tx('map:attr.fadingLine', 'teyit gerekiyor · {{line}}', { line: confirmationLine(a) }) : confirmationLine(a)}</Text>
        </View>
      ))}

      {editing ? data.catalog.map((key) => {
        const mine = mineOf(key);
        return (
          <View key={key} style={styles.row}>
            <Text style={[styles.name, styles.flex]}>{attributeLabel(key)}</Text>
            {busy === key ? <ActivityIndicator color={colors.primary} size="small" /> : null}
            {[true, false].map((value) => {
              const selected = mine === value;
              return (
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={busy !== null}
                  key={String(value)}
                  // Pressing the chosen answer again takes it back.
                  onPress={() => { void vote(key, selected ? null : value); }}
                  pressScale={0.92}
                  style={[styles.choice, selected && styles.choiceOn]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{value ? tx('map:attr.yes', 'Var') : tx('map:attr.no', 'Yok')}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        );
      }) : null}

      {!data.canVote && auth ? (
        <View style={styles.note}>
          <CircleHelp color={colors.textSecondary} size={12} />
          <Text style={styles.noteText}>{tx('map:attr.howToVote', 'Burada konumda doğrulanmış bir sinyal bıraktıktan sonra sen de bilgi verebilirsin.')}</Text>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  edit: { ...typography.label, color: colors.primary },
  muted: { ...typography.callout, color: colors.textSecondary },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 36 },
  faded: { opacity: 0.55 },
  flex: { flex: 1 },
  mark: { alignItems: 'center', borderRadius: radii.pill, height: 22, justifyContent: 'center', width: 22 },
  markYes: { backgroundColor: colors.primary },
  markNo: { backgroundColor: colors.surfaceElevated },
  markMixed: { backgroundColor: colors.surfaceElevated },
  name: { ...typography.bodyStrong, color: colors.text },
  line: { ...typography.caption, color: colors.textSecondary, flex: 1, textAlign: 'right' },
  choice: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, minWidth: 52, paddingHorizontal: spacing.md, paddingVertical: 6 },
  choiceOn: { backgroundColor: colors.primary },
  choiceText: { ...typography.label, color: colors.text, textAlign: 'center' },
  choiceTextOn: { color: colors.ink },
  note: { alignItems: 'flex-start', flexDirection: 'row', gap: 4 },
  noteText: { ...typography.micro, color: colors.textSecondary, flex: 1 },
  error: { ...typography.caption, color: colors.danger },
});
