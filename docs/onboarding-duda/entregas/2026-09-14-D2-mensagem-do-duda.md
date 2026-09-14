# D2 — mensagem de entrega do Duda

**Recebido em 14/09/2026**, colado no chat pelo João ("tava rodando aqui a D2, fechou já,
confere ai com tua ia"). Texto literal, sem edição.

> João, concluí a D2 na branch duda/field-api-client, commit 3adbbfb, já publicado no GitHub
> e baseado no origin/master 6693067.
>
> Implementei:
>
> - field_id como identidade estável, com fallback pelo número da OS somente para vincular
>   obras ainda sem field_id;
> - obra nova já nasce com field_id;
> - correção do número da OS pelo field_id, sem duplicar obra nem gerar alerta de sumiço;
> - ausência confirmada somente depois de duas varreduras completas e consecutivas;
> - varredura incremental nunca infere ausência;
> - falha durante a leitura interrompe antes de qualquer marcação;
> - somente obra com fonte = 'field' participa;
> - reaparecimento limpa suspeita e alerta automaticamente;
> - etiqueta e filtro na Base, mantendo a obra visível;
> - relatório com primeiras ausências, novos alertas, alertas removidos e "número da OS
>   alterado".
>
> O critério ficou documentado em criterio-ausencia-field-d2.md.
>
> A migration está em sdd-sql-obras-field-reconciliacao.sql, com:
>
> - field_id text nullable;
> - índice único parcial;
> - field_ausente_desde;
> - field_ausente_em;
> - constraints nomeadas.
>
> Não executei a migration, não acessei banco real e não fiz chamadas reais ao Field. Ela
> precisa ser aplicada antes do próximo deploy, porque a sincronização já lê essas colunas.
>
> Validação em Node 20.16.0: 309/309 testes de Obras, 13 suítes, TypeScript sem erro, lint
> sem erro e build concluído.
