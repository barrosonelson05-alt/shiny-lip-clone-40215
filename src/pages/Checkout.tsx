import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Gift, Zap, Truck, RotateCcw, Lock, CreditCard } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import tiktokShopIcon from '@/assets/tiktok-shop-icon.webp';
import scooterProduct from '@/assets/scooter-product.webp';

const Checkout = () => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(120000); // 2 minutes in milliseconds
  const [selectedPayment, setSelectedPayment] = useState('Pix');
  const [cepLoading, setCepLoading] = useState(false);

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
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" />
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
            <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:border-primary">
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
          </RadioGroup>
        </div>

        {/* Order Summary */}
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
              <span className="text-green-600">R$ 63,15</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          className="w-full h-14 text-lg font-bold uppercase"
          style={{ backgroundColor: '#F72E54' }}
        >
          Finalizar Compra
        </Button>

        {/* Security Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="h-4 w-4" />
            <span>Ambiente 100% Seguro</span>
          </div>
          <p>Seus dados estão protegidos e a compra é totalmente segura</p>
        </div>
      </div>

        {/* Footer */}
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
