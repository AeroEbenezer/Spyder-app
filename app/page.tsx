'use client';

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { UploadCloud, Library, LogOut, FileText, CheckCircle2, Play, Pause, Trash2 } from "lucide-react";

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
  const [generatedAudio, setGeneratedAudio] = useState<any>(null);
  const [audiobooks, setAudiobooks] = useState<any[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef] = useState(() => typeof Audio !== 'undefined' ? new Audio() : null);
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

  useEffect(() => {
    if (activeTab === "library" && user) {
      fetchAudiobooks();
    }
  }, [activeTab, user]);

  const fetchAudiobooks = async () => {
    if (!supabaseClient || !user) return;
    try {
      const { data, error } = await supabaseClient
        .from("audiobooks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAudiobooks(data || []);
    } catch (err) {
      console.error("Error fetching audiobooks:", err);
    }
  };

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
  if (audioRef) {
    audioRef.pause();
    audioRef.src = "";
  }
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  // Force clear all local data
  localStorage.clear();
  sessionStorage.clear();
  setUser(null);
  setPlayingId(null);
  setAudiobooks([]);
  
  // Redirect to login
  window.location.href = '/';
};

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatusText("");
      setGeneratedAudio(null);
    }
  };

  const handleSynthesize = async () => {
    if (!selectedFile || !supabaseClient) return;
    setIsProcessing(true);

    try {
      setStatusText("Uploading document to storage...");
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const rawFilePath = `raw/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("audiobooks")
        .upload(rawFilePath, selectedFile, { upsert: true });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabaseClient.storage
        .from("audiobooks")
        .getPublicUrl(rawFilePath);

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

      setGeneratedAudio({
        title: selectedFile.name,
        audioUrl: data.audioUrl,
        duration: "Generated",
      });
      setStatusText("✅ Audiobook generated successfully!");
      setSelectedFile(null);
      
      // Refresh library
      setTimeout(() => fetchAudiobooks(), 1000);
    } catch (err: any) {
      console.error("Error during synthesis:", err);
      setStatusText(err.message || "An error occurred during synthesis.");
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlayAudio = (audioUrl: string, id: string) => {
    if (!audioRef) return;

    if (playingId === id && audioRef.src === audioUrl) {
      if (audioRef.paused) {
        audioRef.play();
        setPlayingId(id);
      } else {
        audioRef.pause();
        setPlayingId(null);
      }
    } else {
      audioRef.src = audioUrl;
      audioRef.play();
      setPlayingId(id);
    }
  };

  const deleteAudiobook = async (id: string) => {
    if (!supabaseClient) return;
    try {
      const { error } = await supabaseClient.from("audiobooks").delete().eq("id", id);
      if (error) throw error;
      fetchAudiobooks();
    } catch (err) {
      console.error("Error deleting audiobook:", err);
    }
  };

  const RenderLogo = ({ sizeClass = "w-10 h-10" }: { sizeClass?: string }) => {
    if (logoError) return <div className={`${sizeClass} bg-indigo-600 rounded-lg flex items-center justify-center`} />;
    return (
      <img
        src="/logo.png"
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

            {generatedAudio && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{generatedAudio.title}</h3>
                    <p className="text-xs text-zinc-400">Ready to play</p>
                  </div>
                  <button
                    onClick={() => togglePlayAudio(generatedAudio.audioUrl, "generated")}
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors"
                  >
                    {playingId === "generated" && audioRef && !audioRef.paused ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {audiobooks.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h2 className="text-lg font-semibold">Your Library is Empty</h2>
                <p className="text-zinc-400 text-sm">Convert documents to audiobooks in the Studio tab to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {audiobooks.map((book) => (
                  <div key={book.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3 hover:border-zinc-700 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm truncate">{book.title}</h3>
                        <p className="text-xs text-zinc-400">
                          {new Date(book.created_at).toLocaleDateString()} • {book.is_public ? "Public" : "Private"}
                        </p>
                      </div>
                      <button
                        onClick={() => togglePlayAudio(book.audio_file_url, book.id)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors flex-shrink-0"
                      >
                        {playingId === book.id && audioRef && !audioRef.paused ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => deleteAudiobook(book.id)}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
