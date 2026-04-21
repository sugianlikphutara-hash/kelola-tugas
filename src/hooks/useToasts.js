import { useCallback, useEffect, useReducer, useRef } from "react";

function toastsReducer(state, action) {
  switch (action.type) {
    case "push":
      return [...state, action.toast];
    case "dismiss":
      return state.filter((toast) => toast.id !== action.id);
    case "clear":
      return [];
    default:
      return state;
  }
}

export function useToasts({ defaultDurationMs = 3500 } = {}) {
  const [toasts, dispatch] = useReducer(toastsReducer, []);
  const timeoutsRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    dispatch({ type: "dismiss", id });
  }, []);

  const pushToast = useCallback(
    ({ type = "info", message, durationMs }) => {
      const normalizedMessage = String(message || "").trim();
      if (!normalizedMessage) return null;

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const toast = {
        id,
        type,
        message: normalizedMessage,
      };

      dispatch({ type: "push", toast });

      const timeout = setTimeout(
        () => dismissToast(id),
        Math.max(1200, Number(durationMs ?? defaultDurationMs) || defaultDurationMs)
      );
      timeoutsRef.current.set(id, timeout);

      return id;
    },
    [defaultDurationMs, dismissToast]
  );

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  return {
    toasts,
    pushToast,
    dismissToast,
    clearToasts: () => dispatch({ type: "clear" }),
  };
}
