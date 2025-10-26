import { Star, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import storeLogo from '@/assets/store-logo.jpg';

export const StoreReviews = () => {
  return (
    <div className="container px-4 py-4 md:py-6">
      <div className="border-t border-border mb-4" />
      
      {/* Store Reviews Header */}
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-bold mb-3">Avaliações da loja (207)</h2>
        
        {/* Star Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="outline" size="sm" className="text-xs h-8">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
            5 estrelas (155)
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
            4 estrelas (22)
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8">
            <ImageIcon className="h-3 w-3 mr-1" />
            Incluir imagens ou vídeos (52)
          </Button>
        </div>

        {/* Store Info */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-accent/10">
          <div className="flex items-center gap-3">
            <img 
              src={storeLogo} 
              alt="eletriczbrasil" 
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="font-bold text-sm md:text-base">eletriczbrasil</p>
              <p className="text-xs text-muted-foreground">307 produtos</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-8 px-4">
            Seguir
          </Button>
        </div>
      </div>

      {/* Product Reviews Section */}
      <div className="border-t border-border pt-4">
        <h3 className="text-base md:text-lg font-semibold mb-3">Reviews do produto</h3>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="text-2xl font-bold">4.7</span>
          </div>
          <span className="text-sm text-muted-foreground">/ 5.0</span>
          <span className="text-sm text-muted-foreground ml-2">(207 avaliações)</span>
        </div>
        
        {/* Rating Breakdown */}
        <div className="space-y-2 mb-4">
          {[
            { stars: 5, count: 155, percentage: 75 },
            { stars: 4, count: 22, percentage: 11 },
            { stars: 3, count: 18, percentage: 9 },
            { stars: 2, count: 8, percentage: 4 },
            { stars: 1, count: 4, percentage: 1 },
          ].map((rating) => (
            <div key={rating.stars} className="flex items-center gap-2 text-xs">
              <span className="w-8">{rating.stars}★</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400"
                  style={{ width: `${rating.percentage}%` }}
                />
              </div>
              <span className="w-12 text-right text-muted-foreground">{rating.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
