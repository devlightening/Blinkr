/**
 * Birth year at sign-up (plan-devam F5). Mirrors the server's AgeRules so the form can explain before sending; the
 * server still decides. Only the year is asked, so the youngest possible age is used: a child is never let in, or
 * treated as an adult, a year early. Pure logic.
 */
export const MINIMUM_AGE = 13;
export const ADULT_AGE = 18;

export const youngestAge = (birthYear: number, thisYear: number) => thisYear - birthYear - 1;

export type BirthYearCheck = { year: number | null; problem: 'empty' | 'invalid' | 'tooYoung' | null; minor: boolean };

export function checkBirthYear(text: string, thisYear = new Date().getFullYear()): BirthYearCheck {
  const trimmed = text.trim();
  if (!trimmed) return { year: null, problem: 'empty', minor: false };
  if (!/^\d{4}$/.test(trimmed)) return { year: null, problem: 'invalid', minor: false };
  const year = Number(trimmed);
  if (year < 1900 || year > thisYear) return { year: null, problem: 'invalid', minor: false };
  const age = youngestAge(year, thisYear);
  if (age < MINIMUM_AGE) return { year, problem: 'tooYoung', minor: true };
  return { year, problem: null, minor: age < ADULT_AGE };
}
