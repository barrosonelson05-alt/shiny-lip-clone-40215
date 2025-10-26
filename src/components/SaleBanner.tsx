import { useEffect, useState } from 'react';
import { Gift, Zap } from 'lucide-react';

export const SaleBanner = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 55, seconds: 41 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { minutes: prev.minutes - 1, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-sale text-sale-foreground py-2.5">
      <div className="container px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-2xl md:text-3xl font-bold leading-none">R$ 67,90</span>
              <Gift className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="line-through opacity-60">R$ 619,90</span>
              <span
                className="font-normal px-2 py-0.5 rounded-full text-xs whitespace-nowrap"
                style={{ backgroundColor: 'rgb(254, 93, 56)' }}
              >
                Economize até 85%
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-0.5">
              <Zap className="h-2 w-2" fill="currentColor" />
              <span className="text-[11px] font-bold uppercase tracking-wide">Oferta Relâmpago</span>
            </div>
            <div className="bg-white text-sale px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide">
              TERMINA EM {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
