// process-payment/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// URL base da Amplopay (deve ser configurada como variável de ambiente no Lovable Cloud/Supabase)
const AMPLOPAY_BASE_URL = Deno.env.get('AMPLOPAY_BASE_URL');
// Chave secreta da Amplopay (deve ser configurada como variável de ambiente no Lovable Cloud/Supabase)
const AMPLOPAY_SECRET_KEY = Deno.env.get('AMPLOPAY_SECRET_KEY');

// O URL COMPLETO CORRETO para criar a cobrança PIX
const PIX_CHARGE_URL = `${AMPLOPAY_BASE_URL}/pix-charge`;

// Função para formatar o CPF/Telefone removendo caracteres não numéricos
function formatNumber(value: string | undefined): string | undefined {
    if (!value) return value;
    return value.replace(/\D/g, '');
}

serve(async (req: Request) => {
    // 1. Configuração de CORS (necessário para aceitar requisições do seu site)
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
        
        // Log para monitoramento (agora com todos os dados de cliente)
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
            value: amount, // O valor já deve estar em centavos se o front-end seguiu o código anterior.
            customer: {
                name: customerData.name,
                email: customerData.email,
                phone: formatNumber(customerData.phone), // Garante que o número está formatado
                cpf: formatNumber(customerData.cpf),     // Garante que o CPF está formatado
            },
            // Adicione outros campos obrigatórios pela Amplopay, se houver
        };

        // 3. Chamada à API Amplopay (CORREÇÃO DA URL: USANDO PIX_CHARGE_URL)
        const response = await fetch(PIX_CHARGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AMPLOPAY_SECRET_KEY}`, // Usa a chave secreta
            },
            body: JSON.stringify(amplopayBody),
        });

        // 4. Tratamento de resposta CORRIGIDO (Capitura o corpo do erro)
        if (!response.ok) {
            const errorBody = await response.text();
            
            // LOGS CORRIGIDOS: Captura o status e o corpo do erro da Amplopay
            console.error(`Amplopay Pix response status: ${response.status}`);
            console.error(`Amplopay Pix error body: ${errorBody}`);

            // Lança um erro detalhado para ser capturado no try/catch e reportado ao cliente
            throw new Error(`Failed to generate Pix payment (Status: ${response.status}. Details: ${errorBody.substring(0, 100)})`);
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
