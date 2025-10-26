// process-payment/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Variável de ambiente necessária (Chave Secreta da Amplopay)
const AMPLOPAY_SECRET_KEY = Deno.env.get('AMPLOPAY_SECRET_KEY');

// URLs de integração (Hardcoded para eliminação de erro de variável de ambiente BASE_URL)
const PIX_CHARGE_URL = 'https://api.amplopay.com/v1/payments/pix-charge';
const CARD_CHARGE_URL = 'https://api.amplopay.com/v1/payments/card-charge'; 

// Função para formatar o CPF/Telefone removendo caracteres não numéricos
function formatNumber(value: string | undefined): string | undefined {
    if (!value) return value;
    return value.replace(/\D/g, '');
}

serve(async (req: Request) => {
    // 1. Configuração de CORS (Obrigatório para requisições OPTIONS)
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
        
        // Destruturação: Pega os dados do método, valor, cliente, e (opcionalmente) cartão
        const { paymentMethod, amount, customerData, cardData } = data; 

        let chargeUrl = '';
        let amplopayBody = {};

        // === LÓGICA DE CARTÃO DE CRÉDITO ===
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
                    cpf: formatNumber(customerData.cpf),
                },
                // ATENÇÃO: Confirme que estes nomes de campos (card_holder, card_number, etc.) 
                // são os que a Amplopay espera na documentação de Cartão de Crédito.
                card_holder: cardData.holderName, 
                card_number: cardData.number, 
                card_expiration_month: cardData.month, 
                card_expiration_year: cardData.year, 
                card_cvv: cardData.cvv, 
                installments: cardData.installments || 1 // Padrão 1x se não especificado
            };
            
        // === LÓGICA DE PIX ===
        } else if (paymentMethod === 'PIX') {
            chargeUrl = PIX_CHARGE_URL;
            amplopayBody = {
                value: amount,
                customer: {
                    name: customerData.name,
                    email: customerData.email,
                    phone: formatNumber(customerData.phone),
                    cpf: formatNumber(customerData.cpf),
                },
            };
            
        } else {
            // Se o paymentMethod não for PIX nem CARD
            return new Response(JSON.stringify({ error: 'Unsupported payment method' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }
        
        // 3. Chamada à API Amplopay (USANDO A URL DETERMINADA ACIMA)
        const response = await fetch(chargeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AMPLOPAY_SECRET_KEY}`,
                // Headers para evitar o bloqueio de firewall/servidor (tentativa de resolver o 405)
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
