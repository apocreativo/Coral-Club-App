import React from "react";

const DEBUG = new URLSearchParams(window.location.search).has("debug");

export class DebugBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      console.error("[DebugBoundary]", error, info);
    } catch {}
  }

  render() {
    if (this.state.error && DEBUG) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.92)",
            color: "#fff",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            padding: 16,
            zIndex: 2147483647,
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            ⚠️ Error en ejecución
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
            {String(this.state.error)}
          </pre>
          <div style={{ marginTop: 12, opacity: 0.8 }}>
            Quita <code>?debug=1</code> de la URL para ocultar este panel.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
