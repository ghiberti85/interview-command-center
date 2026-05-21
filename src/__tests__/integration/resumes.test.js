import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useState, useEffect, useCallback } from "react";
import { mockSession } from "../../test/mocks/fixtures.js";

// ─── Mock supabase client directly ───────────────────────────────────────────
// We cannot rely on MSW intercepting Supabase JS client calls in jsdom because
// the env file uses placeholder URLs that differ from the MSW mock URLs.
// Direct vi.mock gives us full control over returned data and error shapes.

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

// Build a chainable query builder stub
function makeChain(terminalFn) {
  const chain = {
    select: (...args) => { mockSelect(...args); return chain; },
    insert: (...args) => { mockInsert(...args); return chain; },
    update: (...args) => { mockUpdate(...args); return chain; },
    delete: (...args) => { mockDelete(...args); return chain; },
    eq: (...args) => { mockEq(...args); return chain; },
    order: (...args) => { mockOrder(...args); return chain; },
    single: (...args) => { mockSingle(...args); return terminalFn(); },
    // Allow awaiting the chain itself (for cases without .single())
    then: (resolve) => resolve(terminalFn()),
  };
  return chain;
}

vi.mock("../../supabase.js", () => {
  let _terminalFn = () => ({ data: null, error: null });
  const mockFrom = vi.fn((table) => makeChain(() => _terminalFn(table)));
  const supabase = {
    from: mockFrom,
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }) },
    _setTerminal: (fn) => { _terminalFn = fn; },
    _mockFrom: mockFrom,
  };
  return { supabase, rowToProcess: (r) => r, processToRow: (p) => p };
});

import { supabase } from "../../supabase.js";

// ─── Inline replica of useResumes from App.jsx ────────────────────────────────
function useResumes(session) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .order("created_at", { ascending: false });
    setResumes(data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (resume) => {
    const row = { ...resume, user_id: session?.user?.id };
    const { data, error } = await supabase.from("resumes").insert(row).select().single();
    if (!error && data) setResumes((prev) => [data, ...prev]);
    return { data, error };
  }, [session]);

  const update = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from("resumes").update(patch).eq("id", id).select().single();
    if (!error && data) setResumes((prev) => prev.map((r) => r.id === id ? data : r));
    return { data, error };
  }, []);

  const remove = useCallback(async (id) => {
    const { error } = await supabase.from("resumes").delete().eq("id", id);
    if (!error) setResumes((prev) => prev.filter((r) => r.id !== id));
    return { error };
  }, []);

  return { resumes, loading, add, update, remove, refetch: fetch };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockResumes = [
  { id: "r1", name: "CV Tech Lead PT", language: "pt", content: "Texto PT", user_id: "user-uuid-1", created_at: "2026-05-01T00:00:00Z" },
  { id: "r2", name: "CV Senior FE EN", language: "en", content: "Resume EN", user_id: "user-uuid-1", created_at: "2026-04-20T00:00:00Z" },
];

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("useResumes — fetch inicial", () => {
  beforeEach(() => {
    supabase._setTerminal(() => ({ data: mockResumes, error: null }));
  });

  afterEach(() => { vi.clearAllMocks(); });

  it("carrega currículos ao montar com sessão válida", async () => {
    const { result } = renderHook(() => useResumes(mockSession));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resumes).toHaveLength(2);
    expect(result.current.resumes[0].name).toBe("CV Tech Lead PT");
  });

  it("não faz fetch sem sessão", async () => {
    const { result } = renderHook(() => useResumes(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.resumes).toHaveLength(0);
  });

  it("retorna array vazio quando API retorna null", async () => {
    supabase._setTerminal(() => ({ data: null, error: null }));
    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resumes).toEqual([]);
  });
});

describe("useResumes — add", () => {
  const newResume = { id: "r3", name: "CV ES", language: "es", content: "Currículum en Español", user_id: "user-uuid-1", created_at: "2026-05-10T00:00:00Z" };

  beforeEach(() => {
    // fetch returns empty list; add returns newResume
    let callCount = 0;
    supabase._setTerminal(() => {
      callCount++;
      // First call is from the fetch on mount (order is called, no single)
      // subsequent single() calls are from add
      return callCount === 1 ? { data: [], error: null } : { data: newResume, error: null };
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  it("adiciona currículo e prepende à lista", async () => {
    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resumes).toHaveLength(0);

    await act(async () => {
      await result.current.add({ name: "CV ES", language: "es", content: "Currículum en Español" });
    });

    expect(result.current.resumes).toHaveLength(1);
    expect(result.current.resumes[0].id).toBe("r3");
  });

  it("retorna { data, error } após add bem-sucedido", async () => {
    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned;
    await act(async () => {
      returned = await result.current.add({ name: "CV ES", language: "es", content: "texto" });
    });

    expect(returned.data).toBeDefined();
    expect(returned.error).toBeNull();
  });

  it("não adiciona à lista quando API retorna erro", async () => {
    let callCount = 0;
    supabase._setTerminal(() => {
      callCount++;
      return callCount === 1
        ? { data: [], error: null }
        : { data: null, error: { message: "DB error" } };
    });

    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.add({ name: "X", language: "pt", content: "Y" });
    });

    expect(result.current.resumes).toHaveLength(0);
  });
});

describe("useResumes — update", () => {
  const updatedResume = { ...mockResumes[0], name: "CV Atualizado" };

  beforeEach(() => {
    let callCount = 0;
    supabase._setTerminal(() => {
      callCount++;
      return callCount === 1
        ? { data: mockResumes, error: null }
        : { data: updatedResume, error: null };
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  it("atualiza o item correto na lista local", async () => {
    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.resumes).toHaveLength(2));

    await act(async () => {
      await result.current.update("r1", { name: "CV Atualizado" });
    });

    const found = result.current.resumes.find((r) => r.id === "r1");
    expect(found?.name).toBe("CV Atualizado");
  });
});

describe("useResumes — remove", () => {
  beforeEach(() => {
    let callCount = 0;
    supabase._setTerminal(() => {
      callCount++;
      // fetch returns list; delete returns no error
      return callCount === 1
        ? { data: mockResumes, error: null }
        : { data: null, error: null };
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  it("remove o item da lista local", async () => {
    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.resumes).toHaveLength(2));

    await act(async () => {
      await result.current.remove("r1");
    });

    expect(result.current.resumes).toHaveLength(1);
    expect(result.current.resumes.find((r) => r.id === "r1")).toBeUndefined();
  });

  it("não remove da lista quando API retorna erro", async () => {
    let callCount = 0;
    supabase._setTerminal(() => {
      callCount++;
      return callCount === 1
        ? { data: mockResumes, error: null }
        : { data: null, error: { message: "DB error" } };
    });

    const { result } = renderHook(() => useResumes(mockSession));
    await waitFor(() => expect(result.current.resumes).toHaveLength(2));

    await act(async () => {
      await result.current.remove("r1");
    });

    expect(result.current.resumes).toHaveLength(2);
  });
});
