// process-payment/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Variável de ambiente necessária (Chave Secreta da Amplopay)
const AMPLOPAY_SECRET_KEY = Deno.env.get('AMPLOPAY_SECRET_KEY');

// URLs de integração (Hardcoded)
const PIX_CHARGE_URL = 'https://api.amplopay.com/v1/payments/pix-charge';
const CARD_CHARGE_URL = 'https://api.amplopay.com/v1/payments/card-charge'; 

// Função para formatar o CPF/Telefone removendo caracteres não numéricos
function formatNumber(value: string | undefined): string | undefined {
    if (!value) return value;
    return value.replace(/\D/g, '');
}

/**
 * Função que valida a estrutura matemática de um CPF (sem consultar a Receita).
 * @param cpf CPF em formato de string (apenas dígitos).
 * @returns true se o CPF for matematicamente válido, false caso contrário.
 */
function isCpfValid(cpf: string): boolean {
    if (!cpf) return false;

    // 1. Remove caracteres não numéricos e verifica o tamanho
    const cleanedCpf = cpf.replace(/[^\d]/g, '');
    if (cleanedCpf.length !== 11) return false;

    // 2. Impede sequências repetidas (sabidamente inválidos pela Receita Federal)
    if (/^(\d)\1{10}$/.test(cleanedCpf)) return false;

    let sum = 0;
    let remainder;

    // 3. Validação do Primeiro Dígito Verificador (DV1)
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(9, 10))) return false;

    sum = 0;

    // 4. Validação do Segundo Dígito Verificador (DV2)
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(10, 11))) return false;

    return true;
}

serve(async (req: Request) => {
    // 1. Configuração de CORS 
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, X-Client-ID, Content-Type',
            },
        });
    }

    try {
        const data = await req.json();
        
        console.log("Processing payment:", data);
        
        const { paymentMethod, amount, customerData, cardData } = data; 
        
        // --- VALIDAÇÃO DO CPF (APLICADA ANTES DE CHAMAR A API EXTERNA) ---
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

        let chargeUrl = '';
        let amplopayBody = {};

        // === LÓGICA DE PAGAMENTO ===
        if (paymentMethod === 'CARD') {
            
            // Validação mínima dos dados do cartão
            if (!cardData || !cardData.number || !cardData.cvv || !cardData.month || !cardData.year) {
                 throw new Error("Missing or incomplete credit card information.");
            }
            
            chargeUrl = CARD_CHARGE_URL;
            amplopayBody = {
                value: amount, 
                customer: {
                    name: customerData.name,
                    email: customerData.email,
                    phone: formatNumber(customerData.phone),
                    cpf: cleanCpf, // Usando o CPF limpo e validado
                },
                // ATENÇÃO: Confirme os nomes dos campos na documentação da Amplopay!
                card_holder: cardData.holderName, 
                card_number: cardData.number, 
                card_expiration_month: cardData.month, 
                card_expiration_year: cardData.year, 
                card_cvv: cardData.cvv, 
                installments: cardData.installments || 1 
            };
            
        } else if (paymentMethod === 'PIX') {
            chargeUrl = PIX_CHARGE_URL;
            amplopayBody = {
                value: amount,
                customer: {
                    name: customerData.name,
                    email: customerData.email,
                    phone: formatNumber(customerData.phone),
                    cpf: cleanCpf, // Usando o CPF limpo e validado
                },
            };
            
        } else {
            return new Response(JSON.stringify({ error: 'Unsupported payment method' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        
        // 3. Chamada à API Amplopay
        const response = await fetch(chargeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AMPLOPAY_SECRET_KEY}`,
                // Tentativa de evitar o bloqueio 405
                'User-Agent': 'Deno/1.x (Supabase Edge Function)',
                'Accept': 'application/json',
            },
            body: JSON.stringify(amplopayBody),
        });

        // 4. Tratamento de resposta
        if (!response.ok) {
            const errorBody = await response.text();
            
            console.error(`Amplopay response status: ${response.status}`);
            console.error(`Amplopay error body: ${errorBody}`);

            const errorDetail = errorBody.substring(0, 100);
            throw new Error(`Failed to generate payment (Status: ${response.status}. Details: ${errorDetail})`);
        }

        // 5. Se a resposta for OK (Status 200)
        const paymentData = await response.json();

        // 6. Retorna a resposta ao Front-end
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
