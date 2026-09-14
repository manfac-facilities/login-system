# D3 — perguntas do Duda antes de começar

**Recebido em 14/09/2026**, colado no chat pelo João ("aproveita e tira as dúvidas aí da D3
quando mandar pra ela"), enquanto a D2 estava em revisão. Texto literal, sem edição.

> João, enquanto você revisa a D2, queria deixar destravada a D3.
>
> Pelo documento, ela não deve começar antes de você definir por escrito o mecanismo da
> sincronização recorrente. Precisamos fechar:
>
> 1. Qual mecanismo/agendador vai executar a sincronização?
> 2. Onde devemos persistir a marca d'água?
> 3. Como a execução sem usuário autenticará as leituras e escritas no Supabase?
> 4. Onde ficará o histórico consultável de cada execução?
> 5. Qual será a frequência e a margem de segurança da janela incremental?
> 6. O teste real da J3 já confirmou se updated_at>= aceita timestamp completo?
>
> Também vou esperar a revisão/merge da D2 e a aplicação da migration
> sdd-sql-obras-field-reconciliacao.sql antes de iniciar a D3.
>
> Com essas decisões registradas, consigo seguir sem precisar escolher arquitetura ou
> segurança por conta própria.
