import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

// ⚠️ Mantendo a URL padrão e a lógica de ambiente
const AMPLOPAY_API_URL = (Deno.env.get("URL_API_AMPLOPAY")?.replace(/\/$/, "")) || "https://app.amplopay.com/api/v1";
const AMPLOPAY_PK = Deno.env.get("AMPLOPAY_PK");
const AMPLOPAY_SK = Deno.env.get("AMPLOPAY_SK");
const PIX_RECEIVE_ENDPOINT = "/gateway/pix/receive";
const FULL_API_URL = `${AMPLOPAY_API_URL}${PIX_RECEIVE_ENDPOINT}`;

// 🚀 LOG DE DEBUG: Verifique qual URL de API está sendo usada
console.log(`[DEBUG] API URL Base: ${AMPLOPAY_API_URL}`);
console.log(`[DEBUG] Endpoint Completo: ${FULL_API_URL}`);


if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
  console.warn("⚠️ AMPLOPAY_PK/AMPLOPAY_SK ausentes! Configure as variáveis de ambiente.");
}

function normalizeAmount(value: string | number): number {
  if (typeof value === "number") return Number(value.toFixed(2));
  const s = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error("Valor inválido para amount");
  return Number(n.toFixed(2));
}

function sanitizeDoc(doc?: string) {
  return doc?.replace(/\D/g, "") || "";
}

async function postWithRetry(url: string, init: RequestInit, maxRetries = 3) {
  let attempt = 0;
  let wait = 300;
  while (true) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 || attempt >= maxRetries) return res;
    } catch (error) {
       // 🚀 LOG DE DEBUG: Captura erros de rede/conexão
       console.error(`[ERROR] Falha de conexão na tentativa ${attempt + 1} para ${url}:`, error);
       if (attempt >= maxRetries) throw new Error("Falha ao se conectar à API da AmploPay após várias tentativas.");
    }
    
    await new Promise(r => setTimeout(r, wait));
    wait *= 2;
    attempt++;
  }
}

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Public-Key, X-Secret-Key",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
    return new Response(JSON.stringify({ error: "Chaves da AmploPay não configuradas." }), {
      status: 500, headers: { "Content-Type": "application/json", ...cors }
    });
  }

  try {
    const body = await req.json();
    const { 
      amount, 
      description,
      customer, 
      identifier, 
      callbackUrl
    } = body || {};

    if (amount == null || !identifier || !customer?.name || !customer?.document || !callbackUrl) {
      return new Response(JSON.stringify({
        error: "Dados incompletos. Envie amount, identifier, customer{name, document}, callbackUrl."
      }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
    }

    const amountFixed = normalizeAmount(amount);
    const docOnlyDigits = sanitizeDoc(customer.document);
    
    const payload = {
      identifier: String(identifier),
      amount: amountFixed,
      client: {
        name: String(customer.name),
        document: docOnlyDigits.length ? docOnlyDigits : customer.document,
        ...(customer.email ? { email: String(customer.email) } : {}),
        ...(customer.phone ? { phone: String(customer.phone) } : {}),
      },
      callbackUrl: String(callbackUrl),
      metadata: {
        ...(description ? { description: String(description) } : {}),
      },
    };

    // 🚀 LOG DE DEBUG: Mostra o payload exato antes de enviar
    console.log("[DEBUG] Payload sendo enviado:", JSON.stringify(payload, null, 2));

    const res = await postWithRetry(FULL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Chaves agora são lidas corretamente
        "X-Public-Key": AMPLOPAY_PK!,
        "X-Secret-Key": AMPLOPAY_SK!,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      // 🚀 LOG DE DEBUG: Resposta inválida
      console.error("[ERROR] Resposta inválida da AmploPay:", raw);
      return new Response(JSON.stringify({ error: "Resposta inválida da AmploPay" }), {
        status: 502, headers: { "Content-Type": "application/json", ...cors }
      });
    }
    
    // 🚀 LOG DE DEBUG: Resposta recebida
    console.log("[DEBUG] Status Recebido:", res.status);
    console.log("[DEBUG] JSON Recebido:", json);


    if (res.status !== 201 || json?.status !== "OK") { 
      const msg = json?.errorDescription || json?.message || raw || "Erro na AmploPay";
      const status = res.status || 502;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { "Content-Type": "application/json", ...cors }
      });
    }

    const d = json || {};
    return new Response(JSON.stringify({
      success: true,
      transactionId: d.transactionId,
      identifier: d.order?.id,
      qrCode: d.pix?.code,
      qrCodeBase64: d.pix?.base64,
      qrCodeImage: d.pix?.image,
      amount: d.order?.amount || d.amount,
      status: d.status,
    }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });

  } catch (e: any) {
    console.error("[ERROR] Erro no Servidor:", e); // 🚀 LOG DE DEBUG: Erro interno
    return new Response(JSON.stringify({ error: "Internal Server Error", message: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...cors }
    });
  }
});
