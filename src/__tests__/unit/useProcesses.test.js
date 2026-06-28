import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { mockSession, mockProcesses } from "../../test/mocks/fixtures.js";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockOrder = vi.fn();
const mockEq = vi.fn();

function makeChain(terminalFn) {
  const chain = {
    select: () => chain,
    insert: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: (...args) => { mockEq(...args); return chain; },
    order: (...args) => { mockOrder(...args); return chain; },
    then: (resolve) => resolve(terminalFn()),
  };
  return chain;
}

vi.mock("../../supabase.js", () => {
  let _terminalFn = () => ({ data: null, error: null });
  const mockFrom = vi.fn(() => makeChain(() => _terminalFn()));
  const supabase = {
    from: mockFrom,
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }) },
    _setTerminal: (fn) => { _terminalFn = fn; },
    _mockFrom: mockFrom,
  };
  return { supabase, rowToProcess: (r) => r, processToRow: (p) => p };
});

vi.mock("../../constants/index.js", () => ({
  DEMO_PROCESSES: [
    { id: "demo1", company: "Demo Corp", role: "Dev", stage: "contacted", tags: [], steps: [], starred: false, nextStepDate: null },
    { id: "demo2", company: "Demo Inc",  role: "Lead", stage: "interview", tags: [], steps: [], starred: false, nextStepDate: null },
  ],
  DARK_VARS: {}, LIGHT_VARS: {}, GLOBAL_CSS: "", T: {}, iconBtn: () => ({}), CONTACT_CHANNELS: [],
}));

import { supabase } from "../../supabase.js";
import { useProcesses } from "../../hooks/useProcesses.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useProcesses — modo demo", () => {
  it("carrega DEMO_PROCESSES sem chamar o banco", async () => {
    const { result } = renderHook(() => useProcesses(null, true));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));
    expect(result.current.processes).toHaveLength(2);
    expect(result.current.processes[0].id).toBe("demo1");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("useProcesses — modo autenticado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase._setTerminal(() => ({ data: mockProcesses, error: null }));
  });

  it("carrega processos do banco na montagem", async () => {
    const { result } = renderHook(() => useProcesses(mockSession, false));
    expect(result.current.dbLoading).toBe(true);
    await waitFor(() => expect(result.current.dbLoading).toBe(false));
    expect(result.current.processes).toHaveLength(mockProcesses.length);
    expect(supabase.from).toHaveBeenCalledWith("processes");
  });

  it("seta dbError se o banco retornar erro", async () => {
    supabase._setTerminal(() => ({ data: null, error: { message: "DB error" } }));
    const { result } = renderHook(() => useProcesses(mockSession, false));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));
    expect(result.current.dbError).toBe(true);
    expect(result.current.processes).toHaveLength(0);
  });

  it("não carrega se session for null", () => {
    const { result } = renderHook(() => useProcesses(null, false));
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result.current.dbLoading).toBe(true);
  });

  it("updateProcess atualiza o processo na lista local", async () => {
    const { result } = renderHook(() => useProcesses(mockSession, false));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    const updated = { ...mockProcesses[0], role: "Lead Engineer" };
    await act(async () => { await result.current.updateProcess(updated); });

    expect(result.current.processes.find(p => p.id === updated.id).role).toBe("Lead Engineer");
  });

  it("deleteProcess remove o processo da lista local", async () => {
    const { result } = renderHook(() => useProcesses(mockSession, false));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    const idToDelete = mockProcesses[0].id;
    await act(async () => { await result.current.deleteProcess(idToDelete); });

    expect(result.current.processes.find(p => p.id === idToDelete)).toBeUndefined();
  });

  it("addProcess adiciona o processo no início da lista", async () => {
    const { result } = renderHook(() => useProcesses(mockSession, false));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    supabase._setTerminal(() => ({ data: null, error: null }));
    const newP = { id: "new1", company: "Nova", role: "Dev", stage: "contacted", tags: [], steps: [], starred: false, nextStepDate: null };
    let res;
    await act(async () => { res = await result.current.addProcess(newP); });

    expect(res.ok).toBe(true);
    expect(result.current.processes[0].id).toBe("new1");
  });

  it("addProcess retorna ok:false se o banco retornar erro", async () => {
    const { result } = renderHook(() => useProcesses(mockSession, false));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    supabase._setTerminal(() => ({ data: null, error: { message: "insert failed" } }));
    const newP = { id: "bad1", company: "X", role: "Y", stage: "contacted", tags: [], steps: [], starred: false, nextStepDate: null };
    let res;
    await act(async () => { res = await result.current.addProcess(newP); });

    expect(res.ok).toBe(false);
    expect(result.current.processes.find(p => p.id === "bad1")).toBeUndefined();
  });
});

describe("useProcesses — modo demo CRUD (sem banco)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updateProcess atualiza localmente sem chamar o banco", async () => {
    const { result } = renderHook(() => useProcesses(null, true));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    const updated = { ...result.current.processes[0], role: "CTO" };
    await act(async () => { await result.current.updateProcess(updated); });

    expect(result.current.processes[0].role).toBe("CTO");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("deleteProcess remove localmente sem chamar o banco", async () => {
    const { result } = renderHook(() => useProcesses(null, true));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    await act(async () => { await result.current.deleteProcess("demo1"); });

    expect(result.current.processes).toHaveLength(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("addProcess retorna ok:true e adiciona no início sem chamar o banco", async () => {
    const { result } = renderHook(() => useProcesses(null, true));
    await waitFor(() => expect(result.current.dbLoading).toBe(false));

    const newP = { id: "demoNew", company: "Fresh", role: "Dev", stage: "contacted", tags: [], steps: [], starred: false, nextStepDate: null };
    let res;
    await act(async () => { res = await result.current.addProcess(newP); });

    expect(res.ok).toBe(true);
    expect(result.current.processes[0].id).toBe("demoNew");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
