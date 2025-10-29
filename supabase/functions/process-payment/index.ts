import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

// --- Configurações Iniciais ---
const AMPLOPAY_API_URL = (Deno.env.get("URL_API_AMPLOPAY")?.replace(/\/$/, "")) || "https://app.amplopay.com/api/v1";
const AMPLOPAY_PK = Deno.env.get("AMPLOPAY_PK");
const AMPLOPAY_SK = Deno.env.get("AMPLOPAY_SK");
const PIX_RECEIVE_ENDPOINT = "/gateway/pix/receive";
const FULL_API_URL = `${AMPLOPAY_API_URL}${PIX_RECEIVE_ENDPOINT}`;

// 🟢 VARIÁVEL DE AMBIENTE PARA MODO DE TESTE/SIMULAÇÃO
const IS_TEST_MODE = Deno.env.get("IS_TEST_MODE") === "true"; 

// 🚀 LOG DE DEBUG: URLs de API
console.log(`[DEBUG] API URL Base: ${AMPLOPAY_API_URL}`);
console.log(`[DEBUG] Endpoint Completo: ${FULL_API_URL}`);

if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
    console.warn("⚠️ AMPLOPAY_PK/AMPLOPAY_SK ausentes! Configure as variáveis de ambiente.");
}

// --- Funções Auxiliares (mantidas originais) ---
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

/**
 * Função postWithRetry: Mantida no código, mas será IGNORADA no modo de teste.
 * É importante mantê-la para quando o modo de teste for desativado.
 */
async function postWithRetry(url: string, init: RequestInit, maxRetries = 5) {
    let attempt = 0;
    let wait = 500;
    while (true) {
        try {
            const res = await fetch(url, init);
            if (res.status !== 429 || attempt >= maxRetries) return res;

        } catch (error: any) {
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
    // CORS e OPTIONS (mantidos originais)
    const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
    
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
        const body = await req.json();
        const {
            amount,
            identifier,
        } = body || {};

        if (amount == null || !identifier) {
            return new Response(JSON.stringify({
                error: "Dados incompletos. 'amount' e 'identifier' são obrigatórios."
            }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }

        const amountFixed = normalizeAmount(amount);

        // =================================================================
        // 🧪 SIMULAÇÃO DE SUCESSO DE PIX (SE IS_TEST_MODE = 'true')
        // =================================================================
        if (IS_TEST_MODE) {
            console.warn("[TEST MODE] 🛑 IGNORANDO CHAMADA À AMPLOPAY. SIMULANDO SUCESSO PIX.");

            // Base64 de uma imagem placeholder (1x1 pixel) para simular o QR Code
            const mockQrCodeBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 

            const mockResponse = {
                success: true,
                transactionId: `MOCK-TXN-${Date.now()}`,
                identifier: String(identifier),
                qrCode: "00020126330014BR.GOV.BCB.PIX011112345678902520400005303986540510.005802BR5913CLIENTE TESTE6009SAO PAULO62070503***630467D2", // Código Copia e Cola Fictício
                qrCodeBase64: `data:image/png;base64,${mockQrCodeBase64}`,
                qrCodeImage: `data:image/png;base64,${mockQrCodeBase64}`,
                amount: amountFixed,
                status: "PENDING", // Status de Pix pendente
            };

            return new Response(JSON.stringify(mockResponse), { 
                status: 200, 
                headers: { "Content-Type": "application/json", ...cors } 
            });
        }
        // =================================================================
        // ❌ FIM DA SIMULAÇÃO
        // =================================================================


        // --- CÓDIGO DE EXECUÇÃO REAL (abaixo, mantido original) ---
        if (!AMPLOPAY_PK || !AMPLOPAY_SK) {
            return new Response(JSON.stringify({ error: "Chaves da AmploPay não configuradas." }), {
                status: 500, headers: { "Content-Type": "application/json", ...cors }
            });
        }

        // ... O resto da lógica de montagem de payload e chamada postWithRetry original continua aqui ...
        
        const { description, customer, callbackUrl, splits } = body || {};

        const docOnlyDigits = sanitizeDoc(customer.document);

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
            console.error("[ERROR] Resposta inválida da AmploPay (Não-JSON):", raw);
            return new Response(JSON.stringify({ error: "Resposta inválida da AmploPay" }), {
                status: 502, headers: { "Content-Type": "application/json", ...cors }
            });
        }

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
        console.error("[ERROR] Erro no Servidor (Interno):", e);
        return new Response(JSON.stringify({ error: "Internal Server Error", message: String(e?.message || e) }), {
            status: 500, headers: { "Content-Type": "application/json", ...cors }
        });
    }
});
