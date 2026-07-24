# Gestão de Frotas — Track B (auditoria): checklist com evidência real

**Data:** 2026-07-24
**Status:** aprovado para plano de implementação

## Contexto

A auditoria de 16 etapas (2026-07-16/17) identificou 40 achados, triados em tracks. Track A (7 achados de código puro) já está mergeado (`ef5205d`). Este documento cobre o **Track B**: 4 achados de UX que exigiam mockup e decisão do cliente antes de codar.

- **U-02** (P0): checklist "com fotos" pode ser salvo sem nenhuma foto e sem nenhum item verificado.
- **U-03** (P0): fotos de checklist e sinistro nunca são exibidas em nenhuma tela — write-only.
- **U-05** (P1): módulo Documentos tem botão "Anexar" mas só grava a data de vencimento, sem upload de arquivo.
- **U-08** (P1): compressão de foto ausente no caminho de galeria do `CameraCapture`.

Durante o brainstorming, uma verificação à parte contra o feedback original do cliente confirmou que os 3 itens dele (oficina/substituto, novos tipos de checklist, edição de equipe) estão implementados corretamente — achou-se e já se corrigiu em commit separado (`8c03c97`) um bug não relacionado (badge "RETORNO" incorreto para os 3 tipos novos de checklist). Esse fix já está pronto para push, fora desta spec.

Um quinto ajuste, pequeno, entra aqui por estar diretamente ligado ao item 1 do feedback original do cliente ("não achei o histórico do veículo"): a correção da v04 melhorou o destino, mas não a descoberta — a placa continua sendo o único link, sinalizado só por `hover`, que não existe em toque.

## Decisões

### U-02 — checklist não pode mais ser salvo vazio

**Itens de verificação (8 itens).** Cada item passa a ter três estados: não respondido, OK, Problema. Layout aprovado: uma coluna, cada item numa linha com dois botões à direita (✓ OK / ⚠ Problema), nenhum pré-selecionado. Marcar Problema abre um campo de descrição embutido no próprio item e liga `avaria_identificada` automaticamente. O checklist só salva com os 8 itens respondidos.

*Schema:* as 8 colunas de item já são `boolean` nullable — o parser hoje colapsa `null` em `false`; passa a preservar os três estados. Nova coluna `checklist.itens_problemas jsonb not null default '{}'` (mapa item → descrição), único `alter table add column` desta spec.

**Fotos (4 de 5 obrigatórias).** Frente, Traseira, Lateral Esquerda e Lateral Direita obrigatórias em todo tipo de checklist; Interna opcional. Aplica-se a todos os 6 tipos, sem distinção — a distinção "com fotos"/"sem fotos" que o achado original presumia não existe nos tipos atuais e não será criada.

**Ordem do envio invertida.** Hoje o checklist é criado primeiro e as fotos sobem depois — se o upload falhar, o checklist fica salvo sem foto, o exato estado que este achado proíbe. Passa a ser: as 4 fotos obrigatórias sobem para o storage primeiro; o formulário envia os caminhos junto com os demais campos; o servidor só cria o registro do checklist se as 4 posições estiverem presentes, gravando tudo de uma vez. Mesma inversão aplicada ao formulário de sinistro (que tem o mesmo padrão de upload-depois-de-salvar). Esta é a parte de maior risco técnico da spec — reescreve o fluxo de submit dos dois formulários — e deve ser priorizada nos testes de implementação.

**Layout do formulário.** Permanece uma tela única com rolagem; os contadores "N de 8" e "N de 4" (já usados no botão desabilitado) dão a visibilidade de progresso sem introduzir navegação em etapas.

### U-03 — fotos passam a ser visíveis

Nova rota `app/(operacoes)/sofia/checklist/[id]/page.tsx` (server component). Layout aprovado: fotos em grade no topo (4-5, ampliáveis em tela cheia), depois os 8 itens verificados com a descrição do problema destacada, depois o bloco de registro (chave, cartão, assinatura, GPS, tipo, equipe/veículo/motorista).

Como o bucket `checklist-fotos` é privado, a página gera links assinados em lote no servidor (mesmo padrão de `app/conversor-os/_actions.ts:70`, `createSignedUrl`, adaptado para lote).

Componente `GaleriaFotos` (client), reutilizado em `sinistros/[id]/page.tsx` no lugar do texto atual `"N foto(s) anexada(s)"` (linha 29).

Cada linha da listagem `/sofia/checklist` vira link para o detalhe; o botão de exclusão permanece fora da área do link.

### U-05 — Documentos exige o arquivo

Formulário de novo documento ganha campo de arquivo (PDF ou imagem), obrigatório para novos cadastros. Sobe para o bucket `sofia-anexos` (já existe, com policy já aplicada) e grava em `documentos_veiculo.storage_path` (coluna já existe, nullable — nenhuma migração SQL necessária). Mesma inversão de ordem do checklist: sobe o arquivo antes, cria o registro depois.

Documentos já cadastrados sem arquivo continuam válidos; a listagem marca essas linhas como "sem arquivo" para indicar o que falta regularizar. Cada linha com arquivo ganha "Ver arquivo" via link assinado.

**Tipos de documento:** adiciona `"Contrato de locação"` aos 4 existentes (Seguro, Licenciamento/CRLV, IPVA, Outro). A coluna `tipo` é texto livre, sem constraint — adição é só código. Ao mesmo tempo, o mapa de rótulos hoje está duplicado e já divergente entre `documentos/novo/_form.tsx` e `documentos/page.tsx`; esta spec centraliza os 5 valores em `lib/sofia/enums.ts`, no mesmo padrão de `CHECKLIST_TIPOS`.

*Fora desta spec, anotado para revisão futura:* vincular o documento "Contrato de locação" ao campo `veiculos.km_contratual_mensal` (que já existe e já alimenta `km_excedido_desconto`) foi levantado durante o brainstorming e adiado a pedido do cliente — é ajuste novo, não parte do escopo original de Track B.

### U-08 — compressão de imagem

Nova função `comprimirImagem` em `lib/sofia/`: redimensiona o maior lado para 1600px via canvas, exporta JPEG qualidade 0.85. Aplicada nos dois caminhos do `CameraCapture` — hoje só a captura por câmera comprime (sem redimensionar); a escolha por galeria sobe o arquivo original sem nenhum tratamento. Também aplicada ao anexo de imagem em Documentos (PDF passa sem alteração).

### Ajuste adicional — descoberta do histórico do veículo (fecha item 1 do feedback original)

A tela de detalhe do veículo (`veiculos/[id]`) já expõe o histórico completo de responsabilidade, mas o único caminho até ela é clicar na placa na listagem, sinalizada apenas por `hover:text-[#f05a28]` (`veiculos/page.tsx:116`) — sem efeito em dispositivos de toque. Adiciona-se um indicador visual permanente (ex.: ícone/seta ao lado da placa) para que o link seja descobrível sem depender de hover, em qualquer dispositivo.

## Testes

- Unitários: parser tri-state dos itens, `validateChecklistInput` com as novas regras (8 itens + 4 fotos obrigatórias em todo tipo), `comprimirImagem` (dimensão de saída, redução de tamanho).
- A inversão de ordem do upload (checklist e sinistro) recebe teste de integração cobrindo o caminho de falha parcial (upload de uma foto falha → nenhum registro é criado).
- Telas novas (`checklist/[id]`, `GaleriaFotos`) seguem o padrão de teste de renderização já usado em `components/sofia/__tests__`.

## Fora de escopo (confirmado durante o brainstorming)

- Agendamento e notificação de revisões — feature nova, sem relação com os achados de Track B, fica para brainstorming próprio.
- Vínculo entre documento "Contrato de locação" e `km_contratual_mensal` — anotado acima, adiado a pedido do cliente.
- Tracks C (backend/perf, gera SQL novo) e D (2 decisões) permanecem como próximos passos separados, não fazem parte desta spec.

## O que isto custa

- **SQL para João rodar:** uma linha — `alter table checklist add column itens_problemas jsonb not null default '{}'`. Nenhuma outra migração; `documentos_veiculo.storage_path` e o bucket `sofia-anexos` já existem.
- **Tela nova:** uma — `checklist/[id]`. Sinistro e a correção de descoberta do histórico reaproveitam peças existentes.
- **Maior risco técnico:** a inversão da ordem de upload em checklist e sinistro.
- **Atrito operacional aceito conscientemente:** todo checklist, em qualquer tipo, passa a exigir 8 respostas e 4 fotos para salvar.
