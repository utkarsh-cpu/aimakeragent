import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
export function HomePage() {
  const Navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f4f1e8" }}>
      {/* Header with Login Button */}
      <header className="flex justify-end p-6">
        <Button
          onClick={() => Navigate("/login")}
          variant="outline"
          className="border-slate-700 text-slate-700 hover:bg-slate-100"
        >
          Login
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center px-6 py-20">
        {/* Main Heading */}
        <h1
          className="text-6xl md:text-8xl mb-8 text-center tracking-tight"
          style={{
            color: "#1e3a8a",
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: "bold",
          }}
        >
          AIMAKEAGENT
        </h1>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 mt-8">
          <Button
            onClick={() => Navigate("/chat")}
            size="lg"
            className="px-12 py-6 text-xl bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Chat
          </Button>
          <Button
            onClick={() => Navigate("/canvas")}
            size="lg"
            variant="outline"
            className="px-12 py-6 text-xl border-slate-700 text-slate-700 hover:bg-slate-100 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Canvas
          </Button>
        </div>

        {/* Subtitle */}
        <p
          className="mt-12 text-xl text-center text-slate-600 max-w-2xl leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Create, collaborate, and innovate with AI-powered tools designed for
          modern workflows.
        </p>
      </main>
    </div>
  );
}
