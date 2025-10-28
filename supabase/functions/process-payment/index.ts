import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

// --- Configurações Iniciais ---
const AMPLOPAY_API_URL = (Deno.env.get("URL_API_AMPLOPAY")?.replace(/\/$/, "")) || "https://app.amplopay.com/api/v1";
const AMPLOPAY_PK = Deno.env.get("AMPLOPAY_PK");
const AMPLOPAY_SK = Deno.env.get("AMPLOPAY_SK");
const PIX_RECEIVE_ENDPOINT = "/gateway/pix/receive";
const FULL_API_URL = `${AMPLOPAY_API_URL}${PIX_RECEIVE_ENDPOINT}`;

// 🚀 LOG DE DEBUG: URLs de API
console.log(`[DEBUG] API URL Base: ${AMPLOPAY_API_URL}`);
console.log(`[DEBUG] Endpoint Completo: ${FULL_API_URL}`);

if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
    console.warn("⚠️ AMPLOPAY_PK/AMPLOPAY_SK ausentes! Configure as variáveis de ambiente.");
}

// --- Funções Auxiliares ---

/**
 * Normaliza o valor para duas casas decimais, tratando strings com vírgula ou ponto.
 * Retorna um número.
 */
function normalizeAmount(value: string | number): number {
    if (typeof value === "number") return Number(value.toFixed(2));
    const s = String(value).trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error("Valor inválido para amount");
    return Number(n.toFixed(2));
}

/**
 * Remove todos os caracteres não-dígitos do documento (CPF/CNPJ).
 */
function sanitizeDoc(doc?: string) {
    return doc?.replace(/\D/g, "") || "";
}

/**
 * Função que faz a requisição POST com retentativas e tratamento de 429.
 */
async function postWithRetry(url: string, init: RequestInit, maxRetries = 5) {
    let attempt = 0;
    let wait = 500;
    while (true) {
        try {
            const res = await fetch(url, init);
            
            // Se não for 429 (ou se for 429 mas sem mais retentativas), retorna.
            if (res.status !== 429 || attempt >= maxRetries) return res;

        } catch (error: any) {
            // Log de DEBUG para erros de rede/conexão
            console.error(`[ERROR] Falha de conexão na tentativa ${attempt + 1}/${maxRetries} para ${url}`);
            
            if (attempt >= maxRetries) {
                const errorType = error?.constructor?.name || 'NetworkError';
                const errorMsg = error?.message || 'Erro desconhecido';
                throw new Error(`Falha ao conectar à API da AmploPay após ${maxRetries} tentativas. Tipo: ${errorType}, Mensagem: ${errorMsg}`);
            }
        }

        console.log(`[RETRY] Aguardando ${wait}ms antes da próxima tentativa...`);
        await new Promise(r => setTimeout(r, wait));
        wait *= 2;
        attempt++;
    }
}

// --- Servidor Principal ---

serve(async (req) => {
    // ✅ CORREÇÃO CORS: Lista explícita de headers para permitir o 'x-client-info'
    const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", // <--- CORREÇÃO AQUI
        "Vary": "Origin",
    };
    
    // Tratamento de OPTIONS (Preflight do CORS)
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
        return new Response(JSON.stringify({ error: "Chaves da AmploPay não configuradas." }), {
            status: 500, headers: { "Content-Type": "application/json", ...cors }
        });
    }

    // Logs para confirmar leitura das chaves
    console.log(`[DEBUG] PK Lida (Início/Fim): ${AMPLOPAY_PK.substring(0, 5)}...${AMPLOPAY_PK.substring(AMPLOPAY_PK.length - 5)}`);
    console.log(`[DEBUG] SK Lida (Início/Fim): ${AMPLOPAY_SK.substring(0, 5)}...${AMPLOPAY_SK.substring(AMPLOPAY_SK.length - 5)}`);


    try {
        const body = await req.json();
        const {
            amount,
            description,
            customer,
            identifier,
            callbackUrl,
            splits // Adicionado para suportar splits (opcional)
        } = body || {};

        if (amount == null || !identifier || !customer?.name || !customer?.document || !callbackUrl) {
            return new Response(JSON.stringify({
                error: "Dados incompletos. Envie amount, identifier, customer{name, document}, callbackUrl."
            }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }

        const amountFixed = normalizeAmount(amount);
        const docOnlyDigits = sanitizeDoc(customer.document);

        // Montagem do Payload da AmploPay
        const payload: Record<string, any> = {
            identifier: String(identifier),
            amount: amountFixed,
            client: {
                name: String(customer.name),
                document: docOnlyDigits,
                ...(customer.email ? { email: String(customer.email) } : {}),
                ...(customer.phone ? { phone: String(customer.phone) } : {}),
            },
            callbackUrl: String(callbackUrl),
            metadata: {
                ...(description ? { description: String(description) } : {}),
            },
        };

        // Adiciona splits se estiver presente no body (opcional)
        if (splits) {
            payload.splits = splits;
        }

        console.log("[DEBUG] Payload sendo enviado:", JSON.stringify(payload, null, 2));

        const res = await postWithRetry(FULL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Public-Key": AMPLOPAY_PK!,
                "X-Secret-Key": AMPLOPAY_SK!,
            },
            body: JSON.stringify(payload),
        });

        // Tratamento de Erro de Autenticação/IP (401/403)
        if (res.status === 401 || res.status === 403) {
            console.error(`[ERROR] Acesso Negado (Status ${res.status}). Chaves inválidas ou IP bloqueado.`);
            const rawError = await res.text();
            return new Response(JSON.stringify({
                error: `Acesso Negado (HTTP ${res.status}). Verifique se a Chave Secreta (AMPLOPAY_SK) está completa e se o IP do seu servidor está liberado na AmploPay.`,
                details: rawError.includes('<html>') ? 'Resposta HTML de Bloqueio. Checar IP/Firewall.' : rawError
            }), { status: res.status, headers: { "Content-Type": "application/json", ...cors } });
        }
        
        const raw = await res.text();
        let json: any;
        try { json = JSON.parse(raw); } catch {
            // Log para respostas não-JSON
            console.error("[ERROR] Resposta inválida da AmploPay (Não-JSON):", raw);
            return new Response(JSON.stringify({ error: "Resposta inválida da AmploPay" }), {
                status: 502, headers: { "Content-Type": "application/json", ...cors }
            });
        }

        console.log("[DEBUG] Status Recebido:", res.status);
        console.log("[DEBUG] JSON Recebido:", json);

        // Checa o status HTTP (espera 201) e o status do corpo JSON (se houver)
        if (res.status !== 201 || json?.status !== "OK") {
            const msg = json?.errorDescription || json?.message || raw || "Erro na AmploPay";
            const status = res.status || 502;
            return new Response(JSON.stringify({ error: msg }), {
                status, headers: { "Content-Type": "application/json", ...cors }
            });
        }

        // Resposta de Sucesso (200 OK para o Cliente)
        const d = json || {};
        return new Response(JSON.stringify({ // <--- CORREÇÃO DO BUG AQUI
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
        console.error("[ERROR] Erro no Servidor (Interno):", e);
        return new Response(JSON.stringify({ error: "Internal Server Error", message: String(e?.message || e) }), {
            status: 500, headers: { "Content-Type": "application/json", ...cors }
        });
    }
});
