# Frotas — resumo da manhã (04/11/2026)

## O que ficou pronto de madrugada

Terceira bateria inteira, no `master`: revisão a cada 10 mil km + importação da planilha, manutenção corretiva,
bases de Revisões/Corretiva/Multas/Sinistros/Documentos com Exportar Excel, multa por etapas (só admin autoriza),
Pendências B8, Descontos no fluxo novo, boleto de multa contestada, fotos extras (até 30) e avaria, histórico e
comparação do checklist, exclusão de checklist/sinistro só admin, foto imutável.

Revisões independentes (todas commitadas em `docs/frotas/`): SQL manutenção (aprovado), SQL multa (2 bloqueantes →
corrigidos), código manutenção, código multa, Descontos+checklist, integração final — todas aprovadas; não
bloqueantes corrigidos ou em `docs/DIVIDAS.md`.

Manual (rascunho, para aprovar): https://claude.ai/artifact/PNZT6LYNX6YqRhVfji1MNy — mensagem de WhatsApp em
`docs/frotas/2026-11-04-mensagem-cliente-whatsapp.md`. Roteiro de conferência: `docs/frotas/2026-11-04-roteiro-conferencia-pos-deploy.md`.

## O que falta — nesta ordem

1. **Autorização escrita para o banco** (a trava exige citar os arquivos):
   > autorizo aplicar em produção sdd-sql-sofia-manutencao.sql e sdd-sql-sofia-multa-avaria.sql (com os testes)
2. **Eu aplico os dois SQL** (verificação 22/22 e 24 OK + AVISO; testes 30/30 e 51/51, rollback forçado).
3. **Logo em seguida, João clica Deploy** no EasyPanel (`manfac-login-system`). Entre o SQL de multa e o deploy, a
   tela de multas/Descontos do app antigo fica instável — por isso um logo depois do outro.
   Antes do Deploy, colar `SOFIA_ALERTAS_SECRET` (valor em `C:\Users\joao-\.sofia-alertas-secret`) no Environment.
4. **Eu confiro** os chunks (Last-Modified) e sigo o roteiro de conferência.
5. **Vault + cron do e-mail diário:** a trava barrou a gravação no Vault. Ou você autoriza por escrito
   ("autorizo gravar SOFIA_ALERTAS_SECRET no Vault e aplicar sdd-sql-sofia-alertas-cron.sql"), ou roda no SQL Editor:
   `select vault.create_secret('<conteúdo do arquivo>', 'SOFIA_ALERTAS_SECRET');` — depois eu aplico o cron.
6. **Aprovar o manual e mandar a mensagem** ao José (só depois do deploy: ela diz "entrou hoje").

## Decisões suas

1. **3 multas já "autorizado"** (pedidas e autorizadas em 03/11, sem registro de quem autorizou). Pela regra nova o
   gestor as desconta sem passar pelo admin. Recomendo voltar para "solicitado" e o admin reautorizar (1 clique cada).
2. **José recebe o e-mail diário?** Hoje só o Igor (`sofia_gestores`).
3. **Registrar/desfazer desconto em Descontos:** a spec mandava deixar só dentro da multa; mantive em Descontos
   também, pelo fluxo novo (seguro). Se preferir só na multa, é pequeno.

## Para o cliente (vai na mensagem)

- Planilha real de revisões do Igor, para conferir as colunas antes da primeira importação.
- Igor avançar as multas já indicadas fora do sistema (senão aparecem como "prazo vencido" em Pendências).
- Conferir o carro EWH1B84: está "em manutenção" e com equipe preenchida.
