import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Dipanggil dari browser via supabase.functions.invoke("ai-proxy", { body: { prompt } }).
// verify_jwt = true (supabase/config.toml) → hanya pengguna yang sudah login yang bisa memakai.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { prompt } = await req.json();
    if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 6000) {
      return json({ error: "Prompt tidak valid" }, 400);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    return json(data, response.ok ? 200 : 502);
  } catch (_err) {
    // jangan membocorkan detail error internal ke klien
    return json({ error: "Layanan AI sedang bermasalah" }, 500);
  }
});
