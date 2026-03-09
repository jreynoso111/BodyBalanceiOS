import { create } from 'zustand';

const COMMON_GREETINGS = ['Hello', 'Hi', 'Howdy', 'Hola'];
const OTHER_GREETINGS = [
  'Bonjour', 'Ciao', 'Hallo', 'Ola', 'Aloha', 'Namaste', 'Salaam',
  'Marhaba', 'Shalom', 'Hej', 'Hei', 'Salut', 'Merhaba', 'Szia',
  'Ahoj', 'Xin chao', 'Sawasdee', 'Mingalaba', 'Sawubona', 'Jambo',
  'Habari', 'Dia dhuit', 'Yassas', 'Privet', 'Zdravo', 'Pozdrav',
  'Servus', 'Dzień dobry', 'Buna', 'Labas', 'Sveiki', 'Tere',
  'Moien', 'God dag', 'Godan daginn', 'Hyvää päivää', 'Geia sou',
  'Selam', 'As-salaam', 'Kia ora', 'Talofa', 'Bula', 'Konnichiwa',
  'Konbanwa', 'Annyeonghaseyo', 'Ni hao', 'Nin hao', 'Zdravstvuyte',
  'Dobry den', 'Dobrý deň', 'Dobar dan', 'Bok', 'Halo', 'Kamusta',
  'Vanakkam', 'Sat sri akaal', 'Adaab', 'Sannu', 'Molo', 'Avuxeni',
  'Ndewo', 'Assalaamu alaikum', 'Përshëndetje', 'Mirëdita', 'Tungjatjeta', 'Pace'
];

const generateGreetings = (): readonly string[] => {
  const result: string[] = [];
  let commonIdx = Math.floor(Math.random() * COMMON_GREETINGS.length);
  for (let i = 0; i < OTHER_GREETINGS.length; i++) {
    // Insert a common greeting 60% of the time to make it frequent
    if (i % 2 === 0 || i % 3 === 0) {
      result.push(COMMON_GREETINGS[commonIdx % COMMON_GREETINGS.length]);
      commonIdx++;
    }
    result.push(OTHER_GREETINGS[i]);
  }
  return result;
};

const GREETINGS = generateGreetings();

interface GreetingState {
  greetings: readonly string[];
  currentIndex: number;
  initialized: boolean;
  initializeGreeting: () => void;
  advanceGreeting: () => void;
}

export const useGreetingStore = create<GreetingState>((set, get) => ({
  greetings: GREETINGS,
  currentIndex: 0,
  initialized: false,
  initializeGreeting: () =>
    set((state) => {
      if (state.initialized) {
        return state;
      }

      const randomIndex = Math.floor(Math.random() * state.greetings.length);

      return {
        ...state,
        initialized: true,
        currentIndex: randomIndex,
      };
    }),
  advanceGreeting: () => {
    const { greetings, currentIndex } = get();
    set({ currentIndex: (currentIndex + 1) % greetings.length });
  },
}));
