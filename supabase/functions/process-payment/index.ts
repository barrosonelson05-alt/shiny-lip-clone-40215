import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

const EXPFY_API_URL = (Deno.env.get("URL_API_EXPFY")?.replace(/\/$/, "")) || "https://expfypay.com/api/v1";
const EXPFY_PK = Deno.env.get("EXPFY_PK");
const EXPFY_SK = Deno.env.get("EXPFY_SK");

if (!EXPFY_PK || !EXPFY_SK) {
  console.warn("⚠️ EXPFY_PK/EXPFY_SK ausentes!");
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
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt >= maxRetries) return res;
    await new Promise(r => setTimeout(r, wait));
    wait *= 2;
    attempt++;
  }
}

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, X-Client-ID, Content-Type, X-Public-Key, X-Secret-Key",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (!EXPFY_PK || !EXPFY_SK) {
    return new Response(JSON.stringify({ error: "Chaves da ExpFyPay não configuradas." }), {
      status: 500, headers: { "Content-Type": "application/json", ...cors }
    });
  }

  try {
    const body = await req.json();
    const { amount, description, customer, external_id, callback_url } = body || {};

    if (amount == null || !description || !customer?.name || !customer?.document || !callback_url) {
      return new Response(JSON.stringify({
        error: "Dados incompletos. Envie amount, description, customer{name, document}, callback_url."
      }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
    }

    const amountFixed = normalizeAmount(amount);
    const docOnlyDigits = sanitizeDoc(customer.document);
    const payload = {
      amount: amountFixed,
      description: String(description),
      customer: {
        name: String(customer.name),
        document: docOnlyDigits.length ? docOnlyDigits : customer.document,
        ...(customer.email ? { email: String(customer.email) } : {}),
      },
      ...(external_id ? { external_id: String(external_id) } : {}),
      callback_url: String(callback_url),
    };

    const res = await postWithRetry(`${EXPFY_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Public-Key": EXPFY_PK!,
        "X-Secret-Key": EXPFY_SK!,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ error: "Resposta inválida da ExpFyPay" }), {
        status: 502, headers: { "Content-Type": "application/json", ...cors }
      });
    }

    if (!res.ok || json?.success !== true) {
      const msg = json?.message || json?.error || raw || "Erro na ExpFyPay";
      const status = res.status || 502;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { "Content-Type": "application/json", ...cors }
      });
    }

    const d = json.data || {};
    return new Response(JSON.stringify({
      success: true,
      transactionId: d.transaction_id,
      externalId: d.external_id,
      qrCode: d.qr_code,
      qrCodeImage: d.qr_code_image,
      amount: d.amount,
      status: d.status,
    }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Internal Server Error", message: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...cors }
    });
  }
});
