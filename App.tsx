import { lazy, Suspense } from "react";
import { useTheme } from "./components/ui/use-theme";
import { Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Skeleton } from "./components/ui/skeleton";
import { PerformanceMonitor } from "./utils/performance-monitor";
import React from "react";

// Lazy load components for better performance
const ChatApp = lazy(() => 
  import("./components/ChatApp").then(module => ({ default: module.ChatApp }))
);

const HomePage = lazy(() => 
  import("./components/HomePage").then(module => ({ default: module.HomePage }))
);

// Loading fallback components
const ChatAppSkeleton = () => (
  <div className="h-screen flex">
    <div className="w-80 border-r bg-muted/50">
      <Skeleton className="h-16 m-4" />
      <div className="p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
    <div className="flex-1 flex flex-col">
      <Skeleton className="h-16 border-b" />
      <div className="flex-1 p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 m-4" />
    </div>
  </div>
);

const HomePageSkeleton = () => (
  <div className="min-h-screen" style={{ backgroundColor: "#f4f1e8" }}>
    <header className="flex justify-end p-6">
      <Skeleton className="h-10 w-20" />
    </header>
    <main className="flex flex-col items-center justify-center px-6 py-20">
      <Skeleton className="h-24 w-96 mb-8" />
      <div className="flex gap-6 mt-8">
        <Skeleton className="h-16 w-32" />
        <Skeleton className="h-16 w-32" />
      </div>
      <Skeleton className="h-16 w-96 mt-12" />
    </main>
  </div>
);

export default function App() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Track app performance
  const endMeasure = PerformanceMonitor.startMeasure('App');
  
  // End measurement after render
  setTimeout(endMeasure, 0);

  return (
    <ErrorBoundary>
      <div
        className={`${isDarkMode ? "dark" : ""} min-h-screen bg-background text-foreground transition-colors`}
      >
        <Routes>
          <Route 
            path="/" 
            element={
              <ErrorBoundary resetKeys={[theme]}>
                <Suspense fallback={<HomePageSkeleton />}>
                  <HomePage />
                </Suspense>
              </ErrorBoundary>
            } 
          />
          <Route
            path="/chat"
            element={
              <ErrorBoundary resetKeys={[theme, String(isDarkMode)]}>
                <Suspense fallback={<ChatAppSkeleton />}>
                  <ChatApp
                    isDarkMode={isDarkMode}
                    setIsDarkMode={(isDark) => setTheme(isDark ? "dark" : "light")}
                    theme={theme}
                    setTheme={setTheme}
                  />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="/canvas"
            element={
              <ErrorBoundary resetKeys={[theme, String(isDarkMode)]}>
                <Suspense fallback={<ChatAppSkeleton />}>
                  <ChatApp
                    isDarkMode={isDarkMode}
                    setIsDarkMode={(isDark) => setTheme(isDark ? "dark" : "light")}
                    theme={theme}
                    setTheme={setTheme}
                  />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
