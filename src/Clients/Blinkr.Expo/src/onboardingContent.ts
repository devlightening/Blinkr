/**
 * The first-run introduction: three short cards, in the order a new person needs them. Only true statements belong here;
 * every promise below is enforced by the backend (see CLAUDE.md sections 10 and 2.2).
 */
export type OnboardingPage = { id: 'know' | 'signal' | 'privacy'; title: string; body: string };

export const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    id: 'know',
    title: 'Gitmeden önce bil',
    body: 'Bir yerin şu an kalabalık mı, sıra var mı, açık mı olduğunu haritada canlı gör. Kararını buna göre ver.',
  },
  {
    id: 'signal',
    title: 'Sen de bir sinyal bırak',
    body: 'Bulunduğun yerde birkaç saniyede kısa bir sinyal paylaş. Sinyaller kısa ömürlüdür; eskiyen bilgi haritadan kalkar.',
  },
  {
    id: 'privacy',
    title: 'Konumun sende kalır',
    body: 'Kesin konumun kimseye gösterilmez. İstersen sinyalini anonim paylaşırsın; anonim sinyalleri yalnızca sen görürsün.',
  },
];

/** Where the "seen" flag lives: per signed-in person, so a new account on a shared phone still gets the introduction. */
export const onboardingKey = (userId: string) => `blinkr.onboarding.v1.${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;

export const isLastPage = (index: number) => index >= ONBOARDING_PAGES.length - 1;
export const nextPage = (index: number) => Math.min(index + 1, ONBOARDING_PAGES.length - 1);
