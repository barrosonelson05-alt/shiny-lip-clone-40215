import profile1 from '@/assets/profile-1.jpg';
import profile2 from '@/assets/profile-2.jpg';
import profile3 from '@/assets/profile-3.jpg';
import review1 from '@/assets/review-1.jpg';
import review2 from '@/assets/review-2.jpg';

const reviews = [
  {
    name: 'Carlos Silva',
    location: 'São Paulo, SP',
    rating: 5,
    comment:
      'Comprei pro meu filho ele amou está indo pro trabalho com o patinete fácil fé andar praticidade na hora dd guardar produto excelente e meu filho conseguiu colocar no seguro.',
    image: review1,
    profile: profile1,
  },
  {
    name: 'Rafaela Lima',
    location: 'Rio de Janeiro, RJ',
    rating: 5,
    comment:
      'Gostei bastante, achei que era mais lento mas a velocidade me surpreendeu, no manual diz que vai ate 25 mas claramente da pra ver a velocidade almentando quando chega no limite de 25, deve chegar nos 30, a bateria dura até que bem, recarregamos a cada 3 dias.',
    image: review2,
    profile: profile2,
  },
  {
    name: 'Pedro Raul',
    location: 'Belo Horizonte, MG',
    rating: 5,
    comment:
      'Excelente meio de transporte para quem almeja não gastar com gasolina e busca praticidade, uso para ir ao trabalho e foi uma escolha ótima adquirir o produto!!.',
    profile: profile3,
  },
];

export const Reviews = () => {
  return (
    <div className="container px-4 pb-6">
      <div className="border-t border-border mb-4" />
      <div className="space-y-3 md:space-y-4">
        <h2 className="text-lg md:text-xl font-bold">Avaliações dos clientes (491)</h2>

        {reviews.map((review, index) => (
          <div key={index} className="border-b pb-3 md:pb-4 last:border-0">
            <div className="flex items-start gap-2 mb-2">
              <img
                src={review.profile}
                alt={review.name}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm md:text-base">{review.name}</p>
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs">{'⭐'.repeat(review.rating)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{review.location}</p>
              </div>
            </div>
            <p className="text-xs md:text-sm text-foreground mb-2 leading-relaxed">{review.comment}</p>
            {review.image && (
              <div className="flex gap-2 overflow-x-auto">
                <img
                  src={review.image}
                  alt={`Review ${index + 1}`}
                  className="w-16 h-16 md:w-20 md:h-20 rounded object-cover flex-shrink-0"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
