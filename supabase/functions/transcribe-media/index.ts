import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeKey(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

// ---------- VGVCash: saldo, features e débito ----------
async function getVgvCashBalance(supabase: any, organizationId: string): Promise<number> {
  const { data } = await supabase.from("credit_transactions").select("amount").eq("organization_id", organizationId);
  return (data || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
}

// organization_features é opt-out para estas duas chaves: sem linha = habilitado.
async function isFeatureEnabled(supabase: any, organizationId: string, featureKey: string): Promise<boolean> {
  const { data } = await supabase
    .from("organization_features")
    .select("is_enabled")
    .eq("organization_id", organizationId)
    .eq("feature_key", featureKey)
    .maybeSingle();
  return data ? !!data.is_enabled : true;
}

function debitVgvCash(supabase: any, organizationId: string, amount: number, description: string, metadata: Record<string, unknown>) {
  if (!(amount > 0)) return;
  supabase.from("credit_transactions").insert({
    organization_id: organizationId,
    amount: -amount,
    transaction_type: "debit",
    description,
    metadata,
  }).then(({ error }: any) => {
    if (error) console.error("[transcribe-media] VGVCash debit failed:", error.message);
  });
}

const WHISPER_USD_PER_MINUTE = 0.006;
const VISION_PRICES = { inM: 0.15, outM: 0.60 }; // gpt-4o-mini
const LOVABLE_IMAGE_FLAT_COST_USD = 0.001; // estimativa — Lovable AI gateway não expõe custo por token

async function resolveOpenAiKey(supabase: any, organizationId: string) {
  const [orgRes, legacyRes, platformRes] = await Promise.all([
    supabase.from("organizations").select("openai_api_key").eq("id", organizationId).single(),
    supabase.from("ai_agent_config").select("openai_api_key").eq("organization_id", organizationId).limit(1).maybeSingle(),
    supabase.from("platform_settings").select("openai_api_key").eq("id", true).maybeSingle(),
  ]);
  if (orgRes.error) throw orgRes.error;
  if (legacyRes.error) throw legacyRes.error;
  return (
    normalizeKey(orgRes.data?.openai_api_key) ||
    normalizeKey(legacyRes.data?.openai_api_key) ||
    normalizeKey(platformRes.data?.openai_api_key)
  );
}

interface MediaResult { text: string | null; costUsd: number; }

// ---------- IMAGE / VIDEO via Lovable AI (Gemini) — funciona sem key da org ----------
async function describeImageWithLovableAI(mediaUrl: string, isVideo: boolean): Promise<MediaResult> {
  const lovableKey = normalizeKey(Deno.env.get("LOVABLE_API_KEY"));
  if (!lovableKey) return { text: null, costUsd: 0 };
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
      return { text: null, costUsd: 0 };
    }
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content?.trim() || null;
    return { text, costUsd: text ? LOVABLE_IMAGE_FLAT_COST_USD : 0 };
  } catch (e) {
    console.error("Lovable AI vision throw:", e);
    return { text: null, costUsd: 0 };
  }
}

// ---------- IMAGE / VIDEO via OpenAI (fallback se org tiver key) ----------
async function describeImageWithOpenAI(mediaUrl: string, isVideo: boolean, openaiApiKey: string): Promise<MediaResult> {
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
      return { text: null, costUsd: 0 };
    }
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content?.trim() || null;
    const costUsd = text
      ? ((j.usage?.prompt_tokens ?? 0) * VISION_PRICES.inM + (j.usage?.completion_tokens ?? 0) * VISION_PRICES.outM) / 1_000_000
      : 0;
    return { text, costUsd };
  } catch (e) {
    console.error("OpenAI vision throw:", e);
    return { text: null, costUsd: 0 };
  }
}

// ---------- AUDIO via OpenAI Whisper (única opção; Lovable AI não tem Whisper) ----------
async function transcribeAudio(mediaUrl: string, openaiApiKey: string): Promise<MediaResult> {
  try {
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    const audioBlob = await audioResponse.blob();
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "verbose_json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
    });
    if (!r.ok) {
      console.error("Whisper error:", r.status, await r.text());
      return { text: null, costUsd: 0 };
    }
    const j = await r.json();
    const text = j.text || null;
    const durationSeconds = Number(j.duration) || 0;
    const costUsd = text ? (durationSeconds / 60) * WHISPER_USD_PER_MINUTE : 0;
    return { text, costUsd };
  } catch (e) {
    console.error("Audio transcription throw:", e);
    return { text: null, costUsd: 0 };
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

    // VGVCash: nenhum uso de IA (transcrição ou descrição) roda sem saldo.
    const balance = await getVgvCashBalance(supabase, organization_id);
    if (balance <= 0) {
      console.log(`[transcribe-media] msg=${message_id} skip=insufficient_vgvcash (saldo: ${balance.toFixed(6)})`);
      return new Response(JSON.stringify({ skipped: true, reason: "insufficient_vgvcash" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKey = await resolveOpenAiKey(supabase, organization_id);
    let transcription: string | null = null;
    let provider: string | null = null;
    let costUsd = 0;

    if (message_type === "audio") {
      if (!(await isFeatureEnabled(supabase, organization_id, "ai_transcription"))) {
        console.log(`[transcribe-media] msg=${message_id} skip=transcription_disabled`);
        return new Response(JSON.stringify({ skipped: true, reason: "transcription_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!openaiApiKey) {
        console.log(`[transcribe-media] msg=${message_id} skip=audio_no_openai_key (Whisper requer OpenAI key)`);
        return new Response(JSON.stringify({ skipped: true, reason: "audio_requires_openai_key" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await transcribeAudio(media_url, openaiApiKey);
      transcription = result.text;
      costUsd = result.costUsd;
      provider = "openai_whisper";
    } else if (message_type === "image" || message_type === "video") {
      if (!(await isFeatureEnabled(supabase, organization_id, "ai_image_description"))) {
        console.log(`[transcribe-media] msg=${message_id} skip=image_description_disabled`);
        return new Response(JSON.stringify({ skipped: true, reason: "image_description_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isVideo = message_type === "video";
      // Prefere OpenAI se a org tiver key (decisão dela), senão fallback automático para Lovable AI.
      if (openaiApiKey) {
        const result = await describeImageWithOpenAI(media_url, isVideo, openaiApiKey);
        transcription = result.text;
        costUsd = result.costUsd;
        provider = "openai_vision";
      }
      if (!transcription) {
        const result = await describeImageWithLovableAI(media_url, isVideo);
        transcription = result.text;
        costUsd = result.costUsd;
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
        console.log(`[transcribe-media] msg=${message_id} provider=${provider} chars=${transcription.length} cost=$${costUsd.toFixed(6)} ok`);
      }
      debitVgvCash(supabase, organization_id, costUsd, `${message_type === "audio" ? "Transcrição de áudio" : "Descrição de mídia"} — ${provider}`, {
        provider,
        message_id,
        message_type,
      });
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
