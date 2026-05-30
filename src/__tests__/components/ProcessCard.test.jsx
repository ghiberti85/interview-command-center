import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProcessCard from "../../components/process/ProcessCard.jsx";

vi.mock("../../supabase.js", () => ({
  supabase: { auth: { getSession: vi.fn() } },
  rowToProcess: (r) => r,
  processToRow: (p) => p,
}));

vi.mock("../../components/ui/Ic.jsx", () => ({
  default: ({ n, s = 16 }) => <svg data-testid={`icon-${n}`} width={s} height={s} />,
}));

const baseProcess = { company: "Nubank", channel: "", tags: [], starred: false, stage: "contacted", nextStepDate: null };

describe("ProcessCard — channel icon", () => {
  it("channel='linkedin' → ícone linkedin visível", () => {
    render(<ProcessCard process={{ ...baseProcess, channel: "linkedin" }} isMobile={false} />);
    expect(screen.getByTestId("icon-linkedin")).toBeDefined();
  });

  it("channel='' → sem ícone de canal", () => {
    render(<ProcessCard process={baseProcess} isMobile={false} />);
    expect(screen.queryByTestId("icon-linkedin")).toBeNull();
    expect(screen.queryByTestId("icon-email")).toBeNull();
    expect(screen.queryByTestId("icon-whatsapp")).toBeNull();
    expect(screen.queryByTestId("icon-star")).toBeNull();
  });

  it("channel='whatsapp' → ícone whatsapp visível", () => {
    render(<ProcessCard process={{ ...baseProcess, channel: "whatsapp" }} isMobile={false} />);
    expect(screen.getByTestId("icon-whatsapp")).toBeDefined();
  });
});

describe("ProcessCard — long press to select", () => {
  it("long press 500ms → onLongPress chamado", async () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<ProcessCard process={baseProcess} isMobile={true} onLongPress={onLongPress} onClick={vi.fn()} />);
    fireEvent.touchStart(screen.getByTestId("process-card"));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("touch curto → onLongPress não chamado, onClick chamado", async () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    render(<ProcessCard process={baseProcess} isMobile={true} onLongPress={onLongPress} onClick={onClick} />);
    fireEvent.touchStart(screen.getByTestId("process-card"));
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.touchEnd(screen.getByTestId("process-card"));
    fireEvent.click(screen.getByTestId("process-card"));
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("move durante touch → cancela long press", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<ProcessCard process={baseProcess} isMobile={true} onLongPress={onLongPress} onClick={vi.fn()} />);
    fireEvent.touchStart(screen.getByTestId("process-card"));
    fireEvent.touchMove(screen.getByTestId("process-card"));
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLongPress).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("selectionMode=true + isSelected=true → checkbox visível com check", () => {
    render(<ProcessCard process={baseProcess} isMobile={true} selectionMode={true} isSelected={true} onClick={vi.fn()} />);
    expect(screen.getByTestId("icon-check")).toBeDefined();
  });

  it("selectionMode=true + isSelected=false → checkbox visível sem check", () => {
    render(<ProcessCard process={baseProcess} isMobile={true} selectionMode={true} isSelected={false} onClick={vi.fn()} />);
    expect(screen.queryByTestId("icon-check")).toBeNull();
  });

  it("sem isMobile → onLongPress nunca chamado mesmo após 500ms", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<ProcessCard process={baseProcess} isMobile={false} onLongPress={onLongPress} onClick={vi.fn()} />);
    fireEvent.touchStart(screen.getByTestId("process-card"));
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLongPress).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
