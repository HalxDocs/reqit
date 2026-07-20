import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEnvStore, collectionVarMap } from "./useEnvStore";

const { mockSnapshot, mockEnvFn } = vi.hoisted(() => ({
  mockSnapshot: (environments: any[], active: string = "") => ({
    environments,
    active,
    convertValues: (a: any) => a,
  }),
  mockEnvFn: () => ({
    id: "env-1",
    name: "Dev",
    vars: [
      { key: "host", value: "localhost:3000", enabled: true },
      { key: "token", value: "abc123", enabled: true },
      { key: "disabled_var", value: "hidden", enabled: false },
    ],
    convertValues: (a: any) => a,
  }),
}));

vi.mock("../../../../wailsjs/go/main/App", () => ({
  GetEnvironments: vi.fn().mockResolvedValue(mockSnapshot([], "")),
  CreateEnvironment: vi.fn().mockResolvedValue(mockEnvFn()),
  UpdateEnvironment: vi.fn().mockResolvedValue(undefined),
  DeleteEnvironment: vi.fn().mockResolvedValue(undefined),
  SetActiveEnvironment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../wailsjs/runtime", () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

vi.mock("@/app/stores/useToastStore", () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}));

import {
  GetEnvironments,
  CreateEnvironment,
  UpdateEnvironment,
  DeleteEnvironment,
  SetActiveEnvironment,
} from "../../../../wailsjs/go/main/App";

const mockEnv = (overrides: Record<string, unknown> = {}) => ({
  id: "env-1",
  name: "Dev",
  vars: [
    { key: "host", value: "localhost:3000", enabled: true },
    { key: "token", value: "abc123", enabled: true },
    { key: "disabled_var", value: "hidden", enabled: false },
  ],
  convertValues: (a: any) => a,
  ...overrides,
});

describe("collectionVarMap", () => {
  it("builds a map from enabled vars", () => {
    const env = mockEnv();
    const map = collectionVarMap(env.vars);
    expect(map.get("host")).toBe("localhost:3000");
    expect(map.get("token")).toBe("abc123");
    expect(map.has("disabled_var")).toBe(false);
  });

  it("returns empty map for null/undefined input", () => {
    expect(collectionVarMap(null as any).size).toBe(0);
    expect(collectionVarMap(undefined as any).size).toBe(0);
  });
});

describe("useEnvStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEnvStore.setState(useEnvStore.getInitialState());
  });

  it("starts with empty state", () => {
    const s = useEnvStore.getState();
    expect(s.environments).toEqual([]);
    expect(s.activeID).toBe("");
    expect(s.loaded).toBe(false);
    expect(s.loadError).toBeNull();
  });

  it("load fetches environments", async () => {
    const env = mockEnv();
    vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([env], "env-1"));
    await useEnvStore.getState().load();
    const s = useEnvStore.getState();
    expect(s.environments).toHaveLength(1);
    expect(s.activeID).toBe("env-1");
    expect(s.loaded).toBe(true);
  });

  it("load handles errors", async () => {
    vi.mocked(GetEnvironments).mockRejectedValueOnce(new Error("network fail"));
    await useEnvStore.getState().load();
    const s = useEnvStore.getState();
    expect(s.loadError).toBe("network fail");
    expect(s.loaded).toBe(true);
  });

  it("setActive calls backend and updates activeID", async () => {
    const env = mockEnv();
    vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([env]));
    await useEnvStore.getState().load();
    await useEnvStore.getState().setActive("env-1");
    expect(SetActiveEnvironment).toHaveBeenCalledWith("env-1");
    expect(useEnvStore.getState().activeID).toBe("env-1");
  });

  it("create calls backend and reloads", async () => {
    const newEnv = mockEnv({ id: "env-2", name: "Staging" });
    vi.mocked(CreateEnvironment).mockResolvedValueOnce(newEnv as any);
    vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([mockEnv(), newEnv], "env-1"));
    const result = await useEnvStore.getState().create("Staging");
    expect(CreateEnvironment).toHaveBeenCalledWith("Staging");
    expect(result.id).toBe("env-2");
    expect(useEnvStore.getState().environments).toHaveLength(2);
  });

  it("remove calls backend and reloads", async () => {
    vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([]));
    await useEnvStore.getState().remove("env-1");
    expect(DeleteEnvironment).toHaveBeenCalledWith("env-1");
  });

  it("update calls backend and reloads", async () => {
    vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([]));
    await useEnvStore.getState().update("env-1", "Updated", []);
    expect(UpdateEnvironment).toHaveBeenCalled();
  });

  describe("resolve", () => {
    beforeEach(async () => {
      const env = mockEnv();
      vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([env], "env-1"));
      await useEnvStore.getState().load();
    });

    it("replaces {{var}} with active env value", () => {
      const result = useEnvStore.getState().resolve("{{host}}/api");
      expect(result).toBe("localhost:3000/api");
    });

    it("replaces multiple variables", () => {
      const result = useEnvStore.getState().resolve("{{host}}/{{token}}");
      expect(result).toBe("localhost:3000/abc123");
    });

    it("leaves unresolved vars intact", () => {
      const result = useEnvStore.getState().resolve("{{missing}}");
      expect(result).toBe("{{missing}}");
    });

    it("returns empty string for empty input", () => {
      expect(useEnvStore.getState().resolve("")).toBe("");
    });

    it("resolves with extraVars overriding env vars", () => {
      const extra = new Map([["host", "prod.example.com"]]);
      const result = useEnvStore.getState().resolve("{{host}}", extra);
      expect(result).toBe("prod.example.com");
    });

    it("does not resolve disabled vars", () => {
      const result = useEnvStore.getState().resolve("{{disabled_var}}");
      expect(result).toBe("{{disabled_var}}");
    });
  });

  describe("unresolved", () => {
    beforeEach(async () => {
      const env = mockEnv();
      vi.mocked(GetEnvironments).mockResolvedValueOnce(mockSnapshot([env], "env-1"));
      await useEnvStore.getState().load();
    });

    it("returns empty for resolved vars", () => {
      expect(useEnvStore.getState().unresolved("{{host}}")).toEqual([]);
    });

    it("returns list of unresolved var names", () => {
      expect(useEnvStore.getState().unresolved("{{missing1}}/{{missing2}}")).toEqual([
        "missing1",
        "missing2",
      ]);
    });

    it("deduplicates", () => {
      expect(useEnvStore.getState().unresolved("{{missing}}/{{missing}}")).toEqual(["missing"]);
    });

    it("returns empty for empty input", () => {
      expect(useEnvStore.getState().unresolved("")).toEqual([]);
    });
  });

  it("cleanup calls EventsOff", async () => {
    const runtime = await import("../../../../wailsjs/runtime");
    useEnvStore.getState().cleanup();
    expect(runtime.EventsOff).toHaveBeenCalledWith("environments:changed");
  });
});
