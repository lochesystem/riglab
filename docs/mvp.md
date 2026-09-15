# Consolidação do MVP

## Escopo aceito

Importar humanoide GLB sem rig → ajustar juntas → gerar pesos → corrigir pintura → posar/animar → salvar/recuperar → exportar GLB.

## Critérios e evidências

- Recuperação: cópia IndexedDB a cada 5 s de edição em repouso, recuperação explícita após recarga e preservação do backup enquanto a escolha está pendente. Conferido manualmente com rig e aceno de cinco poses; coberto na suíte de navegador.
- Persistência: abertura valida pesos antes de trocar a cena e reutiliza pesos pintados. Teste de projeto inválido deve preservar pose e keyframes atuais.
- Pintura: adicionar/remover contínuo, suavizar pela topologia, pesos protegidos, quatro influências normalizadas, raio visível, teste de oclusão e espelhamento exato na mesma malha. Sem adivinhação de correspondências em roupas assimétricas.
- Exportação: três fixtures sintéticas (padrão, larga, estreita/T-pose), GLTFExporter → GLTFLoader, preservando os pesos pintados, as 19 juntas e o clipe. Não equivalem a uma avaliação artística de personagens reais.
- Interação: marcador de tempo arrastável, keyframes independentes e suspensão da câmera durante gizmos/pincel.
- Publicação: testes de navegador e numéricos bloqueiam o deploy em falhas.

## Avaliação da deformação e clavículas

O rig atual de 19 juntas mantém compatibilidade com os projetos existentes. Os testes verificam a proteção do trapézio/axila, influência distal do braço, simetria e continuidade dos pesos. A correção manual e a suavização são o caminho suportado quando a distribuição automática não atende ao modelo.

Clavículas independentes exigem uma versão de esqueleto com migração de índices, pesos, poses, geradores e arquivos existentes. Não foram inseridas silenciosamente nesta consolidação. Continuam sendo uma evolução a avaliar com movimentos acima da cabeça e elevação dos ombros; o solver atual não garante deformação anatômica em poses extremas.

## Limites para lançamento

- Testar artisticamente um conjunto de GLBs reais com proporções, roupas e topologias distintas continua necessário antes de anunciar qualidade universal. Fixtures sintéticas e testes de integridade não substituem essa revisão.
- Espelhamento não corresponde vértices entre meshes separados nem formas assimétricas.
- O filtro de visibilidade e a suavização precisam ser avaliados em máquinas modestas com modelos próximos ao limite de 200 mil vértices.
- Recuperação local depende do armazenamento do navegador; não é backup em nuvem e não resolve edição simultânea em múltiplas abas.
- Sem dedos, face, retargeting, física de roupas ou vários clipes neste MVP.


### Validação com Orc e Elf

O ajuste dos marcadores é específico de cada modelo e fica salvo no projeto. Falhas de persistência e de gestos são corrigidas no aplicativo; não devem exigir reparos por personagem.

- Texturas importadas são exportadas como PNG, evitando recompressão JPEG a cada salvamento/reabertura. Isso aumenta o tamanho de projetos e GLBs texturizados.
- A restrição experimental abaixo da axila foi retirada após provocar influência excessiva do tronco na superfície dos braços. O cálculo anterior foi restaurado; a proteção adicional do colete do Orc permanece pendente. Projetos existentes conservam os pesos salvos; use **Recalcular pesos** para aplicar o cálculo restaurado, substituindo a pintura anterior.
- O clique num keyframe tolera até 5 pixels antes de iniciar o arraste. O campo de tempo permite navegar por quadro mesmo em clipes densos, como idle. A timeline ainda não possui zoom para separar todos os losangos de clipes longos.
- O ajuste automático não identifica semanticamente roupa, armadura ou músculos. Ombros sem clavículas independentes e contato da mão com a cintura ainda podem precisar de acabamento por modelo. Não se considera a validação numérica uma aprovação artística de todas as poses.

Os arquivos pessoais usados na validação ficam fora do repositório público. Testes com vértices reais da demonstração verificam que as mangas acompanham os braços; outros testes cobrem o ciclo importar JPEG → salvar/reabrir repetidamente → exportar, comparando pixels decodificados.


### Painel contextual

Na etapa Animação, a lateral direita usa abas Pose, Animações e Pesos. O seletor de animação exibe os parâmetros de um movimento por vez. Pintura avançada e recálculo ficam em grupos recolhíveis. Os canais de transformação ficam em uma seção inferior independente, que também pode ser recolhida para liberar espaço. A rolagem, quando necessária em janelas baixas ou grupos abertos, fica restrita ao conteúdo da aba. Sair da aba Pesos encerra o pincel ativo; a visualização dos pesos continua controlada pelo botão Pesos no viewport.

Referências de organização: [Blender Properties](https://docs.blender.org/manual/id/5.0/editors/properties_editor.html), [ZBrush palettes](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/interface-overview/interface-overview.html) e [Maya Attribute Editor / Channel Box](https://help.autodesk.com/cloudhelp/2023/ENU/Maya-Basics/files/GUID-67A58D31-4722-4769-B3E6-1A35B5B53BED.htm).
