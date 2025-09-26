
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={e:null}; }
  static getDerivedStateFromError(e){ return {e}; }
  componentDidCatch(e, info){ console.error("[Runtime Error]", e, info); }
  render(){
    if(this.state.e){
      return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",color:"#e8eef6",padding:16,zIndex:999999,fontFamily:"-apple-system,system-ui,Inter,Segoe UI"}}>
          <h2>⚠️ Error en ejecución</h2>
          <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.e?.stack || this.state.e)}</pre>
          <p style={{opacity:.8}}>Abre la consola para detalles. Tu UI no se modifica; este panel solo aparece ante errores.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
window.addEventListener("error", e=> console.error("[window.onerror]", e.error||e.message));
window.addEventListener("unhandledrejection", e=> console.error("[unhandledrejection]", e.reason));

createRoot(document.getElementById("root")).render(<ErrorBoundary><App/></ErrorBoundary>);
