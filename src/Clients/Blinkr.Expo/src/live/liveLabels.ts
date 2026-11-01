import { tx } from '../i18n/tx';
import { ageParts, type LiveState } from './liveState';

const isQueue = (s: LiveState) => (s.signalType ?? '').toLowerCase() === 'queue';

/** The word that always accompanies a ring: state is never colour alone. Queue signals read as a queue, not as a crowd. */
export function stateLabel(s: LiveState): string {
  const hours = s.source === 'hours';
  switch (s.kind) {
    case 'calm': return isQueue(s) ? tx('live:stateCalmQueue', 'Sıra yok') : tx('live:stateCalm', 'Açık · Sakin');
    case 'busy': return isQueue(s) ? tx('live:stateBusyQueue', 'Kısa sıra') : tx('live:stateBusy', 'Hareketli');
    case 'crowded': return isQueue(s) ? tx('live:stateCrowdedQueue', 'Uzun sıra') : tx('live:stateCrowded', 'Kalabalık');
    case 'closed': return hours && s.nextOpenLocalTime
      ? tx('live:stateOpensAt', "{{time}}'da açılır", { time: s.nextOpenLocalTime })
      : hours ? tx('live:stateClosedHours', 'Kapalı · saate göre') : tx('live:stateClosed', 'Kapalı');
    case 'event': return tx('live:stateEvent', 'Etkinlik');
    case 'deal': return (s.signalType ?? '').toLowerCase() === 'newopening' ? tx('live:stateNew', 'Yeni açılış') : tx('live:stateDeal', 'Fırsat');
    case 'info': return hours ? tx('live:stateHours', 'Açık · saate göre') : tx('live:stateOpen', 'Açık');
    default: return s.source === 'live' ? tx('live:stateTemp', 'Geçici durum') : tx('live:stateUnknown', 'Canlı bilgi yok');
  }
}

/** "4 dk önce" · "2 sa önce" · "3 gün önce"; the word order stays with the translation. */
export function agoLabel(min: number | null): string {
  if (min === null) return '';
  const p = ageParts(min);
  if (p.unit === 'min') return tx('live:agoMin', '{{n}} dk önce', { n: p.n });
  if (p.unit === 'hour') return tx('live:agoHour', '{{n}} sa önce', { n: p.n });
  return tx('live:agoDay', '{{n}} gün önce', { n: p.n });
}

/** Short map-tag form: "Sakin" + "4 dk". */
export function pinTagParts(s: LiveState): { state: string; age: string } {
  let state = '';
  const queue = s.signalType === 'Queue';
  const hours = s.source === 'hours';
  switch (s.kind) {
    case 'calm': state = queue ? tx('live:stateCalmQueue', 'Sıra yok') : tx('live:tagCalm', 'Sakin'); break;
    case 'busy': state = queue ? tx('live:stateBusyQueue', 'Kısa sıra') : tx('live:tagBusy', 'Hareketli'); break;
    case 'crowded': state = queue ? tx('live:stateCrowdedQueue', 'Uzun sıra') : tx('live:tagCrowded', 'Kalabalık'); break;
    case 'closed': state = hours ? tx('live:tagClosedHours', 'Kapalı (tahmin)') : tx('live:tagClosed', 'Kapalı'); break;
    case 'event': state = tx('live:tagEvent', 'Etkinlik'); break;
    case 'deal': state = s.signalType === 'NewOpening' ? tx('live:tagNew', 'Yeni açılış') : tx('live:tagDeal', 'Fırsat'); break;
    case 'info': state = hours ? tx('live:tagOpenHours', 'Açık (tahmin)') : tx('live:tagOpen', 'Açık'); break;
    default: state = s.source === 'live' ? tx('live:tagTemp', 'Geçici') : '';
  }
  if (s.ageMinutes === null) return { state, age: '' };
  const p = ageParts(s.ageMinutes);
  const age = p.unit === 'min' ? tx('live:shortMin', '{{n}} dk', { n: p.n })
    : p.unit === 'hour' ? tx('live:shortHour', '{{n}} sa', { n: p.n })
    : tx('live:shortDay', '{{n}} g', { n: p.n });
  return { state, age };
}

/** "N kişi yerinde bildirdi"; one person is not a confirmation worth a line. */
export const confirmLabel = (n: number): string => (n < 2 ? '' : tx('live:reportedN', '{{n}} kişi yerinde bildirdi', { n }));

/** Screen-reader label of a row: "Soulmate Kafe. Açık · Sakin. 4 dk önce." */
export function liveA11yLabel(name: string, s: LiveState): string {
  const parts = [name, stateLabel(s)];
  const ago = agoLabel(s.ageMinutes);
  if (ago) parts.push(ago);
  return `${parts.join('. ')}.`;
}

/** One sentence under the state pill on the place page. No live info says so and invites the first report. */
/** `hasHistory`: older signals are listed below, so "be the first" would be untrue. */
export function stateSummary(s: LiveState, hasHistory = false): string {
  const hours = s.source === 'hours';
  if (s.source === 'none') return hasHistory ? tx('live:summaryNoneOld', 'Şu an canlı bilgi yok; aşağıda eski bildirimler var.') : tx('live:summaryNone', 'Henüz canlı bilgi yok. İlk sen bildir.');
  switch (s.kind) {
    case 'calm': return isQueue(s) ? tx('live:summaryCalmQueue', 'Şu an sıra yok.') : tx('live:summaryCalm', 'Şu an rahat, yer bulunur.');
    case 'busy': return isQueue(s) ? tx('live:summaryBusyQueue', 'Kısa bir sıra var.') : tx('live:summaryBusy', 'Şu an hareketli.');
    case 'crowded': return isQueue(s) ? tx('live:summaryCrowdedQueue', 'Uzun bir sıra var, bekleme olabilir.') : tx('live:summaryCrowded', 'Şu an kalabalık, bekleme olabilir.');
    case 'closed': return hours ? tx('live:summaryHoursClosed', 'Çalışma saatine göre kapalı görünüyor.') : tx('live:summaryClosed', 'Şu an kapalı görünüyor.');
    case 'event': return tx('live:summaryEvent', 'Şu an bir etkinlik var.');
    case 'deal': return (s.signalType ?? '').toLowerCase() === 'newopening' ? tx('live:summaryNew', 'Yeni açılmış.') : tx('live:summaryDeal', 'Şu an bir fırsat var.');
    case 'info': return hours ? tx('live:summaryHoursOpen', 'Çalışma saatine göre açık görünüyor.') : tx('live:summaryOpen', 'Açık olduğu doğrulandı.');
    default: return tx('live:summaryTemp', 'Geçici bir durum bildirildi.');
  }
}

/** "3 kişi yerinde bildirdi · son bilgi 4 dk önce"; one reporter reads just "son bilgi 4 dk önce". Empty without live info. */
export function trustLine(s: LiveState): string {
  if (s.source !== 'live' || s.ageMinutes === null) return '';
  const ago = agoLabel(s.ageMinutes);
  return s.confirmations >= 2
    ? tx('live:trustLineN', '{{n}} kişi yerinde bildirdi · son bilgi {{ago}}', { n: s.confirmations, ago })
    : tx('live:lastInfo', 'son bilgi {{ago}}', { ago });
}

/**
 * Map-tag words for a coordinate signal: the state word like a place, or what the neutral ring stands for
 * (an observation, an ended event/offer) - never "Geçici durum" for something that is not a status.
 */
export function signalTagParts(s: LiveState): { state: string; age: string } {
  const parts = pinTagParts(s);
  if (s.kind !== 'unknown' || s.source !== 'live') return parts;
  const type = (s.signalType ?? '').toLowerCase();
  if (type === 'temporarystatus') return parts;
  return { ...parts, state: type === 'generalobservation' ? tx('live:tagObs', 'Gözlem') : tx('live:tagEnded', 'Bitti') };
}
