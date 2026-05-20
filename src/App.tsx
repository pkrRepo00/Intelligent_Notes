/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Toaster } from "sonner";
import { initAuth } from "./lib/firebase";
import { LoginScreen } from "./components/LoginScreen";
import { Dashboard } from "./components/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setUser(user);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/5 border-t-amber-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
       <Toaster theme="dark" position="bottom-right" />
       {!user ? <LoginScreen onLogin={setUser} /> : <Dashboard user={user} onLogout={() => setUser(null)} />}
    </ErrorBoundary>
  );
}

