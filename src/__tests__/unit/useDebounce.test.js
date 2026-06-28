import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../../hooks/useDebounce.js";

describe("useDebounce", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("retorna o valor inicial imediatamente", () => {
    const { result } = renderHook(() => useDebounce("hello", 200));
    expect(result.current).toBe("hello");
  });

  it("não atualiza antes do delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), { initialProps: { v: "a" } });
    rerender({ v: "b" });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("a");
  });

  it("atualiza após o delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), { initialProps: { v: "a" } });
    rerender({ v: "b" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("b");
  });

  it("só aplica o último valor quando há múltiplas mudanças rápidas", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), { initialProps: { v: "a" } });
    rerender({ v: "b" });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ v: "c" });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ v: "d" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("d");
  });

  it("usa delay padrão de 150ms quando não especificado", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), { initialProps: { v: "x" } });
    rerender({ v: "y" });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("x");
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe("y");
  });

  it("limpa o timer ao desmontar sem atualizar o estado", () => {
    const { result, rerender, unmount } = renderHook(({ v }) => useDebounce(v, 200), { initialProps: { v: "a" } });
    rerender({ v: "b" });
    unmount();
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("a");
  });
});
