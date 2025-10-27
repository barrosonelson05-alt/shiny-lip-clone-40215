// --- 1. CONFIGURAÇÃO EXPFYPAY ---

const EXPFY_API_URL_SECRET = Deno.env.get('URL_API_EXPFY');
const EXPFY_PK = Deno.env.get('EXPFY_PK');
const EXPFY_SK = Deno.env.get('EXPFY_SK');

const FALLBACK_BASE_URL = 'https://api.expfypay.com/api/v1'; // URL oficial de produção

const resolvedBaseUrl =
  (EXPFY_API_URL_SECRET && EXPFY_API_URL_SECRET.startsWith('http'))
    ? EXPFY_API_URL_SECRET.replace(/\/$/, '')
    : FALLBACK_BASE_URL;

// Endpoint correto de pagamento
const EXPFY_PAYMENTS_ENDPOINT = `${resolvedBaseUrl}/payments`;

if (resolvedBaseUrl === FALLBACK_BASE_URL) {
  console.warn(`⚠️ WARNING: URL_API_EXPFY não definida. Usando fallback: ${FALLBACK_BASE_URL}`);
}

// --- 2. FUNÇÕES AUXILIARES ---

function formatNumber(value) {
  if (!value) return value;
  return value.replace(/\D/g, '');
}

function isCpfValid(cpf) {
  if (!cpf) return false;
  const cleanedCpf = cpf.replace(/[^\d]/g, '');
  if (cleanedCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanedCpf)) return false;

  let sum = 0, remainder;

  for (let i = 1; i <= 9; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cleanedCpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  return remainder === parseInt(cleanedCpf.substring(10, 11));
}

// --- 3. FUNÇÃO PRINCIPAL ---

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-ID, Content-Type, X-Public-Key, X-Secret-Key',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!EXPFY_PK || !EXPFY_SK) {
    return new Response(
      JSON.stringify({ error: 'Chaves da ExpFyPay não configuradas. Verifique EXPFY_PK e EXPFY_SK.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const data = await req.json();
    console.log("🔹 Dados recebidos do front:", data);

    const { paymentMethod, amount, customerData, cardToken } = data;

    if (!paymentMethod || !amount || !customerData) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos. Informe método, valor e cliente.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const cleanCpf = formatNumber(customerData.cpf);
    if (!isCpfValid(cleanCpf || "")) {
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

    let expfypayBody;
    let finalEndpoint = EXPFY_PAYMENTS_ENDPOINT;
    const amountInReais = parseFloat(amount);

    if (paymentMethod === 'PIX') {
      expfypayBody = {
        amount: amountInReais,
        description: 'Pedido - Pagamento via PIX',
        customer: baseCustomer,
        external_id: `ORDER_PIX_${Date.now()}`,
        payment_method: 'pix',
      };
    } else if (paymentMethod === 'CARD') {
      if (!cardToken) {
        return new Response(
          JSON.stringify({ error: 'Token de cartão ausente.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      let cardDetails = {};
      try {
        const decoded = JSON.parse(atob(cardToken));
        cardDetails = {
          card_number: decoded.number,
          card_holder_name: decoded.holderName,
          card_expiration_date: decoded.expiration,
          card_cvv: decoded.cvv,
        };
      } catch (e) {
        console.error("Erro ao decodificar cardToken:", e);
      }

      expfypayBody = {
        amount: amountInReais,
        description: 'Pedido - Pagamento via Cartão',
        customer: baseCustomer,
        external_id: `ORDER_CARD_${Date.now()}`,
        payment_method: 'credit_card',
        ...cardDetails,
      };
    } else {
      return new Response(JSON.stringify({ error: 'Método de pagamento não suportado.' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log("📦 Corpo da requisição ExpFyPay:", expfypayBody);

    const response = await fetch(finalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Key': EXPFY_PK,
        'X-Secret-Key': EXPFY_SK,
        'Accept': 'application/json',
      },
      body: JSON.stringify(expfypayBody),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ExpFyPay erro (${response.status}):`, errorText);

      let errorMessage = `Erro ExpFyPay (Status: ${response.status}).`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText.substring(0, 150) || errorMessage;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const paymentData = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        paymentData,
        method: paymentMethod,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    let errorMessage = 'Erro desconhecido ao processar pagamento.';

    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name === 'TimeoutError') {
        errorMessage = 'A requisição para a ExpFyPay expirou. Tente novamente.';
      }
    }

    console.error("🚨 ERRO CRÍTICO:", errorMessage);

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: `Erro na função: ${errorMessage}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
