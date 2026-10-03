import { tx } from './i18n/tx';

/** D-040 "Yer özellikleri", GET /api/places/{id}/attributes. Voters are never returned, only how many and when. */
export type AttributeKey = 'wifi' | 'outlets' | 'quiet' | 'kid_friendly' | 'accessible' | 'outdoor' | 'pet_friendly';
export type PlaceAttribute = {
  key: AttributeKey;
  state: 'yes' | 'no' | 'mixed';
  voters: number;
  lastConfirmedAtUtc: string;
  /** Nobody confirmed it for 60 days: shown dimmed, needs confirming. */
  fading: boolean;
  myVote?: boolean | null;
};
export type PlaceAttributes = { attributes: PlaceAttribute[]; canVote: boolean; catalog: AttributeKey[] };

export const attributeLabel = (key: AttributeKey) => ({
  wifi: tx('map:attr.wifi', 'Wi-Fi'),
  outlets: tx('map:attr.outlets', 'Priz'),
  quiet: tx('map:attr.quiet', 'Sessiz'),
  kid_friendly: tx('map:attr.kid_friendly', 'Çocuk dostu'),
  accessible: tx('map:attr.accessible', 'Engelli erişimi'),
  outdoor: tx('map:attr.outdoor', 'Açık alan'),
  pet_friendly: tx('map:attr.pet_friendly', 'Evcil hayvan dostu'),
}[key] ?? key);

/** "Var" / "Yok" / "Karışık" */
export const stateLabel = (state: PlaceAttribute['state']) =>
  state === 'yes' ? tx('map:attr.yes', 'Var') : state === 'no' ? tx('map:attr.no', 'Yok') : tx('map:attr.mixed', 'Karışık');

/** "3 kişi · son teyit 3 gün önce" in whole days (today / 1 day / N days). */
export const confirmationLine = (attribute: Pick<PlaceAttribute, 'voters' | 'lastConfirmedAtUtc'>, now = Date.now()) => {
  const days = Math.max(0, Math.floor((now - Date.parse(attribute.lastConfirmedAtUtc)) / 86_400_000));
  const when = days === 0 ? tx('map:attr.today', 'bugün') : tx('map:attr.daysAgo', '{{n}} gün önce', { n: days });
  return tx('map:attr.line', '{{n}} kişi · son teyit {{when}}', { n: attribute.voters, when });
};

/** Known facts first in catalog order; fading ones after the fresh ones. */
export const orderedAttributes = (attributes: PlaceAttribute[]) =>
  [...attributes].sort((a, b) => Number(a.fading) - Number(b.fading));
