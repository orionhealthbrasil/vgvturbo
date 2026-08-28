import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeKey(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function resolveOpenAiKey(supabase: any, organizationId: string) {
  const [orgRes, legacyRes] = await Promise.all([
    supabase.from("organizations").select("openai_api_key").eq("id", organizationId).single(),
    supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organizationId).limit(1).maybeSingle(),
  ]);
  if (orgRes.error) throw orgRes.error;
  if (legacyRes.error) throw legacyRes.error;
  return normalizeKey(orgRes.data?.openai_api_key) || normalizeKey(legacyRes.data?.openai_api_key);
}

// ---------- IMAGE / VIDEO via Lovable AI (Gemini) — funciona sem key da org ----------
async function describeImageWithLovableAI(mediaUrl: string, isVideo: boolean): Promise<string | null> {
  const lovableKey = normalizeKey(Deno.env.get("LOVABLE_API_KEY"));
  if (!lovableKey) return null;
  const prompt = isVideo
    ? "Descreva detalhadamente o que aparece neste vídeo/frame. Seja objetivo e completo. Se houver texto visível (placas, documentos, comprovantes, etiquetas, nomes de produtos, números, valores, datas), TRANSCREVA-O integralmente."
    : "Descreva detalhadamente o que aparece nesta imagem. Seja objetivo e completo. Se houver texto visível (placas, documentos, comprovantes, etiquetas, nomes de produtos, números, valores, datas), TRANSCREVA-O integralmente.";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: mediaUrl } },
          ],
        }],
      }),
    });
    if (!r.ok) {
      console.error("Lovable AI vision error:", r.status, await r.text());
      return null;
    }
    const j = await r.json();
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("Lovable AI vision throw:", e);
    return null;
  }
}

// ---------- IMAGE / VIDEO via OpenAI (fallback se org tiver key) ----------
async function describeImageWithOpenAI(mediaUrl: string, isVideo: boolean, openaiApiKey: string): Promise<string | null> {
  const prompt = isVideo
    ? "Descreva detalhadamente o que aparece neste vídeo/frame. Seja objetivo e completo. Se houver texto visível, transcreva-o."
    : "Descreva detalhadamente o que aparece nesta imagem. Seja objetivo e completo. Se houver texto visível, transcreva-o.";
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mediaUrl } },
        ]}],
        max_tokens: 500,
      }),
    });
    if (!r.ok) {
      console.error("OpenAI vision error:", r.status, await r.text());
      return null;
    }
    const j = await r.json();
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("OpenAI vision throw:", e);
    return null;
  }
}

// ---------- AUDIO via OpenAI Whisper (única opção; Lovable AI não tem Whisper) ----------
async function transcribeAudio(mediaUrl: string, openaiApiKey: string): Promise<string | null> {
  try {
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    const audioBlob = await audioResponse.blob();
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
    });
    if (!r.ok) {
      console.error("Whisper error:", r.status, await r.text());
      return null;
    }
    const { text } = await r.json();
    return text || null;
  } catch (e) {
    console.error("Audio transcription throw:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message_id, organization_id, media_url, message_type } = await req.json();
    if (!message_id || !organization_id || !media_url || !message_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiApiKey = await resolveOpenAiKey(supabase, organization_id);
    let transcription: string | null = null;
    let provider: string | null = null;

    if (message_type === "audio") {
      if (!openaiApiKey) {
        console.log(`[transcribe-media] msg=${message_id} skip=audio_no_openai_key (Whisper requer OpenAI key da org)`);
        return new Response(JSON.stringify({ skipped: true, reason: "audio_requires_openai_key" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      transcription = await transcribeAudio(media_url, openaiApiKey);
      provider = "openai_whisper";
    } else if (message_type === "image" || message_type === "video") {
      const isVideo = message_type === "video";
      // Prefere OpenAI se a org tiver key (decisão dela), senão fallback automático para Lovable AI.
      if (openaiApiKey) {
        transcription = await describeImageWithOpenAI(media_url, isVideo, openaiApiKey);
        provider = "openai_vision";
      }
      if (!transcription) {
        transcription = await describeImageWithLovableAI(media_url, isVideo);
        provider = transcription ? "lovable_gemini" : provider;
      }
    }

    if (transcription) {
      const { error } = await supabase
        .from("messages")
        .update({ transcription })
        .eq("id", message_id);
      if (error) {
        console.error("Failed to save transcription:", error);
      } else {
        console.log(`[transcribe-media] msg=${message_id} provider=${provider} chars=${transcription.length} ok`);
      }
    } else {
      console.log(`[transcribe-media] msg=${message_id} type=${message_type} no_transcription_produced`);
    }

    return new Response(
      JSON.stringify({ success: true, transcribed: !!transcription, provider, chars: transcription?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("transcribe-media error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
