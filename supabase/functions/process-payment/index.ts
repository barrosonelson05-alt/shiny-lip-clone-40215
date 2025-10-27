import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

// --- 1. CONFIGURAÇÃO EXPFYPAY ---
const EXPFY_API_URL = Deno.env.get('URL_API_EXPFY')?.replace(/\/$/, '') || 'https://expfypay.com/api/v1';
const EXPFY_PK = Deno.env.get('EXPFY_PK');
const EXPFY_SK = Deno.env.get('EXPFY_SK');

if (!EXPFY_PK || !EXPFY_SK) {
  console.warn("⚠️ WARNING: EXPFY_PK ou EXPFY_SK não configuradas!");
}

const EXPFY_PAYMENTS_ENDPOINT = `${EXPFY_API_URL}/payments`;

// --- 2. FUNÇÕES AUXILIARES ---
function formatNumber(value) {
  if (!value) return value;
  return value.replace(/\D/g, '');
}

function isCpfValid(cpf) {
  if (!cpf) return false;
  const cleanedCpf = cpf.replace(/\D/g, '');
  if (cleanedCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanedCpf)) return false;

  let sum = 0, remainder;
  for (let i = 1; i <= 9; i++) sum += parseInt(cleanedCpf[i - 1]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanedCpf[9])) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cleanedCpf[i - 1]) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;

  return remainder === parseInt(cleanedCpf[10]);
}

// --- 3. FUNÇÃO PRINCIPAL ---
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-ID, Content-Type, X-Public-Key, X-Secret-Key',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (!EXPFY_PK || !EXPFY_SK) {
    return new Response(
      JSON.stringify({ error: 'Chaves da ExpFyPay não configuradas.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const data = await req.json();
    const { paymentMethod, amount, customerData, cardToken } = data;

    if (!paymentMethod || !amount || !customerData) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos. Informe método, valor e cliente.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const cleanCpf = formatNumber(customerData.cpf);
    if (!isCpfValid(cleanCpf)) {
      return new Response(
        JSON.stringify({ error: 'CPF inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const baseCustomer = {
      name: customerData.name,
      document: cleanCpf,
      email: customerData.email,
    };

    const amountInReais = parseFloat(amount);
    let expfypayBody = {
      amount: amountInReais,
      description: `Pagamento do Pedido #${customerData.orderId || Date.now()}`,
      customer: baseCustomer,
      external_id: customerData.externalId || `ORDER_${Date.now()}`,
      callback_url: customerData.callbackUrl || 'https://seusite.com.br/webhook',
      split_email: customerData.splitEmail,
      split_percentage: customerData.splitPercentage,
    };

    if (paymentMethod === 'PIX') {
      expfypayBody.payment_method = 'pix';
    } else if (paymentMethod === 'CARD') {
      if (!cardToken) return new Response(
        JSON.stringify({ error: 'Token de cartão ausente.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );

      try {
        const decoded = JSON.parse(atob(cardToken));
        expfypayBody = {
          ...expfypayBody,
          payment_method: 'credit_card',
          card_number: decoded.number,
          card_holder_name: decoded.holderName,
          card_expiration_date: decoded.expiration,
          card_cvv: decoded.cvv,
        };
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Erro ao decodificar token do cartão.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Método de pagamento não suportado.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log("📤 Enviando para ExpFyPay:", expfypayBody);

    const response = await fetch(EXPFY_PAYMENTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Key': EXPFY_PK,
        'X-Secret-Key': EXPFY_SK,
      },
      body: JSON.stringify(expfypayBody),
      // Removido temporariamente para evitar falha de conexão
      // signal: AbortSignal.timeout(15000),
    });

    const result = await response.json();
    console.log("📥 Resposta da ExpFyPay:", result);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result.message || 'Erro na ExpFyPay' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, paymentData: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error("🚨 ERRO:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
