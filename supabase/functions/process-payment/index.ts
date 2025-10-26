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
    const { paymentMethod, amount, cardToken, customerData } = await req.json();
    
    console.log('Processing payment:', { paymentMethod, amount });
    
    const secretKey = Deno.env.get('AMPLOPAY_SECRET_KEY');
    
    if (!secretKey) {
      throw new Error('AMPLOPAY_SECRET_KEY not configured');
    }

    // Process payment based on method
    if (paymentMethod === 'PIX') {
      // Generate Pix payment
      const pixResponse = await fetch('https://api.amplopay.com/v1/payments/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: amount,
          customer: customerData,
        }),
      });

      if (!pixResponse.ok) {
        const errorData = await pixResponse.text();
        console.error('Amplopay Pix error:', errorData);
        throw new Error('Failed to generate Pix payment');
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
      const cardResponse = await fetch('https://api.amplopay.com/v1/payments/card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: amount,
          cardToken: cardToken,
          customer: customerData,
        }),
      });

      if (!cardResponse.ok) {
        const errorData = await cardResponse.text();
        console.error('Amplopay Card error:', errorData);
        throw new Error('Failed to process card payment');
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
