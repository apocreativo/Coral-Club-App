import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";
import { DebugBoundary } from "./DebugBoundary.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <DebugBoundary>
    <App />
  </DebugBoundary>
);
