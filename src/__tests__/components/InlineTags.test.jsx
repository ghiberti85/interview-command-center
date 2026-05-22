import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import InlineTags from "../../components/process/InlineTags.jsx";

// Mock supabase to avoid import side effects
vi.mock("../../supabase.js", () => ({
  supabase: { auth: { getSession: vi.fn() } },
  rowToProcess: (r) => r,
  processToRow: (p) => p,
}));

function Wrapper({ initialProcess }) {
  const [process, setProcess] = useState(initialProcess);
  return <InlineTags process={process} onUpdate={setProcess} />;
}

describe("InlineTags", () => {
  it("renderiza tags existentes", () => {
    render(<Wrapper initialProcess={{ tags: ["react", "typescript"] }} />);
    expect(screen.getByTestId("tag-react")).toBeDefined();
    expect(screen.getByTestId("tag-typescript")).toBeDefined();
  });

  it("clicar × remove a tag — onUpdate chamado com lista sem aquela tag", () => {
    const onUpdate = vi.fn();
    const process = { tags: ["react", "node"] };
    render(<InlineTags process={process} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByLabelText("remover react"));
    expect(onUpdate).toHaveBeenCalledWith({ tags: ["node"] });
  });

  it("digitar nova tag + Enter → onUpdate com tag adicionada", () => {
    const onUpdate = vi.fn();
    const process = { tags: ["react"] };
    render(<InlineTags process={process} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText("+ tag");
    fireEvent.change(input, { target: { value: "typescript" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith({ tags: ["react", "typescript"] });
  });

  it("blur com texto → adiciona tag", () => {
    const onUpdate = vi.fn();
    const process = { tags: [] };
    render(<InlineTags process={process} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText("+ tag");
    fireEvent.change(input, { target: { value: "nextjs" } });
    fireEvent.blur(input);
    expect(onUpdate).toHaveBeenCalledWith({ tags: ["nextjs"] });
  });

  it("tag duplicada não adiciona", () => {
    const onUpdate = vi.fn();
    const process = { tags: ["react"] };
    render(<InlineTags process={process} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText("+ tag");
    fireEvent.change(input, { target: { value: "react" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("input em branco não adiciona tag", () => {
    const onUpdate = vi.fn();
    const process = { tags: ["react"] };
    render(<InlineTags process={process} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText("+ tag");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
