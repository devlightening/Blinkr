import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Clock3,
  Crosshair,
  FileText,
  Gauge,
  MapPin,
  Navigation,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '../theme';
import type {
  ComposerArea,
  CreateSignalInput,
  IdentityDisclosure,
  LocationReadiness,
  SignalType,
} from '../types';

type ComposerInput = Omit<CreateSignalInput, 'latitude' | 'longitude' | 'accuracyMeters' | 'locationName'>;
type Mode = 'quick' | 'detailed';

type Props = {
  area: ComposerArea | null;
  canAskLocationAgain: boolean;
  error: string | null;
  isSubmitting: boolean;
  locationReadiness: LocationReadiness;
  onClearError: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onSelectArea: (source: 'device' | 'map') => Promise<void>;
  onSubmit: (input: ComposerInput) => Promise<void>;
  visible: boolean;
};

const signalTypes: Array<{ type: SignalType; label: string; description: string; quick: boolean }> = [
  { type: 'Crowd', label: 'Doluluk', description: 'Mekân ne kadar yoğun?', quick: true },
  { type: 'Queue', label: 'Sıra ve bekleme', description: 'Tahmini bekleme süresi', quick: true },
  { type: 'TemporaryStatus', label: 'Geçici durum', description: 'Kapalı veya erişilemiyor', quick: true },
  { type: 'Event', label: 'Etkinlik', description: 'Başlayan güncel bir etkinlik', quick: true },
  { type: 'Offer', label: 'Fırsat', description: 'Gördüğün kampanya veya indirim', quick: true },
  { type: 'NewOpening', label: 'Yeni açılış', description: 'Yeni açılan bir yer', quick: true },
  { type: 'GeneralObservation', label: 'Genel gözlem', description: 'Detaylı ve güncel bir not', quick: false },
];

const valuesByType: Partial<Record<SignalType, Array<{ value: string; label: string }>>> = {
  Crowd: [
    { value: 'Calm', label: 'Sakin' },
    { value: 'Moderate', label: 'Orta' },
    { value: 'Busy', label: 'Yoğun' },
    { value: 'VeryBusy', label: 'Çok yoğun' },
  ],
  Queue: [
    { value: 'Under5', label: '5 dk altı' },
    { value: '5To15', label: '5-15 dk' },
    { value: '15To30', label: '15-30 dk' },
    { value: 'Over30', label: '30 dk üzeri' },
  ],
  TemporaryStatus: [
    { value: 'Closed', label: 'Kapalı' },
    { value: 'Inaccessible', label: 'Erişilemiyor' },
  ],
  Event: [{ value: 'Started', label: 'Etkinlik başladı' }],
  Offer: [{ value: 'Available', label: 'Fırsat var' }],
  NewOpening: [{ value: 'Opened', label: 'Yeni açıldı' }],
};

const defaultHours: Record<SignalType, number> = {
  Crowd: 1,
  Queue: 1,
  TemporaryStatus: 3,
  GeneralObservation: 24,
  Event: 24,
  Offer: 24,
  NewOpening: 168,
};

const durationOptions = [
  { hours: 1, label: '1 saat' },
  { hours: 3, label: '3 saat' },
  { hours: 24, label: '24 saat' },
  { hours: 168, label: '7 gün' },
];

const getTypeLabel = (type: SignalType | null) =>
  signalTypes.find((item) => item.type === type)?.label ?? 'Sinyal';

export function SignalComposer({
  area,
  canAskLocationAgain,
  error,
  isSubmitting,
  locationReadiness,
  onClearError,
  onClose,
  onOpenSettings,
  onSelectArea,
  onSubmit,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [signalType, setSignalType] = useState<SignalType | null>(null);
  const [signalValue, setSignalValue] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expiryHours, setExpiryHours] = useState(3);
  const [identityDisclosure, setIdentityDisclosure] = useState<IdentityDisclosure>('LimitedProfile');
  const [isSelectingArea, setIsSelectingArea] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      setMode(null);
      setSignalType(null);
      setSignalValue(null);
      setTitle('');
      setContent('');
      setExpiryHours(3);
      setIdentityDisclosure('LimitedProfile');
    }
  }, [visible]);

  const values = signalType ? valuesByType[signalType] ?? [] : [];
  const selectedValueLabel = values.find((item) => item.value === signalValue)?.label;
  const generatedTitle = signalType
    ? selectedValueLabel ? `${getTypeLabel(signalType)}: ${selectedValueLabel}` : getTypeLabel(signalType)
    : '';
  const contentIsValid = mode === 'quick'
    ? true
    : title.trim().length > 0 && content.trim().length >= 5;
  const typeIsValid = Boolean(signalType && (signalType === 'GeneralObservation' || signalValue));
  const expiryLabel = useMemo(
    () => durationOptions.find((item) => item.hours === expiryHours)?.label ?? `${expiryHours} saat`,
    [expiryHours],
  );

  const chooseMode = (nextMode: Mode) => {
    setMode(nextMode);
    setSignalType(nextMode === 'detailed' ? 'GeneralObservation' : null);
    setSignalValue(null);
    setStep(1);
    Haptics.selectionAsync();
  };

  const chooseType = (type: SignalType) => {
    setSignalType(type);
    const typeValues = valuesByType[type] ?? [];
    setSignalValue(typeValues.length === 1 ? typeValues[0].value : null);
    setExpiryHours(defaultHours[type]);
    Haptics.selectionAsync();
  };

  const selectArea = async (source: 'device' | 'map') => {
    setIsSelectingArea(true);
    onClearError();
    try {
      await onSelectArea(source);
    } finally {
      setIsSelectingArea(false);
    }
  };

  const publish = async () => {
    if (!area || !signalType || !contentIsValid || !typeIsValid || isSubmitting) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onSubmit({
      title: mode === 'quick' ? generatedTitle : title.trim(),
      content: content.trim(),
      placeId: null,
      signalType,
      signalValue,
      audienceType: 'Public',
      identityDisclosure,
      locationPrecision: 'ApproximateArea',
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
    });
  };

  const next = () => {
    onClearError();
    if (step === 1 && !typeIsValid) return;
    if (step === 2 && !contentIsValid) return;
    setStep((current) => Math.min(3, current + 1));
  };

  const stepTitle = ['Bir yer seç', 'Ne oluyor?', 'Sinyali tamamla', 'Yayınlamadan önce'][step];

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <Pressable onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable
              accessibilityLabel={step > 0 ? 'Geri' : 'Kapat'}
              onPress={step > 0 ? () => setStep((current) => current - 1) : onClose}
              style={styles.iconButton}
            >
              {step > 0 ? <ChevronLeft color={colors.ink} size={22} /> : <X color={colors.ink} size={22} />}
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>TAZE SİNYAL · {step + 1}/4</Text>
              <Text style={styles.heading}>{stepTitle}</Text>
            </View>
            <Pressable accessibilityLabel="Kapat" onPress={onClose} style={styles.iconButton}>
              <X color={colors.ink} size={22} />
            </Pressable>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: `${(step + 1) * 25}%` }]} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <AlertCircle color={colors.error} size={18} />
                <View style={styles.flex}>
                  <Text style={styles.errorTitle}>İşlem tamamlanamadı</Text>
                  <Text numberOfLines={3} style={styles.errorText}>{error}</Text>
                </View>
              </View>
            )}

            {step === 0 && (
              <>
                {area ? (
                  <View style={styles.areaSummary}>
                    <View style={styles.areaIcon}><MapPin color={colors.greenDark} size={21} /></View>
                    <View style={styles.flex}>
                      <Text style={styles.summaryLabel}>SEÇİLEN ALAN</Text>
                      <Text numberOfLines={1} style={styles.areaName}>{area.name}</Text>
                      <Text style={styles.areaMeta}>{area.source === 'device' ? 'Yakınındaki yaklaşık alan' : 'Haritada seçtiğin alan'}</Text>
                    </View>
                    <Check color={colors.green} size={20} />
                  </View>
                ) : (
                  <View style={styles.locationWarning}>
                    <AlertCircle color={colors.warning} size={19} />
                    <Text style={styles.locationWarningText}>Sinyali yerleştirmek için bir alan seç.</Text>
                  </View>
                )}

                <View style={styles.areaActions}>
                  <Pressable disabled={isSelectingArea} onPress={() => selectArea('device')} style={styles.secondaryButton}>
                    {isSelectingArea ? <ActivityIndicator color={colors.green} size="small" /> : <Navigation color={colors.green} size={18} />}
                    <Text style={styles.secondaryButtonText}>Yakınımdaki alan</Text>
                  </Pressable>
                  <Pressable disabled={isSelectingArea} onPress={() => selectArea('map')} style={styles.secondaryButton}>
                    <Crosshair color={colors.green} size={18} />
                    <Text style={styles.secondaryButtonText}>Harita merkezi</Text>
                  </Pressable>
                </View>

                {locationReadiness === 'permission-required' && (
                  <Pressable onPress={canAskLocationAgain ? () => selectArea('device') : onOpenSettings} style={styles.settingsLink}>
                    <Settings color={colors.warning} size={16} />
                    <Text style={styles.settingsText}>{canAskLocationAgain ? 'Konum izni ver' : 'Konum ayarlarını aç'}</Text>
                  </Pressable>
                )}

                <Text style={styles.sectionLabel}>PAYLAŞIM BİÇİMİ</Text>
                <Pressable disabled={!area} onPress={() => chooseMode('quick')} style={[styles.modeItem, !area && styles.disabled]}>
                  <View style={styles.modeIcon}><Gauge color={colors.greenDark} size={23} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.modeTitle}>Hızlı sinyal</Text>
                    <Text style={styles.modeDescription}>Birkaç dokunuşla güncel durumu paylaş</Text>
                  </View>
                  <ChevronLeft color={colors.muted} size={20} style={styles.forwardIcon} />
                </Pressable>
                <Pressable disabled={!area} onPress={() => chooseMode('detailed')} style={[styles.modeItem, !area && styles.disabled]}>
                  <View style={[styles.modeIcon, styles.detailModeIcon]}><FileText color={colors.coral} size={23} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.modeTitle}>Detaylı paylaşım</Text>
                    <Text style={styles.modeDescription}>Gördüğünü başlık ve açıklamayla anlat</Text>
                  </View>
                  <ChevronLeft color={colors.muted} size={20} style={styles.forwardIcon} />
                </Pressable>
              </>
            )}

            {step === 1 && (
              <>
                <Text style={styles.prompt}>{mode === 'quick' ? 'Sinyal türünü seç' : 'Paylaşımının bağlamını seç'}</Text>
                <View style={styles.optionGrid}>
                  {signalTypes.filter((item) => mode === 'detailed' || item.quick).map((item) => (
                    <Pressable
                      key={item.type}
                      onPress={() => chooseType(item.type)}
                      style={[styles.typeOption, signalType === item.type && styles.selectedOption]}
                    >
                      <View style={[styles.selectionDot, signalType === item.type && styles.selectionDotActive]} />
                      <Text style={styles.typeLabel}>{item.label}</Text>
                      <Text style={styles.typeDescription}>{item.description}</Text>
                    </Pressable>
                  ))}
                </View>

                {signalType && values.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>DURUM</Text>
                    <View style={styles.chipRow}>
                      {values.map((item) => (
                        <Pressable
                          key={item.value}
                          onPress={() => setSignalValue(item.value)}
                          style={[styles.choiceChip, signalValue === item.value && styles.choiceChipActive]}
                        >
                          <Text style={[styles.choiceChipText, signalValue === item.value && styles.choiceChipTextActive]}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <View style={styles.signalSummary}>
                  <Sparkles color={colors.green} size={18} />
                  <Text style={styles.signalSummaryText}>{generatedTitle}</Text>
                </View>
                {mode === 'detailed' && (
                  <>
                    <Text style={styles.inputLabel}>Kısa özet</Text>
                    <TextInput
                      autoFocus
                      maxLength={80}
                      onChangeText={setTitle}
                      placeholder="Örn. Şu an 20 dakika sıra var"
                      placeholderTextColor="#929A95"
                      style={styles.input}
                      value={title}
                    />
                  </>
                )}
                <Text style={styles.inputLabel}>{mode === 'quick' ? 'Kısa not (isteğe bağlı)' : 'Detay ekle'}</Text>
                <TextInput
                  maxLength={500}
                  multiline
                  onChangeText={setContent}
                  placeholder="Karar vermeyi kolaylaştıracak somut bir bilgi ekle."
                  placeholderTextColor="#929A95"
                  style={[styles.input, styles.textArea]}
                  textAlignVertical="top"
                  value={content}
                />
                <Text style={styles.counter}>{content.length}/500</Text>
              </>
            )}

            {step === 3 && area && signalType && (
              <>
                <View style={styles.previewBand}>
                  <View style={styles.previewPin}><MapPin color={colors.white} fill={colors.white} size={20} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.previewPlace}>{area.name}</Text>
                    <Text style={styles.previewSignal}>{mode === 'quick' ? generatedTitle : title}</Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>HARİTADA KALMA SÜRESİ</Text>
                <View style={styles.chipRow}>
                  {durationOptions.map((item) => (
                    <Pressable key={item.hours} onPress={() => setExpiryHours(item.hours)} style={[styles.choiceChip, expiryHours === item.hours && styles.choiceChipActive]}>
                      <Text style={[styles.choiceChipText, expiryHours === item.hours && styles.choiceChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>PROFİL GÖRÜNÜMÜ</Text>
                <View style={styles.segmented}>
                  <Pressable onPress={() => setIdentityDisclosure('LimitedProfile')} style={[styles.segment, identityDisclosure === 'LimitedProfile' && styles.segmentActive]}>
                    <Text style={[styles.segmentText, identityDisclosure === 'LimitedProfile' && styles.segmentTextActive]}>Sınırlı profil</Text>
                  </Pressable>
                  <Pressable onPress={() => setIdentityDisclosure('AnonymousMap')} style={[styles.segment, identityDisclosure === 'AnonymousMap' && styles.segmentActive]}>
                    <Text style={[styles.segmentText, identityDisclosure === 'AnonymousMap' && styles.segmentTextActive]}>Haritada anonim</Text>
                  </Pressable>
                </View>

                <View style={styles.policySummary}>
                  <ShieldCheck color={colors.greenDark} size={19} />
                  <View style={styles.flex}>
                    <Text style={styles.policyTitle}>Güvenli yayın özeti</Text>
                    <Text style={styles.policyText}>Herkese açık · {identityDisclosure === 'AnonymousMap' ? 'Anonim profil' : 'Sınırlı profil'} · Yaklaşık alan · {expiryLabel}</Text>
                  </View>
                </View>
                <View style={styles.sourceRow}>
                  <Clock3 color={colors.muted} size={16} />
                  <Text style={styles.sourceText}>Topluluk kaynağı olarak yayınlanacak</Text>
                </View>
              </>
            )}
          </ScrollView>

          {step > 0 && (
            <Pressable
              disabled={isSubmitting || (step === 1 && !typeIsValid) || (step === 2 && !contentIsValid)}
              onPress={step === 3 ? publish : next}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (isSubmitting || (step === 1 && !typeIsValid) || (step === 2 && !contentIsValid)) && styles.disabledButton]}
            >
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : step === 3 ? <Send color={colors.white} size={19} /> : null}
              <Text style={styles.primaryButtonText}>{step === 3 ? 'Sinyali yayınla' : 'Devam et'}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.scrim, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, height: '92%', paddingHorizontal: 18, paddingTop: 9, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.line, borderRadius: 2, height: 4, marginBottom: 12, width: 38 },
  header: { alignItems: 'center', flexDirection: 'row' },
  headerCopy: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900' },
  heading: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 2 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  progressTrack: { backgroundColor: colors.line, height: 3, marginHorizontal: -18, marginTop: 12 },
  progressValue: { backgroundColor: colors.lime, height: 3 },
  scrollContent: { paddingBottom: 18, paddingTop: 18 },
  flex: { flex: 1 },
  errorBox: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderRadius: 8, flexDirection: 'row', gap: 9, marginBottom: 14, padding: 12 },
  errorTitle: { color: colors.error, fontSize: 12, fontWeight: '900' },
  errorText: { color: colors.error, fontSize: 11, lineHeight: 16, marginTop: 3 },
  areaSummary: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 11, padding: 13 },
  areaIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  summaryLabel: { color: colors.green, fontSize: 9, fontWeight: '900' },
  areaName: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 2 },
  areaMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  locationWarning: { alignItems: 'center', backgroundColor: '#FFF2EA', borderRadius: 8, flexDirection: 'row', gap: 9, padding: 13 },
  locationWarningText: { color: colors.warning, flex: 1, fontSize: 12, fontWeight: '800' },
  areaActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  secondaryButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  secondaryButtonText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  settingsLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 10 },
  settingsText: { color: colors.warning, fontSize: 11, fontWeight: '900' },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', marginBottom: 9, marginTop: 22 },
  modeItem: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76, paddingVertical: 10 },
  modeIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 46, justifyContent: 'center', width: 46 },
  detailModeIcon: { backgroundColor: '#FFF2EC' },
  modeTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  modeDescription: { color: colors.muted, fontSize: 11, marginTop: 3 },
  forwardIcon: { transform: [{ rotate: '180deg' }] },
  disabled: { opacity: 0.42 },
  prompt: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 12 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  typeOption: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 92, padding: 11, width: '48.5%' },
  selectedOption: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  selectionDot: { borderColor: colors.line, borderRadius: 6, borderWidth: 2, height: 12, marginBottom: 8, width: 12 },
  selectionDotActive: { backgroundColor: colors.green, borderColor: colors.green },
  typeLabel: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  typeDescription: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12 },
  choiceChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  choiceChipText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  choiceChipTextActive: { color: colors.white },
  signalSummary: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 9, padding: 12 },
  signalSummaryText: { color: colors.greenDark, flex: 1, fontSize: 13, fontWeight: '900' },
  inputLabel: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 18 },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 50, paddingHorizontal: 13, paddingVertical: 11 },
  textArea: { minHeight: 128 },
  counter: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'right' },
  previewBand: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 13 },
  previewPin: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, height: 44, justifyContent: 'center', width: 44 },
  previewPlace: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  previewSignal: { color: colors.muted, fontSize: 11, marginTop: 3 },
  segmented: { backgroundColor: colors.surfaceSoft, borderRadius: 8, flexDirection: 'row', padding: 3 },
  segment: { alignItems: 'center', borderRadius: 6, flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  segmentTextActive: { color: colors.greenDark },
  policySummary: { alignItems: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 10, marginTop: 20, padding: 13 },
  policyTitle: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  policyText: { color: colors.greenDark, fontSize: 10, lineHeight: 15, marginTop: 3 },
  sourceRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 12, paddingHorizontal: 2 },
  sourceText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 52 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.42 },
  pressed: { opacity: 0.88 },
});
