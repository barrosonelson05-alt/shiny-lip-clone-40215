import { ProductHeader } from '@/components/ProductHeader';
import { ProductGallery } from '@/components/ProductGallery';
import { SaleBanner } from '@/components/SaleBanner';
import { ProductInfo } from '@/components/ProductInfo';
import { ProductDescription } from '@/components/ProductDescription';
import { ProductSpecifications } from '@/components/ProductSpecifications';
import { Reviews } from '@/components/Reviews';
import { StoreReviews } from '@/components/StoreReviews';
import { ProductFooter } from '@/components/ProductFooter';

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-28">
      <ProductHeader />
      <main className="pt-14 md:pt-16">
        <ProductGallery />
        <SaleBanner />
        <ProductInfo />
        <ProductDescription />
        <ProductSpecifications />
        <Reviews />
        <StoreReviews />
      </main>
      <ProductFooter />
    </div>
  );
};

export default Index;
