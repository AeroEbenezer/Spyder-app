'use client';

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Headphones, UploadCloud, Library, LogOut, FileText, CheckCircle2 } from "lucide-react";

export default function SpyderApp() {
  const [supabaseClient] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) return createClient(url, key);
    return null;
  });

  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"convert" | "library">("convert");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!supabaseClient) return;
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  const handleGoogleSignIn = async () => {
    if (!supabaseClient) {
      setUser({ email: "commander.khaly@spyder.app", id: "demo-user-123" });
      return;
    }
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
  };

  const handleSignOut = async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    setUser(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatusText("");
    }
  };

  const handleSynthesize = async () => {
    if (!selectedFile || !supabaseClient) return;
    setIsProcessing(true);

    try {
      // 1. Upload directly to Supabase from the browser
      setStatusText("Uploading document to storage...");
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const rawFilePath = `raw/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("audiobooks")
        .upload(rawFilePath, selectedFile, { upsert: true });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}. (Check bucket RLS policies)`);
      }

      // 2. Get the public URL of the uploaded file
      const { data: publicUrlData } = supabaseClient.storage
        .from("audiobooks")
        .getPublicUrl(rawFilePath);

      // 3. Send just the URL to the Next.js API (Tiny payload = No 502 crashes)
      setStatusText("Synthesizing audio on server...");
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: publicUrlData.publicUrl,
          fileName: selectedFile.name,
          userId: user?.id || "00000000-0000-0000-0000-000000000000",
        }),
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned non-JSON (${res.status}): ${responseText.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Synthesis failed");
      }

      console.log("Success! Audio URL:", data.audioUrl);
      setStatusText("Audiobook generated successfully!");
      setSelectedFile(null);
    } catch (err: any) {
      console.error("Error during synthesis:", err);
      setStatusText(err.message || "An error occurred during synthesis.");
    } finally {
      setIsProcessing(false);
    }
  };

  const RenderLogo = ({ sizeClass = "w-10 h-10" }: { sizeClass?: string }) => {
    if (logoError) return <Headphones className={`${sizeClass} text-indigo-500`} />;
    return (
      <img
        src="/logo.jpg"
        alt="Spyder Logo"
        className={`${sizeClass} object-cover rounded-lg border border-zinc-800`}
        onError={() => setLogoError(true)}
      />
    );
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-[#09090C] text-white flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 mb-8">
          <RenderLogo sizeClass="w-16 h-16" />
          <h1 className="text-4xl font-bold tracking-tight">Spyder</h1>
          <p className="text-zinc-400 text-sm">Quiet, ruthless productivity.</p>
        </div>
        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center space-y-4 shadow-xl">
          <h2 className="text-xl font-semibold">Sign In</h2>
          <p className="text-zinc-400 text-sm">Log in to access your personal audiobook library and saved files.</p>
          <button
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-white"
          >
            Continue with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090C] text-white flex flex-col">
      <header className="w-full border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-3">
          <RenderLogo sizeClass="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight">Spyder</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-400">{user.email}</span>
          <button onClick={handleSignOut} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors" title="Sign Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <div className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="flex gap-2 border-b border-zinc-800 pb-3">
          <button onClick={() => setActiveTab("convert")} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === "convert" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`}>
            <UploadCloud className="w-4 h-4" /> Studio
          </button>
          <button onClick={() => setActiveTab("library")} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === "library" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`}>
            <Library className="w-4 h-4" /> My Library
          </button>
        </div>
        {activeTab === "convert" ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Convert Document to Audiobook</h2>
              <p className="text-zinc-400 text-sm">Upload a text file to synthesize audio using ElevenLabs.</p>
            </div>
            <div className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-8 text-center transition-colors">
              <input type="file" accept=".txt" onChange={handleFileChange} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                <FileText className="w-10 h-10 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-300">
                  {selectedFile ? selectedFile.name : "Click to select a document (.txt)"}
                </span>
              </label>
            </div>
            {selectedFile && (
              <button onClick={handleSynthesize} disabled={isProcessing} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isProcessing ? "Processing Audio..." : "Start Conversion"}
              </button>
            )}
            {statusText && <p className="text-center text-xs text-indigo-400 font-mono mt-2 break-words">{statusText}</p>}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-semibold">Your Library is Syncing</h2>
            <p className="text-zinc-400 text-sm">All processed audiobooks for <span className="text-white font-mono">{user.email}</span> will persist here automatically.</p>
          </div>
        )}
      </div>
    </main>
  );
}
