import { ChatApp } from "./components/ChatApp";
import { useTheme } from "./components/ui/use-theme";
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./components/HomePage";
export default function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <div
      className={`${isDarkMode ? "dark" : ""} min-h-screen bg-background text-foreground transition-colors`}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/chat"
          element={
            <ChatApp
              isDarkMode={isDarkMode}
              setIsDarkMode={(isDark) => setTheme(isDark ? "dark" : "light")}
              theme={theme}
              setTheme={setTheme}
            />
          }
        />
        <Route
          path="/canvas"
          element={
            <ChatApp
              isDarkMode={isDarkMode}
              setIsDarkMode={(isDark) => setTheme(isDark ? "dark" : "light")}
              theme={theme}
              setTheme={setTheme}
            />
          }
        />
      </Routes>
    </div>
  );
}
