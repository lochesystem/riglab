# RigLab

Protótipo local de rigging assistido e animação de humanoides, feito com Three.js e Vite. Todo o processamento do modelo acontece no navegador, incluindo os pesos em um Web Worker. Não há backend, conta ou envio de modelos a serviços externos.

## Executar

Requer Node.js 22.12+ ou 24+.

```sh
npm install
npm run dev -- --port 5173
```

Abra http://127.0.0.1:5173. Para gerar a versão distribuível: `npm run build`. Para servi-la: `npm run preview`.

## Experimentar em dois minutos

1. A demonstração abre com uma malha humanoide procedural, ainda sem esqueleto. Ela é um personagem original simples, não uma conversão das imagens de referência.
2. Na etapa **Rigging**, confira as 19 articulações. Selecione pela cena, lista ou seletor. Mova com o gizmo ou campos X/Y/Z. **Espelhar ajustes** mantém os dois lados alinhados.
3. Clique em **Gerar auto-rig**. Os pesos são calculados usando a mesma rotina empregada nos GLBs importados.
4. Em **Animação**, escolha um osso e rotacione com o gizmo ou campos. Em **Mover**, selecione qualquer osso e arraste o controle. Mãos e pés usam IK. Joelhos controlam coxa/canela com acompanhamento leve da cintura; cotovelos controlam braço/antebraço com influência no tronco. Esses controles tentam manter pés/mãos na posição inicial dentro do alcance do membro. Os demais ossos movimentam o antecessor por rotação e os descendentes acompanham, sem alterar os comprimentos. O quadril move o corpo inteiro. A seleção é preservada ao trocar de ferramenta.
5. Clique na régua para escolher um tempo, ajuste a pose e pressione **K** para gravar. Arraste os losangos para mover keyframes. Copie, cole ou exclua poses pelos botões da timeline.
6. **Criar aceno de exemplo** gera cinco poses de teste; **Espaço** reproduz. A interpolação usa quaternion slerp e posições lineares. A duração redimensiona o tempo do clipe.
7. **Salvar** baixa um `.riglab` com malha, materiais/texturas incorporadas, articulações, pose atual e keyframes. **Abrir projeto** restaura o arquivo.
8. **Exportar GLB** inclui malha, skin, 19 juntas, quatro influências por vértice e o clipe de animação quando existem keyframes.

## Importar seu personagem

Use **Importar modelo GLB** ou arraste um `.glb` para a cena. O arquivo deve ser autocontido, sem rig, em pose A ou T, com até 30 MB e 200 mil vértices. A altura é normalizada para 2 metros. Use os botões de rotação se o modelo estiver deitado ou virado para trás; confira os eixos e selecione a pose de referência antes de ajustar articulações.

A proposta inicial de esqueleto usa proporções humanoides padrão. Não há reconhecimento por IA da anatomia. A qualidade depende do alinhamento manual das juntas, da pose, topologia e separação dos membros.

As cinco imagens conceituais estão na biblioteca de referências. São PNGs, não modelos 3D; a conversão imagem → GLB acontece fora deste protótipo.

## Limites conhecidos

- Pesos por distância a segmentos de ossos, com até quatro influências normalizadas. Não é um solver volumétrico; ombros, roupas largas e membros próximos podem deformar mal. Ainda não há pintura de pesos.
- IK CCD simples para braços e pernas, sem limites anatômicos, controle de cotovelo/joelho, colisões ou contato automático com o chão. Alvos fora do alcance não esticam o esqueleto.
- Sem dedos individuais, face, cabelos/roupas com física, retargeting ou mistura de vários clipes.
- Apenas GLB estático autocontido. Malhas já rigadas, morph targets, instâncias, Draco e texturas KTX2 não são suportados nesta versão. GLBs exportados podem ser usados em visualizadores e editores externos; para continuar no RigLab, use o `.riglab`.
- Gerar novamente o rig substitui os pesos e limpa o clipe e o histórico. O aviso aparece ao reajustar o esqueleto. Alterações de juntas exigem regeneração antes de voltar a animar.
- Undo/redo guarda 40 edições de poses, marcadores e timeline. Importar outra malha, reorientá-la ou regenerar o rig reinicia o histórico. Não há salvamento automático; baixe o projeto antes de fechar ou trocar de modelo.
- Interface projetada para desktop, com largura mínima de 900 px e WebGL. A interface usa fontes locais e não depende de carregamento de fontes externas.

## Verificação

```sh
npm test
npm run build
npm run test:e2e
```

Os testes de navegador usam o Google Chrome instalado. Para usar o Chromium do Playwright, remova `channel: 'chrome'` da configuração e execute `npx playwright install chromium`.

Os testes numéricos verificam normalização de pesos, deformação real de vértices, convergência do IK sem alongamento e interpolação/exportação de keyframes. Os testes de integração percorrem rigging, pose, undo/redo, IK, timeline, exportação de GLB, carregamento externo via GLTFLoader, salvar/abrir projeto, importação GLB e erros de entrada. Capturas e arquivos de teste ficam em `test-results/`.

## Organização

- `src/main.js`: cena, controles, interface, importação, persistência e exportação.
- `src/rig.js`: esqueleto, poses, IK e geração do clipe.
- `src/weights.js` e `src/weights.worker.js`: cálculo assíncrono de pesos.
- `src/demo.js`: humanoide low-poly procedural sem rig inicial.
- `public/references/`: os cinco conceitos de personagem.

Documentação das APIs: https://threejs.org/docs/pages/SkinnedMesh.html · https://threejs.org/docs/pages/TransformControls.html · https://threejs.org/docs/pages/GLTFExporter.html

## Gerar uma caminhada

Após gerar o rig, na etapa **Animação**, escolha **Velocidade** e **Tamanho do passo** e clique em **Gerar caminhada**. Pressione Espaço para reproduzir. O gerador cria um ciclo no lugar com passos alternados, retorno dos pés acima do chão, joelhos voltados para frente e balanço oposto dos braços. O último keyframe repete exatamente o primeiro para fechar o loop. A duração é definida pela velocidade; as poses continuam editáveis, salváveis e exportáveis. Gerar substitui o clipe atual, com recuperação por Desfazer.

A caminhada é procedural, orientada para +Z, baseada nas articulações ajustadas. Não avança pelo cenário e não detecta o formato da sola da malha: os alvos usam a altura dos tornozelos da pose de referência. A qualidade visual depende do rig e dos pesos; modelos com pés ou proporções muito diferentes podem precisar de edição das poses.

A caminhada inclui transferência lateral de peso, contrarrotação de quadril e ombros, estabilização discreta da cabeça e atraso de movimento dos cotovelos e mãos. A trajetória dos pés mantém velocidade contínua na passagem entre apoio e retorno, com rolagem do tornozelo. A altura do quadril se adapta ao alcance das pernas para evitar uma postura constantemente agachada. Para aplicar melhorias do gerador a um projeto existente, gere a caminhada novamente: clipes já salvos mantêm suas poses originais.

Os controles de joelho/cotovelo representam uma cadeia cinemática com influência no corpo, não uma simulação física de massa, gravidade ou equilíbrio. O alvo é limitado pelo alcance dos ossos; o gizmo retorna à posição alcançada ao soltar.

## Idle e running

Na etapa **Animação**, a seção **Idle e corrida** oferece **Expressividade** (sutil/natural/expressiva) e **Ritmo**. **Gerar idle** cria uma sequência de espera de 16 segundos com respiração, olhares laterais e para cima, mão descansando na cintura, mudança de apoio, leve flexão dos joelhos e retorno à pose inicial. Os pés ficam plantados. **Gerar corrida** cria um loop no lugar com compressão, impulsão, fase aérea e braços flexionados. Use Espaço para reproduzir. Ambos substituem o clipe atual, permitem Desfazer, edição de poses, salvar projeto e exportar GLB.

As referências estudadas, decisões sobre articulações e critérios de qualidade estão em [docs/animation-principles.md](docs/animation-principles.md). Os novos geradores estão em `src/motion.js`. Os ciclos não são captura de movimento nem simulação física; a qualidade de deformação continua dependente da malha e dos pesos.

## Refinar ombros e axilas

Em **Animação → Recalcular pesos**, a aplicação recalcula o vínculo com a malha sem recriar o esqueleto ou apagar pose, keyframes e duração. Usa as articulações da pose de referência do rig ativo. Não é necessário gerar novamente o rig para aplicar a correção.

O cálculo limita a influência do úmero na região medial do ombro, trapézio e parede do tórax. O peso removido é distribuído entre peito, coluna e pescoço conforme posição e altura. O deltoide externo e o segmento distal do braço continuam acompanhando o braço; a transição é contínua e simétrica. Isso é uma aproximação anatômica, não bone-heat/voxel skinning nem pintura manual. O rig de 19 juntas ainda não tem clavículas independentes. Posição dos marcadores, topologia e roupas largas continuam influenciando o resultado.

### Visualizar pesos

Após gerar o rig, ative **Pesos** nos controles do viewport. Selecione uma articulação na malha ou na lista para ver sua influência: azul representa 0%, verde/amarelo os valores intermediários e vermelho 100%. O mapa acompanha a pose e os pesos recalculados. Desative o botão para recuperar a aparência original. As cores de inspeção não são incluídas no projeto salvo nem no GLB exportado.

### Pintar pesos

Na etapa Animação, abra **Pintura de pesos → Pintar pesos**. Selecione o osso na lista, ajuste raio e intensidade e arraste com o botão esquerdo sobre a malha. Use **Adicionar** ou **Remover**; Shift inverte a operação. O botão direito orbita a câmera. Desative Pintar pesos para voltar a posar.

O pincel tem queda suave até a borda, acumula influência enquanto o botão fica pressionado, inclusive ao passar novamente pelo mesmo vértice e mantém até quatro influências normalizadas. **Desfazer pincelada** recupera até oito pinceladas, independentemente do histórico de poses. Os pesos são preservados no projeto .riglab e no GLB exportado. Recalcular pesos ou gerar um novo rig substitui a pintura e limpa seu histórico. O raio usa a escala normalizada do editor (personagem com 2 m de altura). Esta primeira versão pinta a malha atingida, com um limite de profundidade; superfícies muito próximas na mesma malha podem receber influência. Ainda não inclui suavização entre vizinhos, espelhamento ou bloqueio de ossos.

O cursor circular mostra o raio projetado na superfície e acompanha o zoom: verde para adicionar, coral para remover. Segure o botão para acumular o efeito; intensidade maior remove mais rapidamente. Em malhas low-poly, use um raio que alcance os vértices da região: as cores dentro de cada face são interpoladas entre seus vértices.

## Publicação

Site: https://lochesystem.github.io/riglab/

Cada push em `main` executa os testes, gera o build e publica via GitHub Actions no Pages. O workflow usa Node.js 22. Localmente: `npm ci` e `npm run dev`. O build no GitHub usa a base `/riglab/`, incluindo as referências e o worker de pesos. Os modelos importados continuam sendo processados no navegador.
