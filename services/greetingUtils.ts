import { AppLanguage } from '@/constants/i18n';

export const GREETING_LIBRARY: Record<AppLanguage, readonly string[]> = {
  en: ['Hello', 'Hi', 'Hi', 'Hello', 'Hey', 'Howdy'],
  es: ['Hola', 'Hola', 'Buenas', 'Que tal'],
  fr: ['Bonjour', 'Salut'],
  it: ['Ciao', 'Salve'],
};

const INTERNATIONAL_GREETINGS = [
  'Hallo', 'Ola', 'Aloha', 'Namaste', 'Salaam', 'Marhaba', 'Shalom', 'Hej', 'Hei', 'Merhaba',
  'Szia', 'Ahoj', 'Xin chao', 'Sawasdee', 'Mingalaba', 'Sawubona', 'Jambo', 'Habari', 'Dia dhuit',
  'Yassas', 'Privet', 'Zdravo', 'Pozdrav', 'Servus', 'Dzien dobry', 'Buna', 'Labas', 'Sveiki', 'Tere',
  'Moien', 'God dag', 'Godan daginn', 'Hyvaa paivaa', 'Geia sou', 'Selam', 'As-salaam', 'Kia ora',
  'Talofa', 'Bula', 'Konnichiwa', 'Konbanwa', 'Annyeonghaseyo', 'Ni hao', 'Nin hao', 'Zdravstvuyte',
  'Dobry den', 'Dobry den', 'Dobar dan', 'Bok', 'Halo', 'Kamusta', 'Vanakkam', 'Sat sri akaal',
  'Adaab', 'Sannu', 'Molo', 'Avuxeni', 'Ndewo', 'Assalaamu alaikum', 'Pershendetje', 'Miredita',
  'Tungjatjeta', 'Pace',
] as const;

const LANGUAGE_WEIGHTS: Record<AppLanguage, Record<AppLanguage, number>> = {
  en: { en: 6, es: 3, fr: 1, it: 1 },
  es: { en: 3, es: 6, fr: 1, it: 1 },
  fr: { en: 3, es: 3, fr: 4, it: 1 },
  it: { en: 3, es: 3, fr: 1, it: 4 },
};

function repeatGreetings(greetings: readonly string[], times: number) {
  const repeated: string[] = [];
  for (let index = 0; index < times; index += 1) {
    repeated.push(...greetings);
  }
  return repeated;
}

function shuffleGreetings(items: readonly string[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildWeightedGreetingPool(language: AppLanguage) {
  const weights = LANGUAGE_WEIGHTS[language];
  const pool: string[] = [];

  (Object.keys(GREETING_LIBRARY) as AppLanguage[]).forEach((code) => {
    pool.push(...repeatGreetings(GREETING_LIBRARY[code], weights[code]));
  });

  pool.push(...INTERNATIONAL_GREETINGS);
  return pool;
}

export function buildGreetingSequence(language: AppLanguage) {
  return shuffleGreetings(buildWeightedGreetingPool(language));
}

export function getRandomGreetingIndex(greetings: readonly string[]) {
  if (!greetings.length) {
    return 0;
  }

  return Math.floor(Math.random() * greetings.length);
}
