import { useRef, useCallback } from 'react';

export function useLongPress(onLongPress: () => void, onTap: () => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    cancel();
    if (!didLongPress.current) {
      onTap();
    }
  }, [cancel, onTap]);

  return {
    onTouchStart: start,
    onTouchEnd: end,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
  };
}
