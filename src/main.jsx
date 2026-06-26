import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import AuthProvider from "./contexts/AuthProvider";
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/global.css";
import "./styles/components/public-layout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
