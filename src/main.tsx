import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initCloudSync } from "./game/cloudSync";
import { useGame } from "./game/store";
import { useAuth } from "./game/authStore";

// Register cloud sync BEFORE the store's first saveState fires. It stays dormant
// until the user signs in (no token => push() is a no-op).
initCloudSync({
  onServerState: (merged) => useGame.setState(merged),
  onStatus: (s) => useAuth.getState().setSync(s)
});

// Restore session (if any) and reconcile with the server.
void useAuth.getState().boot();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
