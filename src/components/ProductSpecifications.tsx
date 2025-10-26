export const ProductSpecifications = () => {
  const specs = [
    { label: 'Marca', value: 'Foston' },
    { label: 'Modelo', value: 'FS-509 Pro' },
    { label: 'Potência do Motor', value: '350W' },
    { label: 'Velocidade Máxima', value: '30 km/h' },
    { label: 'Bateria', value: '36V 7.5Ah Lithium' },
    { label: 'Autonomia', value: '30-35 km por carga' },
    { label: 'Tempo de Carga', value: '4-6 horas' },
    { label: 'Peso Máximo Suportado', value: '120 kg' },
    { label: 'Peso do Produto', value: '12.5 kg' },
    { label: 'Tamanho das Rodas', value: '8.5 polegadas' },
    { label: 'Material da Estrutura', value: 'Alumínio aeronáutico' },
    { label: 'Sistema de Frenagem', value: 'Freio a disco + Freio eletrônico' },
    { label: 'Modos de Pilotagem', value: 'ECO / Drive / Sport' },
    { label: 'Display', value: 'LED digital multifuncional' },
    { label: 'Conectividade', value: 'Bluetooth' },
    { label: 'Iluminação', value: 'Farol LED frontal + Luz traseira' },
    { label: 'Suspensão', value: 'Suspensão dianteira' },
    { label: 'Resistência à água', value: 'IP54' },
    { label: 'Dimensões (Dobrado)', value: '108 x 43 x 49 cm' },
    { label: 'Dimensões (Aberto)', value: '108 x 43 x 114 cm' },
  ];

  return (
    <div className="container px-4 py-4 md:py-6">
      <div className="border-t border-border mb-4" />
      <h2 className="text-lg md:text-xl font-bold mb-3">FICHA TÉCNICA</h2>
      <div className="space-y-2">
        {specs.map((spec, index) => (
          <div
            key={index}
            className={`flex justify-between py-2.5 px-3 text-sm ${
              index % 2 === 0 ? 'bg-muted/30' : 'bg-background'
            }`}
          >
            <span className="font-semibold text-muted-foreground">{spec.label}:</span>
            <span className="text-foreground font-medium text-right ml-4">{spec.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-accent/20 rounded-lg">
        <p className="text-xs md:text-sm font-semibold mb-2">Modos de Pilotagem:</p>
        <ul className="space-y-1.5 text-xs md:text-sm">
          <li><strong>ECO:</strong> Velocidade limitada para economia máxima de bateria</li>
          <li><strong>Drive:</strong> Modo padrão equilibrado para uso diário</li>
          <li><strong>Sport:</strong> Velocidade e potência máximas para melhor desempenho</li>
        </ul>
      </div>
    </div>
  );
};
