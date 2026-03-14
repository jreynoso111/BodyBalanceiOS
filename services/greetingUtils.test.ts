import { buildGreetingSequence, buildWeightedGreetingPool, GREETING_LIBRARY } from '@/services/greetingUtils';

const countLanguageGreetings = (pool: readonly string[], language: keyof typeof GREETING_LIBRARY) =>
  pool.filter((greeting) => GREETING_LIBRARY[language].includes(greeting)).length;

describe('greetingUtils', () => {
  it('prioritizes the selected account language', () => {
    const pool = buildWeightedGreetingPool('es');

    expect(countLanguageGreetings(pool, 'es')).toBeGreaterThan(countLanguageGreetings(pool, 'en'));
    expect(countLanguageGreetings(pool, 'es')).toBeGreaterThan(countLanguageGreetings(pool, 'fr'));
    expect(countLanguageGreetings(pool, 'es')).toBeGreaterThan(countLanguageGreetings(pool, 'it'));
  });

  it('keeps English and Spanish prominent even for other language preferences', () => {
    const pool = buildWeightedGreetingPool('fr');

    expect(countLanguageGreetings(pool, 'fr')).toBeGreaterThan(countLanguageGreetings(pool, 'it'));
    expect(countLanguageGreetings(pool, 'en')).toBeGreaterThan(countLanguageGreetings(pool, 'it'));
    expect(countLanguageGreetings(pool, 'es')).toBeGreaterThan(countLanguageGreetings(pool, 'it'));
  });

  it('builds a shuffled greeting sequence with multiple greeting families', () => {
    const sequence = buildGreetingSequence('en');

    expect(sequence.length).toBeGreaterThan(20);
    expect(sequence.some((greeting) => GREETING_LIBRARY.en.includes(greeting))).toBe(true);
    expect(sequence.some((greeting) => GREETING_LIBRARY.es.includes(greeting))).toBe(true);
  });
});
