import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ICC] Render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: 12, padding: 32,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 28, opacity: 0.4 }}>⚠</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", fontFamily: "'Outfit',sans-serif" }}>
          {this.props.label || "Something went wrong"}
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "'JetBrains Mono',monospace" }}>
          Reload the page or click below to try again.
        </div>
        <button
          onClick={() => this.setState({ hasError: false })}
          style={{
            marginTop: 4, padding: "8px 18px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-o)",
            color: "var(--t2)", cursor: "pointer", fontSize: 13,
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
