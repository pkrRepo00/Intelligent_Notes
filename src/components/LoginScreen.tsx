import { User } from "firebase/auth";
import { LogIn, Sparkles } from "lucide-react";
import { googleSignIn } from "../lib/firebase";

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const handleLogin = async () => {
    try {
      const user = await googleSignIn();
      if (user) {
        onLogin(user);
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#080808] rounded-2xl p-8 border border-white/5 shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-black mb-6">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-serif font-light text-white italic mb-2 tracking-tight">
          KeepMind <span className="text-amber-500/80">AI</span>
        </h1>
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500/80 text-xs rounded-lg p-3 mb-6">
          <p className="font-semibold mb-1">IFRAME PREVIEW NOTE</p>
          <p>If you are inside the AI Studio preview window, popups may be blocked. Click the "Open in new tab" arrow icon in the top right to sign in if buttons aren't responding.</p>
        </div>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          Your personal thoughts, automatically categorized and organized by AI.
        </p>

        <button
          onClick={handleLogin}
          className="flex items-center justify-center gap-3 w-full bg-white/5 border border-white/10 hover:border-amber-500/50 text-white py-3.5 px-4 rounded-xl text-sm font-bold shadow-lg shadow-white/5 hover:bg-white/10 transition-all group"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" className="w-5 h-5 flex-shrink-0" />
          <span className="group-hover:text-amber-100 transition-colors">Sign in with Google</span>
        </button>
      </div>
    </div>
  );
}
