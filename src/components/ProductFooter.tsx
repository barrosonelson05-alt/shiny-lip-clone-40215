import { Store, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const ProductFooter = () => {
  const navigate = useNavigate();
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="container flex items-center gap-2 p-3">
        {/* Left Side - Store and Chat Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center h-12 w-14 p-1 gap-0.5"
          >
            <Store className="h-4 w-4" />
            <span className="text-[10px]">Loja</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center h-12 w-14 p-1 gap-0.5"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-[10px]">Chat</span>
          </Button>
        </div>

        {/* Right Side - Buy Now Button */}
        <Button
          className="flex-1 h-12 text-base font-bold uppercase"
          style={{ backgroundColor: '#F72E54' }}
          onClick={() => navigate('/checkout')}
        >
          COMPRAR AGORA
        </Button>
      </div>
    </footer>
  );
};
