import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async loader and tracks loading/error. `reload()` re-runs it safely without stale races.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  const reqIdRef = useRef(0);
  fnRef.current = fn;

  const run = useCallback(() => {
    const id = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current()
      .then((data) => {
        if (id === reqIdRef.current) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (id === reqIdRef.current) setState({ data: null, loading: false, error });
      });
    return () => {
      if (id === reqIdRef.current) reqIdRef.current += 1;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => run(), deps);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
