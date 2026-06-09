import { useEffect } from "react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useResponseStore } from "@/features/request/stores/useResponseStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";

// useTabSync mirrors live edits in useRequestStore + useResponseStore back into
// the active tab's snapshot, so closing/switching tabs preserves work.
// We debounce request-side updates because typing in the URL bar fires many
// events; response updates are rare so we sync immediately.
export function useTabSync() {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timeout = null;
      useTabsStore.getState().syncFromActiveStores();
    };

    const unsubReq = useRequestStore.subscribe(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(flush, 250);
    });

    const unsubResp = useResponseStore.subscribe((s, prev) => {
      if (s.response !== prev.response) {
        useTabsStore.getState().syncFromActiveStores();
      }
    });

    return () => {
      unsubReq();
      unsubResp();
      if (timeout) clearTimeout(timeout);
    };
  }, []);
}
