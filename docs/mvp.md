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
