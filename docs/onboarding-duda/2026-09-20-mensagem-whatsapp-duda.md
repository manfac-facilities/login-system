# Mensagem de WhatsApp para o Duda — 20/09/2026

**Estado: pronta, NÃO enviada.** O João pediu que o Claude escreva na conversa do WhatsApp com o
Duda e **pare antes de enviar**: quem revisa e clica em enviar é o João.

Não foi enviada em 20/09 porque a integração Claude in Chrome não carregou naquela sessão — o
painel `/chrome` mostrava `Status: Enabled` e `Extension: Installed`, mas as ferramentas não
chegavam à conversa, que tinha começado sem o Chrome ligado. A saída é uma sessão nova aberta com
`claude --chrome` no PowerShell.

## Como executar na sessão nova

1. Abrir o WhatsApp Web no Chrome do João (ele já está logado).
2. Abrir a conversa com o **Duda**.
3. Colar o texto abaixo **no campo de mensagem**.
4. **NÃO clicar em enviar.** Avisar o João que está pronto para ele revisar e enviar.

⚠️ Antes de mandar, o link do artefato precisa estar liberado pelo menu **Share** da página —
sem isso o Duda abre e vê "sem acesso". Lembrar o João.

## O texto

```
Fala Duda! Segue o link com tudo que rolou hoje no Controle de Obras:

https://claude.ai/artifact/1kD7FC6D1xb336SVQz1ExA

*Adotei a sua ideia do áudio* sobre organizar o projeto pra IA. Tem uma seção só respondendo cada uma das 6 sugestões: o que entrou, o que entrou por outro caminho e por quê. O mapa de arquivos, por exemplo, não foi pro CLAUDE.md — foi pra uns arquivos que só carregam quando você abre algo de obras. O arquivo principal caiu de 445 pra 200 linhas.

No link você vai encontrar:
• A resposta às suas 6 sugestões
• Os 4 arquivos que valem pra sua frente, com link direto
• Os 15 problemas que a revisão de código achou (3 perdendo dado agora)
• A *nova divisão de trabalho* entre eu e você, com tempo e estimativa de token de cada tarefa

Dividi por arquivo, não por tamanho: você fica com sincronização, Field, diário e tarefas; eu fico com a ficha da obra. Assim a gente trabalha junto sem um pisar no arquivo do outro.

Antes de começar dá um *git pull*, subiu tudo hoje.

Estamos na reta final: *entrega dia 28*. Os 2 primeiros da sua lista são os que mais pesam, começa por eles. Qualquer coisa me chama!
```

No WhatsApp, `*texto*` vira negrito.
