import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

// ⚠️ Mude as variáveis de ambiente para AMPLOPAY
const AMPLOPAY_API_URL = (Deno.env.get("URL_API_AMPLOPAY")?.replace(/\/$/, "")) || "https://app.amplopay.com/api/v1";
const AMPLOPAY_PK = Deno.env.get("AMPLOPAY_PK"); // Sua Public Key
const AMPLOPAY_SK = Deno.env.get("AMPLOPAY_SK"); // Sua Secret Key

if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
  console.warn("⚠️ AMPLOPAY_PK/AMPLOPAY_SK ausentes! Configure as variáveis de ambiente.");
}

// Funções utilitárias (mantidas, pois são boas práticas)

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

// Lógica Principal do Servidor

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // ⚠️ Headers da AmploPay usam 'Authorization' com Bearer token ou X-Public-Key/X-Secret-Key
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
    // ⚠️ Mapeamento de campos:
    // 'identifier' (AmploPay) é 'external_id' ou 'identifier' na requisição original
    // 'callbackUrl' (AmploPay) é 'callback_url'
    const { 
      amount, 
      description, // Não é um campo direto no payload, mas pode ir em 'metadata' 
      customer, 
      identifier, // Seu ID da transação (anteriormente external_id)
      callbackUrl // Sua URL de webhook
    } = body || {};

    // Validação de campos OBRIGATÓRIOS da AmploPay
    if (amount == null || !identifier || !customer?.name || !customer?.document || !callbackUrl) {
      return new Response(JSON.stringify({
        error: "Dados incompletos. Envie amount, identifier, customer{name, document}, callbackUrl."
      }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
    }

    const amountFixed = normalizeAmount(amount);
    const docOnlyDigits = sanitizeDoc(customer.document);
    
    // ⚠️ Construção do payload da AmploPay
    const payload = {
      identifier: String(identifier), // Identificador único da transação
      amount: amountFixed,
      client: { // Os dados do cliente são agrupados em 'client'
        name: String(customer.name),
        document: docOnlyDigits.length ? docOnlyDigits : customer.document,
        ...(customer.email ? { email: String(customer.email) } : {}),
        ...(customer.phone ? { phone: String(customer.phone) } : {}), // 'phone' é comum em PIX
      },
      callbackUrl: String(callbackUrl),
      // ⚠️ Use o campo 'metadata' para incluir a descrição ou outros dados
      metadata: {
        ...(description ? { description: String(description) } : {}),
      },
      // Campos opcionais que você pode adicionar se precisar:
      // shippingFee: 0, 
      // discount: 0,
      // dueDate: "YYYY-MM-DD",
      // products: [] 
    };

    // ⚠️ Endpoint CORRETO da AmploPay
    const res = await postWithRetry(`${AMPLOPAY_API_URL}/gateway/pix/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A documentação sugere X-Public-Key e X-Secret-Key para autenticação
        "X-Public-Key": AMPLOPAY_PK!,
        "X-Secret-Key": AMPLOPAY_SK!,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ error: "Resposta inválida da AmploPay" }), {
        status: 502, headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // ⚠️ A AmploPay retorna status 201 OK no sucesso
    if (res.status !== 201 || json?.status !== "OK") { 
      const msg = json?.errorDescription || json?.message || raw || "Erro na AmploPay";
      const status = res.status || 502;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // ⚠️ Mapeamento de campos de RETORNO da AmploPay
    const d = json || {};
    return new Response(JSON.stringify({
      success: true,
      transactionId: d.transactionId, // ID único da AmploPay
      identifier: d.order?.id, // ID da ordem ou outro identificador de pedido
      qrCode: d.pix?.code, // Pix Copia e Cola
      qrCodeBase64: d.pix?.base64, // Imagem Base64 do QR Code
      qrCodeImage: d.pix?.image, // URL da imagem do QR Code
      amount: d.order?.amount || d.amount,
      status: d.status,
    }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Internal Server Error", message: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...cors }
    });
  }
});
