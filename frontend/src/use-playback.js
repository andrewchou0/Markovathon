import { useEffect, useRef, useState } from 'react';

export default function usePlayback(frames) {
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const remaining = useRef(0);
  const timedCursor = useRef(-1);
  const timer = useRef(null);
  const last = frames.length - 1;
  const complete = cursor === last;
  useEffect(() => {
    if (timedCursor.current !== cursor) {
      remaining.current = cursor >= 0 ? frames[cursor].duration : 0;
      timedCursor.current = cursor;
    }
    if (!playing || cursor < 0 || complete) return;
    const started = performance.now();
    timer.current = setTimeout(() => {
      setCursor(cursor + 1);
      if (cursor + 1 === last) setPlaying(false);
    }, remaining.current);
    return () => {
      clearTimeout(timer.current);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [cursor, playing, complete, frames, last]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  function start() { setCursor(0); setPlaying(true); }
  function reset() { clearTimeout(timer.current); setPlaying(false); setCursor(-1); }
  function next() { clearTimeout(timer.current); setPlaying(false); setCursor(value => Math.min(value + 1, last)); }
  return { cursor, playing, complete, start, reset, next, pause: () => setPlaying(false), toggle: () => setPlaying(value => !value) };
}
