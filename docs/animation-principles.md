# Movimento humano aplicado ao RigLab

Notas de estudo e decisões de implementação. Estas notas mantêm o conhecimento no projeto para orientar futuras animações; não representam treinamento permanente do modelo nem simulação biomecânica validada.

## Referências consultadas

1. [Disney Animation — processo de animação](https://www.disneyanimation.com/process/animation/): timing, poses legíveis, ação secundária e continuidade do movimento ajudam a comunicar vida e intenção. Aplicação: amplitudes contidas e fases diferentes para quadril, peito, cabeça e mãos, em vez de mover todo o esqueleto em sincronia.
2. [Jason Martinsen / Animation Mentor — Animating Dynamic Run Cycles](https://www.animationmentor.com/blog/animating-dynamic-run-cycles/): planejar extensão, compressão, passagem e impulsão; a corrida inclui suspensão dos dois pés. Aplicação: apoio menor que metade do ciclo, recuperação do pé, braços opostos às pernas, postura inclinada e atraso do tronco/cabeça. As amplitudes adotadas são escolhas de animação, não valores extraídos do tutorial.
3. [Journal of Experimental Biology — Neglected losses and key costs](https://journals.biologists.com/jeb/article/216/6/933/11885/Neglected-losses-and-key-costs-tracking-the): caminhada e corrida têm trajetórias distintas do centro de massa; na corrida há compressão da perna de apoio e fase aérea. Aplicação: curva de altura do quadril com ponto baixo durante o apoio e alto durante suspensão. O quadril é uma aproximação visual, não um cálculo do centro de massa real.
4. [Blender — IK Constraint](https://docs.blender.org/manual/id/5.0/animation/constraints/tracking/ik_solver.html): IK coordena uma cadeia; o pole target determina sua orientação de dobra. Aplicação: perna resolvida por dois segmentos com direção de joelho para frente, comprimentos preservados e tornozelo orientado separadamente.

## Articulações e limites do rig

- Quadril/ombro orientam o membro em mais de um eixo. Joelho/cotovelo precisam de uma direção de dobra consistente; não são dobradiças arbitrárias com o mesmo comportamento do ombro.
- Comprimento de ossos é invariável nos ciclos. O corpo ganha elasticidade visual por flexão e deslocamento, sem escala óssea.
- Alvo de pé define posição; rolagem do tornozelo define orientação. A compensação da ponta do pé usa os pontos do rig, não a geometria real da sola.
- Evitar hiperextensão e a singularidade da perna perfeitamente reta: reservar uma pequena margem de alcance e manter direção de dobra.
- Não há simulação de forças, centro de massa, choque com o chão, tecidos, dedos ou limites anatômicos calibrados. Todos os valores são parâmetros artísticos para o humanoide do protótipo.

## Idle

Uma espera relaxada: pés fixos, braços abaixados, cotovelos levemente flexionados, respiração comunicada pelo peito/coluna e pequena transferência lateral. Ciclo base de 16 segundos: quatro movimentos respiratórios, olhar para um lado (1,4–4,1 s), descanso da mão na cintura (4,1–11,1 s), olhar para o outro lado (6,7–9,5 s), pequena flexão dos joelhos (10,7–12,8 s), olhar para cima (11,3–14,2 s) e retorno à postura inicial. Entradas e saídas usam curvas suaves e intervalos quietos; o tronco acompanha os olhares com atraso. Cabeça e mãos recebem fases diferentes e amplitudes menores. A variação é periódica e determinística, sem ruído aleatório causando tremor ou salto no loop. Esses tempos são decisões artísticas, não uma medição clínica de respiração.

## Running

Ciclo base de 0,8 s, no lugar. Cada pé apoia durante 36% do ciclo; pernas defasadas em 50%, deixando dois intervalos sem apoio. A trajetória de retorno mantém velocidade nas bordas e levanta o pé atrás do corpo antes de retornar à frente. Quadril comprime durante apoio e sobe na fase aérea; braços opostos, cotovelos flexionados, ombros contrarrotacionados e cabeça parcialmente estabilizada. Controle de ritmo muda a duração, expressividade muda amplitudes do corpo.

## Suavidade e validação

- Curvas periódicas e transições polinomiais de quinta ordem; velocidade do pé contínua na entrada/saída do apoio.
- Keyframes amostrados em 30 fps; quaternions interpolados por slerp. O primeiro frame é copiado exatamente no final para fechar o loop.
- Verificar sequência completa: contato → compressão → passagem → impulsão → suspensão. Conferir de lado e de frente, com e sem esqueleto.
- Testar finitude, normalização das rotações, preservação dos comprimentos, continuidade, apoio estável no idle, existência de fase aérea na corrida e exportação/reabertura.
- Confirmar visualmente arcos de mãos/pés, direção dos joelhos, tronco, deformações e interpenetrações. Um teste matemático não comprova beleza, equilíbrio físico ou qualidade da malha.
- Separar problema de movimento de problema de skinning: pesos por proximidade ainda podem pinçar ombros e quadril. Uma boa trajetória não corrige uma malha mal vinculada.

Implementação: `src/motion.js`; caminhada anterior: `src/walk.js`; controles manuais: `src/rig.js`. As escolhas acima devem orientar novos ciclos e refinamentos.

## Revisão da corrida — referência de poses fornecida pelo usuário

A versão anterior combinava oscilação lateral/torção ampla com retorno dos pés por uma única curva com tangente de apoio longa. A revisão usa arcos Hermite por etapas: contato, saída do apoio, recuperação do calcanhar, avanço do joelho e retorno ao contato. As tangentes são contínuas e a excursão para trás fica limitada para evitar que a compensação de alcance do IK derrube excessivamente o quadril.

O deslocamento lateral da pelve caiu de 1,9% para 0,5% do comprimento da perna; sua oscilação vertical autorada caiu de 7,3% para 4%. A torção do tronco ficou mais discreta. Cotovelos permanecem em torno de 90°, com braços próximos ao corpo e opostos à perna do mesmo lado. A recuperação do calcanhar tem arco mais alto, mantendo contato alternado e fase aérea. A duração e o formato dos clipes são compatíveis; clipes existentes precisam ser gerados novamente para receber a nova coreografia.

Verificação: poses de contato/voo inspecionadas no navegador de perfil, testes de continuidade nas junções, ausência de cruzamento de fase dos braços, excursão lateral limitada, preservação dos ossos e exportação. A referência orienta a coreografia; não foi convertida em captura de movimento.

## Corrida: largura de apoio e postura integrada

A pose de referência não define mais a largura da passada: os tornozelos percorrem faixas próximas ao centro (cada lado entre 4,5% e 7,5% do comprimento da perna), preservando a largura original do quadril e o comprimento dos ossos. Um plano de flexão estável orienta as pernas e direciona os joelhos para frente com leve convergência, evitando abertura lateral herdada do rig.

A inclinação anterior da pelve/corpo aumentou, com compensação no pescoço/cabeça. Quadril e peito contrarrotacionam e têm inclinações laterais discretas coordenadas; a orientação dos braços agora usa o referencial do peito em vez de permanecer fixa no mundo. A recuperação da perna tem joelho mais alto e uma subida distribuída por mais tempo para evitar trancos.

Conferido no demonstrador de frente e perfil. Testes percorrem três larguras de rig e verificam faixas estreitas sem cruzamento da linha central, ausência de abertura excessiva dos joelhos, oposição de quadril/peito, integridade e continuidade do ciclo. Os projetos existentes mantêm o rig e os pesos; é preciso gerar o clipe novamente.

## Caminhada: apoio estreito e coordenação corporal

A caminhada agora compartilha o solver de pernas da corrida: plano de flexão estável, joelhos voltados para frente e faixa de apoio independente da abertura da pose A/T. Cada pé permanece entre 6,5% e 10,5% do comprimento da perna em relação ao centro; a faixa é um pouco mais larga que na corrida. Os braços acompanham o referencial do peito, com balanço oposto à perna e flexão suave dos cotovelos.

O quadril faz uma transferência lateral discreta para o lado de apoio, com contrarrotação de peito e compensação da cabeça. A caminhada mantém 60% de apoio por pé, intervalos de apoio duplo, elevação baixa dos pés e inclinação anterior moderada. O ciclo não tem fase aérea. Mantidas a continuidade das trajetórias, as durações e as opções de tamanho de passo.

Verificação: demonstrador de frente e perfil em poses do ciclo; testes em três larguras de rig e dois comprimentos de passo, cobrindo apoio contínuo, ausência de cruzamento dos pés, direção dos joelhos, contrarrotação e ausência de saltos entre frames. Gere a caminhada novamente para aplicar as mudanças a um projeto existente.
