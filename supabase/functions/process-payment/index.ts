import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Recebe os dados do Front-end
    const { paymentMethod, amount, cardToken, customerData } = await req.json();
    
    console.log('Processing payment:', { paymentMethod, amount, customerData });
    
    const secretKey = Deno.env.get('AMPLOPAY_SECRET_KEY');
    
    if (!secretKey) {
      // Erro se a chave secreta não estiver configurada no Supabase Secrets
      throw new Error('AMPLOPAY_SECRET_KEY not configured on server');
    }

    // Process payment based on method
    if (paymentMethod === 'PIX') {
      // --- CORREÇÃO 1: FORMATAR DADOS DO CLIENTE PARA O PADRÃO DA API ---
      // A API da Amplopay provavelmente espera o CPF em um campo 'document' limpo.
      const customerDocument = customerData.cpf ? customerData.cpf.replace(/[^\d]/g, '') : null;

      if (!customerDocument) {
        throw new Error('Customer CPF is required for PIX payment.');
      }

      // Gera o pagamento Pix
      const pixResponse = await fetch('https://api.amplopay.com/v1/payments/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: amount,
          customer: {
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            document: customerDocument, // CPF/CNPJ LIMPO
          },
        }),
      });

      if (!pixResponse.ok) {
        // --- CORREÇÃO 2: CAPTURAR O ERRO ESPECÍFICO DA AMPLOPAY ---
        const errorDataText = await pixResponse.text();
        console.error('Amplopay Pix response status:', pixResponse.status);
        console.error('Amplopay Pix error body:', errorDataText);
        
        let errorMessage = 'Failed to generate Pix payment (Check server logs for details)';

        try {
          // Tenta analisar o JSON de erro da Amplopay para obter a mensagem exata
          const errorJson = JSON.parse(errorDataText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          // Se não for JSON, usa o texto bruto do erro como último recurso
          // Se o erro for 401 Unauthorized, por exemplo, o texto bruto é útil
        }

        throw new Error(errorMessage);
      }

      const pixData = await pixResponse.json();
      
      console.log('Pix payment created successfully');
      
      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'PIX',
          pixCode: pixData.pixCode || pixData.qrCode,
          qrCodeImage: pixData.qrCodeImage,
          transactionId: pixData.transactionId || pixData.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else if (paymentMethod === 'CARD') {
      // Process card payment
      // Aplicando a mesma lógica de formatação de cliente para o Cartão
      const customerDocument = customerData.cpf ? customerData.cpf.replace(/[^\d]/g, '') : null;

      const cardResponse = await fetch('https://api.amplopay.com/v1/payments/card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: amount,
          cardToken: cardToken,
          customer: {
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone,
            document: customerDocument,
          },
        }),
      });

      if (!cardResponse.ok) {
        // --- CORREÇÃO 2: CAPTURAR O ERRO ESPECÍFICO DA AMPLOPAY (CARTÃO) ---
        const errorDataText = await cardResponse.text();
        console.error('Amplopay Card response status:', cardResponse.status);
        console.error('Amplopay Card error body:', errorDataText);
        
        let errorMessage = 'Failed to process card payment (Check server logs for details)';

        try {
          const errorJson = JSON.parse(errorDataText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          // Usa o texto bruto do erro
        }

        throw new Error(errorMessage);
      }

      const cardData = await cardResponse.json();
      
      console.log('Card payment processed successfully');
      
      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'CARD',
          transactionId: cardData.transactionId || cardData.id,
          status: cardData.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid payment method');
    }
    
  } catch (error) {
    console.error('Payment processing error:', error);
    
    // Garante que a mensagem de erro do Amplopay seja exibida no Front-end
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
