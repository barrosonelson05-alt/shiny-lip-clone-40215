// process-payment/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// --- 1. CONFIGURAÇÃO EXPFYPAY ---

// Variáveis de ambiente da ExpfyPay (Devem ser configuradas no painel do Supabase)
const EXPFY_API_URL = Deno.env.get('EXPFY_API_URL') || 'https://expfypay.com/api/v1';
const EXPFY_PK = Deno.env.get('EXPFY_PK'); // Chave Pública (pk_...)
const EXPFY_SK = Deno.env.get('EXPFY_SK'); // Chave Secreta (sk_...)

// Endpoint de criação de PIX da ExpfyPay
const EXPFY_PIX_ENDPOINT = `${EXPFY_API_URL}/pix`; 

if (!EXPFY_PK || !EXPFY_SK) {
    console.error("ERRO: As chaves EXPFY_PK e EXPFY_SK não estão configuradas nas Secrets do Supabase.");
}

// --- 2. FUNÇÕES AUXILIARES ---

// Função para formatar o CPF/Telefone removendo caracteres não numéricos
function formatNumber(value: string | undefined): string | undefined {
    if (!value) return value;
    return value.replace(/\D/g, '');
}

/**
 * Função que valida a estrutura matemática de um CPF.
 */
function isCpfValid(cpf: string): boolean {
    if (!cpf) return false;

    // Remove caracteres não numéricos e verifica o tamanho
    const cleanedCpf = cpf.replace(/[^\d]/g, '');
    if (cleanedCpf.length !== 11) return false;

    // Impede sequências repetidas
    if (/^(\d)\1{10}$/.test(cleanedCpf)) return false;

    let sum = 0;
    let remainder;

    // Validação do Primeiro Dígito Verificador (DV1)
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(9, 10))) return false;

    sum = 0;

    // Validação do Segundo Dígito Verificador (DV2)
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(10, 11))) return false;

    return true;
}


// --- 3. FUNÇÃO PRINCIPAL (HANDLER) ---

serve(async (req: Request) => {
    // 1. Configuração de CORS (Essencial para Edge Functions)
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, X-Client-ID, Content-Type',
            },
        });
    }

    // Validação inicial das chaves
    if (!EXPFY_PK || !EXPFY_SK) {
        return new Response(JSON.stringify({ error: 'Configuração de API inválida. Chaves da ExpfyPay não encontradas.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    try {
        const data = await req.json();
        
        console.log("Processando pagamento ExpfyPay:", data);
        
        const { paymentMethod, amount, customerData } = data;

        // --- VALIDAÇÃO DO CPF ---
        const cleanCpf = formatNumber(customerData.cpf);
        if (!isCpfValid(cleanCpf || "")) {
            return new Response(
                JSON.stringify({ 
                    error: 'Bad Request', 
                    message: 'O CPF fornecido é inválido. Por favor, verifique o número.' 
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                }
            );
        }
        // -----------------------------

        // === LÓGICA DE PAGAMENTO PIX ===
        if (paymentMethod === 'PIX') {
            
            // Assume-se que o valor deve ser em CENTAVOS (padrão de API)
            const amountInCents = Math.round(amount * 100); 

            const expfypayBody = {
                amount: amountInCents,
                customer: {
                    name: customerData.name,
                    email: customerData.email,
                    phone: formatNumber(customerData.phone),
                    document: cleanCpf, // CPF limpo e validado
                },
                reference_id: `SUPABASE_ORDER_${Date.now()}`, 
            };
            
            console.log("ExpfyPay Request Body:", JSON.stringify(expfypayBody));
            
            // 4. Chamada à API ExpfyPay
            const response = await fetch(EXPFY_PIX_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // HEADERS CONFIRMADOS PELA DOCUMENTAÇÃO!
                    'X-Public-Key': EXPFY_PK, 
                    'X-Secret-Key': EXPFY_SK, 
                    'User-Agent': 'Deno/1.x (Supabase Edge Function)',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(expfypayBody),
            });

            // 5. Tratamento de resposta
            if (!response.ok) {
                const errorBody = await response.text();
                
                console.error(`ExpfyPay response status: ${response.status}`);
                console.error(`ExpfyPay error body: ${errorBody}`);

                // Joga o erro para o catch, que retornará o status 500 ao cliente
                const errorDetail = errorBody.substring(0, 150); 
                throw new Error(`Falha ao gerar pagamento ExpfyPay (Status: ${response.status}). Detalhes: ${errorDetail}`);
            }

            // 6. Se a resposta for OK (Status 200)
            const paymentData = await response.json();

            // 7. Retorna os dados do PIX (QR Code, Pix Copia e Cola) ao Front-end
            return new Response(
                JSON.stringify({
                    success: true,
                    paymentData: paymentData,
                    method: paymentMethod 
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                }
            );
            
        } else {
            // Se tentar usar outro método sem PIX
            return new Response(JSON.stringify({ error: 'Unsupported payment method' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

    } catch (error) {
        console.error("Payment processing error:", error.message);

        // Retorna uma resposta de erro genérica ao front-end
        return new Response(
            JSON.stringify({ 
                error: 'Internal Server Error', 
                message: error.message 
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            }
        );
    }
});
