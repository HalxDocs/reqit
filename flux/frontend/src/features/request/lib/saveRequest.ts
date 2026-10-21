import { useCollectionStore } from "@/features/collections/stores/useCollectionStore";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { useTabsStore } from "@/features/tabs/stores/useTabsStore";
import { useUIStore } from "@/app/stores/useUIStore";
import { toast } from "@/app/stores/useToastStore";
import { buildPayloadLiteral } from "@/features/request/lib/buildPayload";
import type { models } from "../../../../wailsjs/go/models";

export type SaveOutcome = "saved" | "needs-details";

/**
 * Locate the collection and saved request a tab points at.
 */
function findSavedRequest(
  collections: models.Collection[],
  savedRequestID: string,
): { collection: models.Collection; request: models.SavedRequest } | null {
  for (const collection of collections) {
    const request = collection.requests.find((r) => r.id === savedRequestID);
    if (request) return { collection, request };
  }
  return null;
}

/**
 * Save the active request.
 *
 * A request that is already linked to a saved one is updated in place, which
 * is what a second Ctrl+S should do. A request that has never been saved
 * needs a name and a collection, so the save dialog is opened instead.
 */
export async function saveActiveRequest(): Promise<SaveOutcome> {
  const tabs = useTabsStore.getState();
  const active = tabs.tabs.find((t) => t.id === tabs.activeID);
  const collections = useCollectionStore.getState().collections;

  if (!active?.savedRequestID) {
    useUIStore.getState().openSaveModal();
    return "needs-details";
  }

  const match = findSavedRequest(collections, active.savedRequestID);
  if (!match) {
    // The saved request is gone (deleted elsewhere). Fall back to the dialog
    // so the user can save it as a new request instead of losing the work.
    useUIStore.getState().openSaveModal();
    return "needs-details";
  }

  const state = useRequestStore.getState();
  const payload = buildPayloadLiteral(state);

  try {
    await useCollectionStore.getState().updateRequest(match.request.id, match.request.name, payload);
    toast.success(`Saved "${match.request.name}" to ${match.collection.name}`);
    return "saved";
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    return "saved";
  }
}
