export const ProductDescription = () => {
  return (
    <div className="container px-4 py-4 md:py-6">
      <h2 className="text-lg md:text-xl font-bold mb-3">Descrição do produto</h2>
      <div className="space-y-3 text-sm md:text-base text-foreground leading-relaxed">
        <p>
          <strong>Patinete Elétrico Foston FS-509 Pro</strong> - O patinete elétrico ideal para quem busca praticidade, economia e mobilidade urbana. Com design moderno e robusto, o FS-509 Pro é perfeito para deslocamentos diários, oferecendo conforto e segurança em cada trajeto.
        </p>
        <p>
          <strong>Características Principais:</strong>
        </p>
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li><strong>Velocidade Máxima:</strong> Atinge até 30 km/h, permitindo deslocamentos rápidos e eficientes.</li>
          <li><strong>Autonomia:</strong> Bateria de longa duração com até 30-35 km de alcance por carga completa.</li>
          <li><strong>Motor Potente:</strong> Motor de 350W que garante performance em subidas e terrenos variados.</li>
          <li><strong>Conectividade Bluetooth:</strong> Conecte seu smartphone e controle funções via aplicativo.</li>
          <li><strong>Display LED:</strong> Painel digital que mostra velocidade, nível de bateria e modo de pilotagem.</li>
          <li><strong>Estrutura em Alumínio:</strong> Leve e resistente, suporta até 120kg.</li>
          <li><strong>Sistema de Frenagem:</strong> Freio a disco e freio eletrônico para maior segurança.</li>
          <li><strong>Pneus:</strong> Rodas de 8.5 polegadas com câmara de ar para maior conforto.</li>
          <li><strong>Iluminação:</strong> Farol LED frontal e luz traseira para maior visibilidade.</li>
          <li><strong>Dobrável:</strong> Design compacto e dobrável facilita o transporte e armazenamento.</li>
        </ul>
        <p>
          <strong>Modos de Pilotagem:</strong> Escolha entre os modos ECO (economia de bateria), Drive (uso normal) e Sport (máxima potência) para se adaptar a diferentes necessidades.
        </p>
        <p>
          <strong>Segurança e Conforto:</strong> Equipado com sistema de suspensão dianteira que absorve impactos, proporcionando uma condução suave mesmo em superfícies irregulares.
        </p>
        <p className="text-muted-foreground italic">
          Ideal para estudantes, profissionais e qualquer pessoa que busca uma alternativa sustentável e econômica aos transportes convencionais.
        </p>
      </div>
    </div>
  );
};
