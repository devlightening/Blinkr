import { agoLabel, confirmLabel, pinTagParts, stateLabel, stateSummary, trustLine } from '../src/live/liveLabels';
import type { LiveKind, LiveState } from '../src/live/liveState';

function check(value: unknown, message: string) { if (!value) throw new Error(message); }
const eq = (actual: unknown, expected: unknown, message: string) => check(JSON.stringify(actual) === JSON.stringify(expected), `${message}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
const run = (name: string, fn: () => void) => { fn(); console.log('PASS', name); };

const state = (p: Partial<LiveState> & { kind: LiveKind }): LiveState => ({
  level: null, freshness: 1, ageMinutes: 4, confirmations: 1, isStale: false, source: 'live', signalType: 'Crowd', signalValue: null, ...p,
});
const none: LiveState = { kind: 'unknown', level: null, freshness: 0, ageMinutes: null, confirmations: 0, isStale: true, source: 'none', signalType: null, signalValue: null };

run('stateLabel: a queue reads as a queue, a crowd as a crowd', () => {
  eq(stateLabel(state({ kind: 'calm' })), 'Açık · Sakin', 'calm crowd');
  eq(stateLabel(state({ kind: 'calm', signalType: 'Queue' })), 'Sıra yok', 'calm queue');
  eq(stateLabel(state({ kind: 'busy' })), 'Hareketli', 'busy crowd');
  eq(stateLabel(state({ kind: 'busy', signalType: 'Queue' })), 'Kısa sıra', 'busy queue');
  eq(stateLabel(state({ kind: 'crowded' })), 'Kalabalık', 'crowded crowd');
  eq(stateLabel(state({ kind: 'crowded', signalType: 'queue' })), 'Uzun sıra', 'crowded queue, any case');
});

run('stateLabel: new opening vs offer, event, notice, none', () => {
  eq(stateLabel(state({ kind: 'deal', signalType: 'NewOpening' })), 'Yeni açılış', 'new opening');
  eq(stateLabel(state({ kind: 'deal', signalType: 'Offer' })), 'Fırsat', 'offer');
  eq(stateLabel(state({ kind: 'event', signalType: 'Event' })), 'Etkinlik', 'event');
  eq(stateLabel(state({ kind: 'unknown', signalType: 'TemporaryStatus' })), 'Geçici durum', 'notice');
  eq(stateLabel(none), 'Canlı bilgi yok', 'no live info');
});

run('stateLabel: hours estimates are never worded as live', () => {
  eq(stateLabel(state({ kind: 'info', source: 'hours', signalType: null })), 'Açık · saate göre', 'open by hours');
  eq(stateLabel(state({ kind: 'closed', source: 'hours', signalType: null })), 'Kapalı · saate göre', 'closed by hours');
  eq(stateLabel(state({ kind: 'info', signalType: 'TemporaryStatus' })), 'Açık', 'open live');
  eq(stateLabel(state({ kind: 'closed', signalType: 'TemporaryStatus' })), 'Kapalı', 'closed live');
});

run('pinTagParts: short words and ages, hour estimates marked', () => {
  eq(pinTagParts(state({ kind: 'calm', ageMinutes: 4 })), { state: 'Sakin', age: '4 dk' }, 'calm 4 min');
  eq(pinTagParts(state({ kind: 'crowded', ageMinutes: 125 })), { state: 'Kalabalık', age: '2 sa' }, 'crowded 2 h');
  eq(pinTagParts(state({ kind: 'busy', signalType: 'Queue', ageMinutes: 30 })), { state: 'Kısa sıra', age: '30 dk' }, 'queue words');
  eq(pinTagParts(state({ kind: 'unknown', signalType: 'TemporaryStatus' })).state, 'Geçici', 'notice is short');
  eq(pinTagParts(state({ kind: 'deal', signalType: 'NewOpening' })).state, 'Yeni açılış', 'new opening');
  eq(pinTagParts(state({ kind: 'info', source: 'hours', ageMinutes: null })), { state: 'Açık (tahmin)', age: '' }, 'open estimate');
  eq(pinTagParts(state({ kind: 'closed', source: 'hours', ageMinutes: null })), { state: 'Kapalı (tahmin)', age: '' }, 'closed estimate');
  eq(pinTagParts(state({ kind: 'calm', ageMinutes: 3 * 24 * 60 })).age, '3 g', 'days');
  eq(pinTagParts(none), { state: '', age: '' }, 'none has no tag');
});

run('trustLine: empty unless live; the count appears only from two people', () => {
  eq(trustLine(none), '', 'none');
  eq(trustLine(state({ kind: 'calm', source: 'hours', ageMinutes: null })), '', 'hours');
  eq(trustLine(state({ kind: 'calm', confirmations: 1, ageMinutes: 4 })), 'son bilgi 4 dk önce', 'one reporter');
  eq(trustLine(state({ kind: 'calm', confirmations: 3, ageMinutes: 4 })), '3 kişi yerinde bildirdi · son bilgi 4 dk önce', 'three reporters');
  eq(confirmLabel(1), '', 'one is not a confirmation');
  eq(confirmLabel(2), '2 kişi yerinde bildirdi', 'two');
});

run('stateSummary: no live info is honest with and without history', () => {
  eq(stateSummary(none), 'Henüz canlı bilgi yok. İlk sen bildir.', 'none');
  eq(stateSummary(none, true), 'Şu an canlı bilgi yok; aşağıda eski bildirimler var.', 'none with history');
  eq(stateSummary(state({ kind: 'calm', signalType: 'Queue' })), 'Şu an sıra yok.', 'queue calm');
  eq(stateSummary(state({ kind: 'deal', signalType: 'NewOpening' })), 'Yeni açılmış.', 'new');
});

run('agoLabel: minutes, hours, days; 59.5 min rounds to 1 hour, not "60 dk"', () => {
  eq(agoLabel(null), '', 'null');
  eq(agoLabel(0.2), '1 dk önce', 'under a minute');
  eq(agoLabel(4), '4 dk önce', 'minutes');
  eq(agoLabel(59.4), '59 dk önce', '59.4');
  eq(agoLabel(59.5), '1 sa önce', '59.5');
  eq(agoLabel(150), '3 sa önce', 'hours');
  eq(agoLabel(60 * 24 * 2), '2 gün önce', 'days');
});
