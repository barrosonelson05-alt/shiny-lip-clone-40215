import { Button } from '@/components/ui/button';
import { Share2, ShoppingCart } from 'lucide-react';
import tiktokLogo from '@/assets/tiktok-shop-logo.webp';

export const ProductHeader = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
      <div className="container flex items-center justify-between p-3 md:p-4">
        <div className="flex items-center gap-2">
          <img src={tiktokLogo} alt="TikTok Shop" className="h-6 w-6 md:h-7 md:w-7 object-contain" />
          <span className="font-bold text-base md:text-lg">TikTok Shop</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10">
            <Share2 className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10">
            <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </div>
      </div>
    </header>
  );
};
