import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!elevenKey || !supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing API keys" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.fileUrl) {
      return NextResponse.json({ error: "No file URL received" }, { status: 400 });
    }

    const { fileUrl, fileName, userId } = body;

    // Download file
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 400 });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer).slice(0, 150000);

    // Only TXT support
    if (!fileName.toLowerCase().endsWith(".txt")) {
      return NextResponse.json({ error: "Only .txt files supported" }, { status: 400 });
    }

    const text = buffer.toString("utf-8");
    const trimmedText = text.replace(/\s+/g, " ").trim().slice(0, 4000);

    if (!trimmedText) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // ElevenLabs API
    const voiceId = "E8Q1PJdefCYegeUO4PU1";
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenKey.trim(),
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: "eleven_flash_v2_5",
      }),
    });

    if (!elevenRes.ok) {
      return NextResponse.json({ error: "ElevenLabs API error" }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
    const supabase = createClient(supabaseUrl, supabaseKey);

    const safeTitle = (fileName || "document")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_");
    const storagePath = `audio/${Date.now()}_${safeTitle}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("audiobooks")
      .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("audiobooks").getPublicUrl(storagePath);

    await supabase.from("audiobooks").insert({
      user_id: userId || "00000000-0000-0000-0000-000000000000",
      title: fileName,
      audio_file_url: publicUrlData.publicUrl,
      file_size_bytes: audioBuffer.length,
    });

    return NextResponse.json({
      success: true,
      audioUrl: publicUrlData.publicUrl,
      title: fileName,
    });
  } catch (err: any) {
    console.error("Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
