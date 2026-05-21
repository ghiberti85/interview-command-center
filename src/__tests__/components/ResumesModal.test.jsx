import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState, useRef } from "react";

// ─── Inline ResumesModal replica ──────────────────────────────────────────────
// ResumesModal is not exported from App.jsx, so we replicate its logic here.
// Any change to the original must be reflected in this replica.

// Stub for extractTextFromPdf — will be overridden per test via vi.fn
let extractTextFromPdfImpl = async (file) => {
  if (file.name.endsWith(".pdf")) {
    return "Extracted PDF text";
  }
  throw new Error("Not a PDF");
};

function ResumesModal({ onClose, isMobile = false, resumes, onAdd, onUpdate, onDelete, loading }) {
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt");
  const [content, setContent] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const resetForm = () => { setName(""); setLanguage("pt"); setContent(""); setEditing(null); setError(""); };

  const openNew = () => { resetForm(); setView("new"); };
  const openEdit = (r) => { setName(r.name); setLanguage(r.language); setContent(r.content); setEditing(r); setView("edit"); };

  const handleFile = async (file) => {
    setError("");
    setExtracting(true);
    try {
      let text = "";
      if (file.name.endsWith(".pdf")) {
        text = await extractTextFromPdfImpl(file);
      } else {
        text = await file.text();
      }
      setContent(text.trim());
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setError("Não foi possível extrair o texto. Tente colar o conteúdo manualmente.");
    }
    setExtracting(false);
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) { setError("Nome e conteúdo são obrigatórios."); return; }
    setSaving(true);
    setError("");
    if (view === "new") {
      const { error: e } = await onAdd({ name: name.trim(), language, content: content.trim() });
      if (e) { setError("Erro ao salvar. Tente novamente."); setSaving(false); return; }
    } else {
      const { error: e } = await onUpdate(editing.id, { name: name.trim(), language, content: content.trim() });
      if (e) { setError("Erro ao atualizar. Tente novamente."); setSaving(false); return; }
    }
    setSaving(false);
    resetForm();
    setView("list");
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este currículo?")) return;
    await onDelete(id);
  };

  const langLabel = { pt: "Português", en: "English", es: "Español" };

  return (
    <div data-testid="resumes-modal">
      {/* Header */}
      <div>
        {view !== "list" && (
          <button data-testid="btn-back" onClick={() => { resetForm(); setView("list"); }}>Voltar</button>
        )}
        <div data-testid="modal-title">
          {view === "list" ? "Meus Currículos" : view === "new" ? "Novo Currículo" : "Editar Currículo"}
        </div>
        <button data-testid="btn-close" onClick={onClose}>Fechar</button>
      </div>

      {/* List view */}
      {view === "list" && (
        <div data-testid="view-list">
          {loading ? (
            <div data-testid="loading-spinner">Carregando...</div>
          ) : resumes.length === 0 ? (
            <div data-testid="empty-state">
              <div>Nenhum currículo salvo</div>
              <button data-testid="btn-add-from-empty" onClick={openNew}>Adicionar currículo</button>
            </div>
          ) : (
            <div>
              {resumes.map(r => (
                <div key={r.id} data-testid={`resume-item-${r.id}`}>
                  <span data-testid={`resume-name-${r.id}`}>{r.name}</span>
                  <span data-testid={`resume-lang-${r.id}`}>{langLabel[r.language] || r.language}</span>
                  <button data-testid={`btn-edit-${r.id}`} onClick={() => openEdit(r)}>Editar</button>
                  <button data-testid={`btn-delete-${r.id}`} onClick={() => handleDelete(r.id)}>Excluir</button>
                </div>
              ))}
            </div>
          )}
          <button data-testid="btn-add" onClick={openNew}>Adicionar currículo</button>
        </div>
      )}

      {/* Form view (new or edit) */}
      {(view === "new" || view === "edit") && (
        <div data-testid="view-form">
          <input
            data-testid="input-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do currículo"
          />
          <select
            data-testid="select-language"
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <input
            data-testid="input-file"
            type="file"
            ref={fileRef}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
          />
          <textarea
            data-testid="textarea-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Cole aqui o texto do seu currículo..."
          />
          {error && <div data-testid="form-error">{error}</div>}
          <button data-testid="btn-save" onClick={save} disabled={saving || extracting}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button data-testid="btn-cancel" onClick={() => { resetForm(); setView("list"); }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const mockResumes = [
  { id: "r1", name: "CV Tech Lead PT", language: "pt", content: "Texto PT", user_id: "u1", created_at: "2026-05-01T00:00:00Z" },
  { id: "r2", name: "CV Senior FE EN", language: "en", content: "Resume EN", user_id: "u1", created_at: "2026-04-20T00:00:00Z" },
];

const defaultProps = {
  onClose: vi.fn(),
  isMobile: false,
  resumes: mockResumes,
  onAdd: vi.fn().mockResolvedValue({ data: { id: "r3" }, error: null }),
  onUpdate: vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null }),
  onDelete: vi.fn().mockResolvedValue({ error: null }),
  loading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset extractTextFromPdf to default success
  extractTextFromPdfImpl = async (file) => {
    if (file.name.endsWith(".pdf")) return "Extracted PDF text";
    throw new Error("Not a PDF");
  };
  // Default confirm to true
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("ResumesModal — lista vazia", () => {
  it("exibe estado vazio quando não há currículos", () => {
    render(<ResumesModal {...defaultProps} resumes={[]} />);
    expect(screen.getByTestId("empty-state")).toBeDefined();
    expect(screen.getByText("Nenhum currículo salvo")).toBeDefined();
  });

  it("exibe spinner quando loading=true", () => {
    render(<ResumesModal {...defaultProps} resumes={[]} loading={true} />);
    expect(screen.getByTestId("loading-spinner")).toBeDefined();
  });

  it("botão Adicionar no estado vazio abre formulário de novo", () => {
    render(<ResumesModal {...defaultProps} resumes={[]} />);
    fireEvent.click(screen.getByTestId("btn-add-from-empty"));
    expect(screen.getByTestId("view-form")).toBeDefined();
    expect(screen.getByTestId("modal-title").textContent).toBe("Novo Currículo");
  });
});

describe("ResumesModal — lista com currículos", () => {
  it("exibe nome e idioma de cada currículo", () => {
    render(<ResumesModal {...defaultProps} />);
    expect(screen.getByTestId("resume-name-r1").textContent).toBe("CV Tech Lead PT");
    expect(screen.getByTestId("resume-lang-r1").textContent).toBe("Português");
    expect(screen.getByTestId("resume-name-r2").textContent).toBe("CV Senior FE EN");
    expect(screen.getByTestId("resume-lang-r2").textContent).toBe("English");
  });

  it("botão Adicionar abre formulário", () => {
    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    expect(screen.getByTestId("view-form")).toBeDefined();
  });

  it("botão Fechar chama onClose", () => {
    const onClose = vi.fn();
    render(<ResumesModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("btn-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ResumesModal — criar novo", () => {
  it("validação: exibe erro quando nome ou conteúdo estão vazios", async () => {
    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(screen.getByTestId("form-error").textContent).toBe("Nome e conteúdo são obrigatórios.");
    });
  });

  it("validação: erro quando apenas nome preenchido", async () => {
    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Meu CV" } });
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(screen.getByTestId("form-error").textContent).toBe("Nome e conteúdo são obrigatórios.");
    });
  });

  it("salvar novo chama onAdd com os dados corretos", async () => {
    const onAdd = vi.fn().mockResolvedValue({ data: { id: "r3" }, error: null });
    render(<ResumesModal {...defaultProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Meu CV" } });
    fireEvent.change(screen.getByTestId("textarea-content"), { target: { value: "Conteúdo do currículo" } });
    fireEvent.change(screen.getByTestId("select-language"), { target: { value: "en" } });
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: "Meu CV", language: "en", content: "Conteúdo do currículo" });
    });
  });

  it("após salvar com sucesso, volta para a lista", async () => {
    const onAdd = vi.fn().mockResolvedValue({ data: { id: "r3" }, error: null });
    render(<ResumesModal {...defaultProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Meu CV" } });
    fireEvent.change(screen.getByTestId("textarea-content"), { target: { value: "Conteúdo" } });
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(screen.getByTestId("view-list")).toBeDefined();
    });
  });

  it("erro do servidor exibe mensagem de erro no formulário", async () => {
    const onAdd = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    render(<ResumesModal {...defaultProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Meu CV" } });
    fireEvent.change(screen.getByTestId("textarea-content"), { target: { value: "Conteúdo" } });
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(screen.getByTestId("form-error").textContent).toBe("Erro ao salvar. Tente novamente.");
    });
  });

  it("cancelar no formulário volta para lista", () => {
    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));
    fireEvent.click(screen.getByTestId("btn-cancel"));
    expect(screen.getByTestId("view-list")).toBeDefined();
  });
});

describe("ResumesModal — editar", () => {
  it("abre formulário preenchido ao clicar em editar", () => {
    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-edit-r1"));
    expect(screen.getByTestId("view-form")).toBeDefined();
    expect(screen.getByTestId("modal-title").textContent).toBe("Editar Currículo");
    expect(screen.getByTestId("input-name").value).toBe("CV Tech Lead PT");
    expect(screen.getByTestId("textarea-content").value).toBe("Texto PT");
    expect(screen.getByTestId("select-language").value).toBe("pt");
  });

  it("salvar edição chama onUpdate com id correto", async () => {
    const onUpdate = vi.fn().mockResolvedValue({ data: { id: "r1" }, error: null });
    render(<ResumesModal {...defaultProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("btn-edit-r1"));
    fireEvent.change(screen.getByTestId("input-name"), { target: { value: "CV Atualizado" } });
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith("r1", { name: "CV Atualizado", language: "pt", content: "Texto PT" });
    });
  });
});

describe("ResumesModal — excluir", () => {
  it("chama onDelete após confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDelete = vi.fn().mockResolvedValue({ error: null });
    render(<ResumesModal {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("btn-delete-r1"));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("r1");
    });
  });

  it("não chama onDelete quando usuário cancela confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onDelete = vi.fn();
    render(<ResumesModal {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("btn-delete-r1"));
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("ResumesModal — upload de arquivo", () => {
  it("arquivo .txt preenche conteúdo via file.text()", async () => {
    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));

    const txtContent = "Meu currículo em texto puro";
    const file = new File([txtContent], "cv.txt", { type: "text/plain" });

    const input = screen.getByTestId("input-file");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId("textarea-content").value).toBe(txtContent);
    });
    // Name should be auto-filled from filename (without extension)
    expect(screen.getByTestId("input-name").value).toBe("cv");
  });

  it("arquivo .pdf usa extractTextFromPdf e preenche conteúdo", async () => {
    extractTextFromPdfImpl = vi.fn().mockResolvedValue("Texto extraído do PDF");

    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));

    const file = new File(["dummy"], "resume.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("input-file");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId("textarea-content").value).toBe("Texto extraído do PDF");
    });
  });

  it("exibe mensagem de erro quando extração falha", async () => {
    extractTextFromPdfImpl = vi.fn().mockRejectedValue(new Error("Parse error"));

    render(<ResumesModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-add"));

    const file = new File(["bad"], "broken.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("input-file");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByTestId("form-error").textContent).toBe(
        "Não foi possível extrair o texto. Tente colar o conteúdo manualmente."
      );
    });
  });
});
