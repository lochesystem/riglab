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
