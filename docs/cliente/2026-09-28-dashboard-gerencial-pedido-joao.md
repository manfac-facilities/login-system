# Dashboard gerencial — pedido do João (28/09/2026), literal

Mensagem do João no chat, 28/09/2026, depois do mockup D6 do Duda
(https://claude.ai/artifact/WN7Bp4VDmM34PiNPuSNLUZ). Substitui as escolhas daquele mockup.

> prioriza o dashboard, coloca no ar ate amanha
>
> quem usa - tds usuarios do controle de obras
>
> não precisa tela pra cliente, só 1 tela interna
>
> as informações precisam ser mais gerenciais e de tomada de decisão
>
> o cronograma precisa ter uma visão de gantt, uma lista obra a obra
>
> quanto faturamos de cada cliente, quanto tem de pendente faturamento ainda
>
> SLA do pendente faturamento, qual a media, qual pior caso
>
> SLA de aprovação de OS após liberação pra executar, qual a media, qual o pior caso
>
> Quanto de R$ foi executado por equipe
>
> Quantos dias cada equipe gastou em cada obra, qual total do mês, qual equipe gerou mais receita (ranking)
>
>
> qual equipe teve melhor produtividade? = Receita / Dias Trabalhados
>
> Quais obras estão paradas e porque?
>
> só abre a "lista detalhada" se clicar... aqui mostra qtd e valor em cada tipo de pendencia ou status
>
> Visão Geral Historica de faturamento mês a mês e acumulado do ano
>
> Todas essas informações, precisam ter o filtro geral ou por cliente (dpsp, d1000, popeyes etc) os clientes la cadastrados

## Complemento, mesma conversa (28/09/2026), literal

> Obras que foram remarcadas ou atrasaram, do total das obras em andamento quantos % ta atrasado?
>
> Meta de carteira de obras: xxx
> Meta de faturamento de obras: yyy
>
> A meta é por cliente, mas se filtrar todos soma as metas
>
> Carteira de obras = tudo que ta com a gente pra iniciar, em andamento, pendente faturamento
>
> Faturamento = td que foi efetivamente faturado, teve NF emitida
>
> Mes a mes
>
> Ai compara se cresceu ou diminui em relação ao mesmo período anterior
>
> DPSP
> Meta carteira: 600K
> Meta faturamento: 350K
>
> D1000
> Meta carteira: 80K
> Meta faturamento: 60K
>
> Os outros clientes sao obras pontuais, ai nao tem como colocar meta neles

## Retorno do cliente repassado pelo João (28/09/2026), literal

> Ele gostou dessa tela

Anexo: `2026-09-28-dashboard-gerencial-anexos/01-cliente-gostou-ritmo-do-campo.png` — seção "Ritmo do campo
e respostas" do mockup D6 (Diário de hoje: Responderam / Não andou / Com foto; Tarefas: Abertas /
Vencidas / Respondidas).

> E falou que usa essa para ter esse status que gostaria de levar a um dashboard

Anexo: `2026-09-28-dashboard-gerencial-anexos/02-planilha-resumo-status-geral.png` — tabela dinâmica
"RESUMO STATUS GERAL" da planilha: STATUS MANFAC × SUM de VALOR TOTAL.
Transcrição: EXECUTADO - APROVAR OS R$ 134.703,91; EXECUTAR R$ 215.854,86; EXECUTAR - APROVAR OS
R$ 54.170,16; FECHAR OS R$ 111.296,73; PENDENTE FATURAMENTO R$ 378.051,10; Total geral R$ 894.076,76.

## Fatos verificados pelo coordenador (28/09/2026)

- `obras_obra.valor` existe no schema, mas **nenhum código grava** (sync não traz, ficha não edita).
- API do Field: nas 100 OS "Atividade Spot" mais recentes (de 269), **0 têm `totalValue` > 0**.
  O valor em R$ hoje só existe na planilha do cliente ("VALOR TOTAL").
- Na mesma amostra há 4 clientes: 85 OS de um (DPSP), 13 de outro (D1000), 1 de cada um de outros dois.
- `obras_obra` **não tem coluna de cliente**; a sincronização filtra só pelo tipo de OS.
