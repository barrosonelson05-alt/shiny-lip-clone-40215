// process-payment/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Variáveis de ambiente (mantemos apenas a chave secreta)
const AMPLOPAY_SECRET_KEY = Deno.env.get('AMPLOPAY_SECRET_KEY');

// O URL COMPLETO CORRETO para criar a cobrança PIX, HARDCODED para teste!
// Se sua variável de ambiente estava errada, isso deve resolver.
const PIX_CHARGE_URL = 'https://api.amplopay.com/v1/payments/pix-charge';

// Função para formatar o CPF/Telefone removendo caracteres não numéricos
function formatNumber(value: string | undefined): string | undefined {
    if (!value) return value;
    return value.replace(/\D/g, '');
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
        
        const { paymentMethod, amount, customerData } = data;

        if (paymentMethod !== 'PIX') {
            return new Response(JSON.stringify({ error: 'Unsupported payment method' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        // 2. Preparação dos dados para a Amplopay
        const amplopayBody = {
            value: amount, // Valor
            customer: {
                name: customerData.name,
                email: customerData.email,
                phone: formatNumber(customerData.phone),
                cpf: formatNumber(customerData.cpf),
            },
        };

        // 3. Chamada à API Amplopay (Usando URL hardcoded e headers robustos)
        const response = await fetch(PIX_CHARGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AMPLOPAY_SECRET_KEY}`,
                // Headers para tentar evitar o bloqueio de firewall/servidor
                'User-Agent': 'Deno/1.x (Supabase Edge Function)',
                'Accept': 'application/json',
            },
            body: JSON.stringify(amplopayBody),
        });

        // 4. Tratamento de resposta
        if (!response.ok) {
            const errorBody = await response.text();
            
            // Log do erro da Amplopay
            console.error(`Amplopay Pix response status: ${response.status}`);
            console.error(`Amplopay Pix error body: ${errorBody}`);

            // Lança um erro detalhado (para o try/catch)
            const errorDetail = errorBody.substring(0, 100);
            throw new Error(`Failed to generate Pix payment (Status: ${response.status}. Details: ${errorDetail})`);
        }

        // 5. Se a resposta for OK (Status 200)
        const pixData = await response.json();

        // 6. Retorna o QR Code e outros dados do PIX
        return new Response(
            JSON.stringify({
                success: true,
                pix: pixData,
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
                message: 'Failed to process payment. Check server logs for details.' 
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            }
        );
    }
});
