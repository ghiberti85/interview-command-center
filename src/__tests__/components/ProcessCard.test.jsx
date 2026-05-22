import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProcessCard from "../../components/process/ProcessCard.jsx";

// Mock supabase to avoid import side effects
vi.mock("../../supabase.js", () => ({
  supabase: { auth: { getSession: vi.fn() } },
  rowToProcess: (r) => r,
  processToRow: (p) => p,
}));

// Mock Ic to expose data-testid for icon name assertions
vi.mock("../../components/ui/Ic.jsx", () => ({
  default: ({ n, s = 16 }) => <svg data-testid={`icon-${n}`} width={s} height={s} />,
}));

// Helper to simulate touch swipe
function fireTouchSwipe(element, deltaX) {
  const startX = 200;
  fireEvent.touchStart(element, { touches: [{ clientX: startX }] });
  fireEvent.touchMove(element, { touches: [{ clientX: startX - deltaX }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: startX - deltaX }] });
}

describe("ProcessCard — channel icon", () => {
  it("channel='linkedin' → ícone linkedin visível", () => {
    render(
      <ProcessCard
        process={{ company: "Nubank", channel: "linkedin", tags: [], starred: false, stage: "contacted", nextStepDate: null }}
        isMobile={false}
      />
    );
    expect(screen.getByTestId("icon-linkedin")).toBeDefined();
  });

  it("channel='' → sem ícone de canal", () => {
    render(
      <ProcessCard
        process={{ company: "Nubank", channel: "", tags: [], starred: false, stage: "contacted", nextStepDate: null }}
        isMobile={false}
      />
    );
    expect(screen.queryByTestId("icon-linkedin")).toBeNull();
    expect(screen.queryByTestId("icon-email")).toBeNull();
    expect(screen.queryByTestId("icon-whatsapp")).toBeNull();
    expect(screen.queryByTestId("icon-star")).toBeNull();
  });

  it("channel='whatsapp' → ícone whatsapp visível", () => {
    render(
      <ProcessCard
        process={{ company: "Nubank", channel: "whatsapp", tags: [], starred: false, stage: "contacted", nextStepDate: null }}
        isMobile={false}
      />
    );
    expect(screen.getByTestId("icon-whatsapp")).toBeDefined();
  });
});

describe("ProcessCard — swipe to archive", () => {
  it("swipe left 90px → onSwipeAction chamado", () => {
    const onSwipeAction = vi.fn();
    render(
      <ProcessCard
        process={{ company: "Nubank", channel: "", tags: [], starred: false, stage: "contacted", nextStepDate: null }}
        isMobile={true}
        onSwipeAction={onSwipeAction}
      />
    );
    const card = screen.getByTestId("process-card");
    fireTouchSwipe(card, 90);
    expect(onSwipeAction).toHaveBeenCalledTimes(1);
  });

  it("swipe left 50px → onSwipeAction NÃO chamado (snap back)", () => {
    const onSwipeAction = vi.fn();
    render(
      <ProcessCard
        process={{ company: "Nubank", channel: "", tags: [], starred: false, stage: "contacted", nextStepDate: null }}
        isMobile={true}
        onSwipeAction={onSwipeAction}
      />
    );
    const card = screen.getByTestId("process-card");
    fireTouchSwipe(card, 50);
    expect(onSwipeAction).not.toHaveBeenCalled();
  });

  it("sem isMobile → onSwipeAction não é vinculado aos touch events", () => {
    const onSwipeAction = vi.fn();
    render(
      <ProcessCard
        process={{ company: "Nubank", channel: "", tags: [], starred: false, stage: "contacted", nextStepDate: null }}
        isMobile={false}
        onSwipeAction={onSwipeAction}
      />
    );
    const card = screen.getByTestId("process-card");
    fireTouchSwipe(card, 90);
    expect(onSwipeAction).not.toHaveBeenCalled();
  });
});
