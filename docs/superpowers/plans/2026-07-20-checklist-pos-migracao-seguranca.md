# Checklist pós-migração de segurança

Depois de rodar `sdd-sql-v04-seguranca.sql` no Supabase e fazer deploy do código:

1. Logar como usuário SEM acesso ao sistema "sofia" no Hub — confirmar que `/sofia/*` redireciona pro dashboard.
2. Logar como usuário COM acesso mas SEM ser admin — confirmar que autorizar/registrar desconto de multa dá erro "Apenas administradores...".
3. Logar como admin — confirmar que autorizar desconto continua funcionando normalmente.
4. Abrir `/sofia/audit` — confirmar que aparecem entradas recentes (criação/exclusão de multa, etc.).
5. Testar o DevTools: com usuário sem acesso ao sofia, tentar `supabase.from('multas').select('*')` no console — deve retornar vazio/erro (RLS bloqueando).
