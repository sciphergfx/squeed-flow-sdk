import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";

function createStore() {
  let selected: string | undefined;
  let snapshot: ReactElement | null = null;
  const listeners = new Set<() => void>();
  const publish = (element: ReactElement | null) => {
    snapshot = element;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    select(id: string, element: ReactElement) {
      selected = id;
      publish(element);
    },
    update(id: string, element: ReactElement) {
      if (selected === id) publish(element);
    },
    remove(id: string) {
      if (selected === id) {
        selected = undefined;
        publish(null);
      }
    },
  };
}

export const RecentToolbarContext = createContext<ReturnType<
  typeof createStore
> | null>(null);
export const useRecentToolbarStore = () => useState(createStore)[0];

export function useRecentToolbarAction(element: ReactElement, enabled = true) {
  const store = useContext(RecentToolbarContext);
  const id = useId();
  useEffect(() => {
    if (enabled) store?.update(id, element);
    else store?.remove(id);
  });
  useEffect(() => () => store?.remove(id), [store, id]);
  return () => {
    if (enabled) store?.select(id, element);
  };
}

export function RecentToolbarAction({ divider }: { divider: ReactElement }) {
  const store = useContext(RecentToolbarContext)!;
  const action = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => null,
  );
  return (
    <RecentToolbarContext.Provider value={null}>
      <span
        data-recent-toolbar-action=""
        style={{ display: action ? "contents" : "none" }}
      >
        {action && divider}
        {action}
      </span>
    </RecentToolbarContext.Provider>
  );
}
