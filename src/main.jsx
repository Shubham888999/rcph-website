import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import VoxAnnouncementBar from "./components/VoxAnnouncementBar";
import AuthProvider from "./contexts/AuthProvider";
import ThemeProvider from "./features/theme/ThemeProvider";
import ThemeToggle from "./features/theme/ThemeToggle";
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/global.css";
import "./styles/components/public-layout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <VoxAnnouncementBar />
        <App />
        <ThemeToggle />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
