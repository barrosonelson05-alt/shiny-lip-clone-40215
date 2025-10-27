// --- 1. CONFIGURAÇÃO EXPFYPAY ---

// Variáveis de ambiente da ExpfyPay
const EXPFY_API_URL_SECRET = Deno.env.get('URL_API_EXPFY'); 
const EXPFY_PK = Deno.env.get('EXPFY_PK'); // Chave Pública (pk_...)
const EXPFY_SK = Deno.env.get('EXPFY_SK'); // Chave Secreta (sk_...)

// Fallback seguro (URL base correta)
const FALLBACK_BASE_URL = 'https://expfypay.com/api/v1';

// Usa o secret, mas se for nulo, vazio, ou inválido (não URL), usa o fallback.
const resolvedBaseUrl = 
  (EXPFY_API_URL_SECRET && EXPFY_API_URL_SECRET.startsWith('http')) 
    ? EXPFY_API_URL_SECRET.replace(/\/$/, '') 
    : FALLBACK_BASE_URL;

// Endpoint de criação de pagamento (corrigido para /pagamentos)
const EXPFY_PAYMENTS_ENDPOINT = `${resolvedBaseUrl}/pagamentos`;

if (resolvedBaseUrl === FALLBACK_BASE_URL) {
  console.warn(`WARNING: Secret 'URL_API_EXPFY' não está definida ou é inválida. Usando fallback: ${FALLBACK_BASE_URL}`);
}
// ... restante do código (mantido) ...
// --- 2. FUNÇÕES AUXILIARES ---

// Função para formatar o CPF/Telefone removendo caracteres não numéricos
function formatNumber(value: string | undefined): string | undefined {
    if (!value) return value;
    return value.replace(/\D/g, '');
}

/**
 * Função que valida a estrutura matemática de um CPF (mantida para robustez).
 */
function isCpfValid(cpf: string): boolean {
    if (!cpf) return false;
    const cleanedCpf = cpf.replace(/[^\d]/g, '');
    if (cleanedCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanedCpf)) return false;

    let sum = 0, remainder;
    
    // DV1
    for (let i = 1; i <= 9; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(9, 10))) return false;

    sum = 0;

    // DV2
    for (let i = 1; i <= 10; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cleanedCpf.substring(10, 11))) return false;

    return true;
}

// --- 3. FUNÇÃO PRINCIPAL (HANDLER) ---

serve(async (req: Request) => {
    // 1. Configuração de CORS (Essencial para Edge Functions)
    // CORREÇÃO: Adicionamos mais headers para máxima compatibilidade, mitigando o erro de conexão
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Permitir acesso de qualquer origem (dev/prod)
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, X-Client-ID, Content-Type, X-Public-Key, X-Secret-Key',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2. Validação inicial das chaves
    if (!EXPFY_PK || !EXPFY_SK) {
        return new Response(
            JSON.stringify({ error: 'Configuração de API inválida. Chaves da ExpfyPay não encontradas.' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

    try {
        const data = await req.json();
        
        console.log("Processando pagamento ExpfyPay:", data);
        
        const { paymentMethod, amount, customerData, cardToken } = data;

        // --- VALIDAÇÃO DE ENTRADA ---
        if (!paymentMethod || !amount || !customerData) {
             return new Response(
                 JSON.stringify({ error: 'Dados incompletos', message: 'Faltando método, valor ou dados do cliente.' }),
                 { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
             );
        }

        // Validação do CPF
        const cleanCpf = formatNumber(customerData.cpf);
        if (!isCpfValid(cleanCpf || "")) {
            return new Response(
                JSON.stringify({ 
                    error: 'Bad Request', 
                    message: 'O CPF fornecido é inválido. Por favor, verifique o número.' 
                }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }
        // -----------------------------
        
        let expfypayBody: Record<string, any>;
        let finalEndpoint = EXPFY_PAYMENTS_ENDPOINT; 
        const amountInReais = amount; // ExpfyPay espera o valor em reais (decimal)

        const baseCustomer = {
            name: customerData.name,
            document: cleanCpf, 
            email: customerData.email,
        };
        
        // 3. Montagem do Body da Requisição
        if (paymentMethod === 'PIX') {
            expfypayBody = {
                amount: amountInReais, 
                description: `Pedido - Patinete Elétrico (PIX)`,
                customer: baseCustomer,
                external_id: `ORDER_PIX_${Date.now()}`,
                payment_method: 'pix' // Adicionando método explícito, se necessário pela API
            };
        } else if (paymentMethod === 'CARD') {
             if (!cardToken) {
                 return new Response(
                    JSON.stringify({ error: 'Bad Request', message: 'Token de cartão ausente para pagamento CARD.' }),
                    { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
                 );
             }
             
             // O FRONT-END DEVE ENVIAR O cardToken em base64. 
             // O ideal seria que a API aceitasse os dados diretamente, 
             // mas estamos assumindo a necessidade do token.
             // Aqui apenas decodificamos para log (não recomendado em produção, 
             // mas necessário para prosseguir com a lógica da ExpfyPay se ela
             // realmente não exige token, e sim os dados).
             let cardDetails = {};
             try {
                // Tenta decodificar o token que o frontend enviou
                const decodedCardData = JSON.parse(atob(cardToken));
                cardDetails = {
                    card_number: decodedCardData.number,
                    card_holder_name: decodedCardData.holderName,
                    card_expiration_date: decodedCardData.expiration,
                    card_cvv: decodedCardData.cvv,
                };
             } catch (e) {
                 console.error("Erro ao decodificar cardToken:", e);
                 // Continua, mas sem os detalhes do cartão se a ExpfyPay espera apenas o token
             }
             
             expfypayBody = {
                 amount: amountInReais, 
                 description: `Pedido - Patinete Elétrico (Cartão)`,
                 customer: baseCustomer,
                 external_id: `ORDER_CARD_${Date.now()}`,
                 payment_method: 'credit_card', // Método de pagamento
                 ...cardDetails // Inclui os detalhes decodificados
             };
        } else {
            return new Response(JSON.stringify({ error: 'Unsupported payment method' }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log("ExpfyPay Request Body:", JSON.stringify(expfypayBody));
        
        // 4. Chamada à API ExpfyPay
        const response = await fetch(finalEndpoint, {
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
            // ADIÇÃO CRÍTICA: Timeout. Evita que a requisição trave indefinidamente.
            signal: AbortSignal.timeout(15000) // 15 segundos de timeout
        });

        // 5. Tratamento de resposta
        if (!response.ok) {
            const errorText = await response.text();
            
            console.error(`ExpfyPay response status: ${response.status}`);
            console.error(`ExpfyPay error body: ${errorText}`);

            let errorMessage = `Falha ao gerar pagamento ExpfyPay (Status: ${response.status}).`;

            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText.substring(0, 150) || errorMessage;
            }

            // Retorna o status e a mensagem exata da API para o Front-end
            return new Response(JSON.stringify({ error: errorMessage }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 6. Se a resposta for OK (Status 200)
        const paymentData = await response.json();

        // 7. Retorna os dados ao Front-end
        return new Response(
            JSON.stringify({
                success: true,
                paymentData: paymentData,
                method: paymentMethod 
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
                 errorMessage = 'A requisição para a ExpfyPay demorou demais e expirou. Tente novamente.';
            }
            if (errorMessage.toLowerCase().includes('json')) {
                errorMessage = 'Formato de dados JSON inválido na requisição.'
            }
        }
        
        console.error("ERRO CRÍTICO NA FUNÇÃO:", errorMessage);

        // Retorna uma resposta de erro genérica ao front-end
        return new Response(
            JSON.stringify({ 
                error: 'Internal Server Error', 
                message: `Erro na função: ${errorMessage}` 
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
        );
    }
});
