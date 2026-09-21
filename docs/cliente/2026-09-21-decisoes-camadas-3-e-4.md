# Decisões do João — camadas 3 e 4 do Controle de Obras — 21/09/2026

Base: `docs/cliente/2026-08-31-sistema-controle-de-obras/levantamento-camadas-3-4-2026-09-21.md`.
Perguntas feitas pelo Claude em 21/09, respostas do João escolhidas entre opções:

1. **Prioridade até 28/09: camada 4 primeiro.** Motivo apresentado: só depende da Manfac; a
   camada 3 depende de provedor de WhatsApp (verificação na Meta, aprovação de modelo) e de
   telefones que ninguém cadastrou. Em paralelo, levantar o provedor da camada 3, sem código.

2. **A camada 4 ("dashboard e relatórios de reunião", José Guilherme, 31/08) É a visão do dono
   da Pacheco** — o mockup publicado em 18/09
   (`docs/cliente/2026-09-18-mockup-visao-do-dono-da-pacheco.md`). Não é reunião Manfac×DPSP nem
   reunião interna. Consequência: não há tela nova a desenhar para a camada 4; ela depende do
   retorno do cliente sobre aquele mockup, sem resposta desde 18/09.

3. **Camada 3: caminho oficial agora + ponte até 28/09.** Base:
   `docs/cliente/2026-08-31-sistema-controle-de-obras/pesquisa-provedor-whatsapp-2026-09-21.md`.
   - João inicia hoje a verificação da empresa na Meta via BSP oficial (360dialog recomendada;
     Twilio como alternativa). Caminho não oficial (Z-API/Evolution) descartado por risco de
     banimento. Prazo realista do envio automático: 2-3 semanas.
   - Até 28/09, uma **ponte**: tela "cobranças do dia" com um botão por pessoa que abre o
     WhatsApp já com a mensagem escrita; alguém clica e envia. Vira automático quando o provedor
     estiver pronto. Mockup antes de código.

4. **Ponte — quem opera: o responsável de cada obra** (PCM). Cada um cobra as faltas das
   próprias obras: abre a tela, clica, envia do próprio WhatsApp e registra a resposta na tarefa.

5. **Ponte — telefones: nenhum cadastro agora.** O botão abre o WhatsApp com a mensagem pronta e
   a pessoa escolhe o contato na própria agenda (`wa.me/?text=`). Sem mudança de schema. O
   cadastro de telefones fica para o caminho oficial.
