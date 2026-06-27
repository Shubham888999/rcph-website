import { useCallback, useEffect, useRef, useState } from "react";
import { classifyEvents } from "./eventModel";
import { getPublicEvents, reloadPublicEvents } from "./eventsService";

const initialState = {
  status: "loading",
  upcomingEvents: [],
  recentEvents: [],
  error: null,
};

export default function usePublicEvents() {
  const [state, setState] = useState(initialState);
  const mountedRef = useRef(false);

  const resolveRequest = useCallback((request) => {
    request
      .then((events) => {
        if (!mountedRef.current) return;
        const { upcomingEvents, recentEvents } = classifyEvents(events);
        setState({ status: "success", upcomingEvents, recentEvents, error: null });
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        if (import.meta.env.DEV) {
          console.error("Unable to load public events.", error);
        }
        setState({ ...initialState, status: "error", error });
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    resolveRequest(getPublicEvents());
    return () => {
      mountedRef.current = false;
    };
  }, [resolveRequest]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    resolveRequest(reloadPublicEvents());
  }, [resolveRequest]);

  return { ...state, reload };
}
