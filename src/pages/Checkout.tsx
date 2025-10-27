import { useState, useEffect } from 'react';
// Certifique-se de que todos estes componentes estão corretamente mapeados em '@/components/ui/'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
// Certifique-se de que a biblioteca Lucide está instalada (npm install lucide-react)
import { Gift, Zap, Truck, RotateCcw, Lock, CreditCard } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
// Certifique-se de que o cliente Supabase está configurado corretamente
import { supabase } from '@/integrations/supabase/client'; 

// Assets (Verifique se os caminhos dos seus assets estão corretos)
import tiktokShopIcon from '@/assets/tiktok-shop-icon.webp';
import scooterProduct from '@/assets/scooter-product.webp';

const Checkout = () => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(120000); // 2 minutes in milliseconds
  const [selectedPayment, setSelectedPayment] = useState('Pix');
  const [cepLoading, setCepLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // ESTADO CRÍTICO: Para capturar e exibir erros da API/Back-end (como o de CPF inválido)
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
    const cleanCep = cep.replace(/\D/g, '');
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
    return formatted.substring(0, 19); 
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
      // Captura os dados do formulário
      const name = (document.getElementById('name') as HTMLInputElement)?.value;
      const email = (document.getElementById('email') as HTMLInputElement)?.value;
      const phone = (document.getElementById('phone') as HTMLInputElement)?.value;
      const cpf = (document.getElementById('cpf') as HTMLInputElement)?.value;

      // Validações básicas (Front-end)
      if (!name || !email || !phone || !cpf) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, preencha todos os dados de identificação.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (!validateEmail(email)) {
        toast({
          title: "Email inválido",
          description: "Por favor, digite um email válido.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (!validateCPF(cpf)) {
        setApiError({ field: 'cpf', message: "Por favor, digite um CPF válido com 11 dígitos." });
        toast({
          title: "CPF inválido",
          description: "Por favor, digite um CPF válido com 11 dígitos.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const cleanedCPF = cpf.replace(/\D/g, '');

      const customerData = { 
        name: name.trim(), 
        email: email.trim(), 
        phone: phone.replace(/\D/g, ''), 
        cpf: cleanedCPF 
      };
      const amount = selectedPayment === 'Pix' ? 63.15 : 67.90; // Valores em Reais

      if (selectedPayment === 'Cartao') {
        // Validações de cartão... (omitido para foco)
        if (!cardData.number || !cardData.holderName || !cardData.expiration || !cardData.cvv) {
          toast({
            title: "Dados do cartão incompletos",
            description: "Por favor, preencha todos os dados do cartão.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }
        
        // Simulação de tokenização
        const cardToken = btoa(JSON.stringify({
          number: cardData.number.replace(/\s/g, ''),
          holderName: cardData.holderName,
          expiration: cardData.expiration,
          cvv: cardData.cvv
        }));

        // Processar Cartão (via Edge Function)
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: 'CARD',
            amount,
            cardToken,
            customerData
          }
        });

        if (error) throw error;
        
        // Trata a resposta da Edge Function
        if (data && data.error) {
            throw new Error(data.error); 
        }

        if (data.success) {
          toast({
            title: "Pagamento aprovado!",
            description: `Transação: ${data.transactionId}`,
          });
          // Aqui você pode redirecionar para a página de sucesso
        } else {
          throw new Error("Erro desconhecido ao processar Cartão.");
        }

      } else {
        // Processar Pix (via Edge Function)
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: 'PIX',
            amount,
            customerData
          }
        });

        if (error) throw error;

        // Trata a resposta da Edge Function (Pix)
        if (data && data.error) {
            throw new Error(data.error); 
        }

        if (data.success) {
          toast({
            title: "Pix gerado com sucesso!",
            description: "Use o código abaixo para realizar o pagamento.",
          });
          // Aqui você deve mostrar o QR Code e o código Pix (data.paymentData)
          console.log('Pix Data:', data.paymentData);
        } else {
          throw new Error("Erro desconhecido ao gerar Pix.");
        }
      }

    } catch (error) {
      console.error('Payment error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      // Se a mensagem de erro contiver a palavra "CPF", marca o campo CPF
      if (errorMessage.toLowerCase().includes('cpf')) {
          setApiError({ field: 'cpf', message: errorMessage });
      } else {
          // Trata outros erros da API
          setApiError({ field: 'general', message: errorMessage });
      }
      
      toast({
        title: "Erro no pagamento",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9fa]">
      {/* Header */}
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

      {/* Advice Bar */}
      <div className="bg-[#50b3e8] text-white py-2">
        <div className="container mx-auto px-4 text-center text-sm">
          ✓ Frete grátis em todo Brasil • ✓ Pagamento 100% Seguro • ✓ Garantia de 30 dias
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
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

          <h2 className="text-xl font-bold mb-4">Endereço de Entrega</h2>
          
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input 
                  id="cep" 
                  placeholder="00000-000" 
                  maxLength={9}
                  onBlur={(e) => fillAddress(e.target.value)}
                  disabled={cepLoading}
                />
                {cepLoading && <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>}
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" placeholder="Rua" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="number">Número</Label>
                <Input id="number" placeholder="Número" />
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input id="complement" placeholder="Apto, bloco, etc (opcional)" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" placeholder="Bairro" />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" placeholder="Cidade" />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Input id="state" placeholder="UF" />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <h2 className="text-xl font-bold mb-4">Forma de Pagamento</h2>
          
          <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment} className="space-y-3">
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
                      onChange={(e) => handleCardInputChange('holderName', e.target.value.toUpperCase())}
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
