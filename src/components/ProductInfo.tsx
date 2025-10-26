import { Star, Truck, RotateCcw } from 'lucide-react';

export const ProductInfo = () => {
  return (
    <div className="container py-4 md:py-6 space-y-4 md:space-y-6 px-4">
      <div>
        <div className="mb-1.5">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'linear-gradient(90deg, rgb(255, 192, 203) 0%, rgb(176, 224, 230) 100%)' }}
          >
            Promo do Mês
          </span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-2 leading-tight text-foreground">
          Patinete Elétrico Scooter De Alumínio Com Bluetooth 30km/h
        </h1>
        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 md:h-4 md:w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-foreground">4.7</span>
            <span>(207)</span>
          </div>
          <span>•</span>
          <span>4473 vendidos</span>
        </div>
      </div>

      <div className="border-t border-border my-4" />

      <div className="border rounded-lg p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-success flex-shrink-0" />
          <div>
            <p className="font-semibold text-success text-sm md:text-base">Frete grátis</p>
            <p className="text-xs md:text-sm text-muted-foreground">
              Entrega expressa em todo Brasil. Receba seu produto em até 15 dias úteis com código de rastreamento completo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors">
          <RotateCcw className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm md:text-base">Devolução grátis até 30 dias</p>
            <p className="text-xs md:text-sm text-muted-foreground">
              Não gostou? Devolvemos seu dinheiro sem burocracia. Frete de retorno gratuito e reembolso rápido garantido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
