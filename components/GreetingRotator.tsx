import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useGreetingStore } from '@/store/greetingStore';

const ROTATION_INTERVAL_MS = 9000;

export function GreetingRotator() {
  const pathname = usePathname();
  const initializeGreeting = useGreetingStore((state) => state.initializeGreeting);
  const advanceGreeting = useGreetingStore((state) => state.advanceGreeting);
  const bootstrappedRef = useRef(false);
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    initializeGreeting();
    advanceGreeting();
  }, [initializeGreeting, advanceGreeting]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (previousPathRef.current === null) {
      previousPathRef.current = pathname;
      return;
    }

    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      advanceGreeting();
    }
  }, [pathname, advanceGreeting]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      advanceGreeting();
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [advanceGreeting]);

  return null;
}
