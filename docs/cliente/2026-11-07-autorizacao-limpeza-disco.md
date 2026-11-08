# Autorização do João: limpeza de disco (07/11/2026)

Texto literal, no chat:

> Claude, eu estou deixando autorizado aqui agora para você, caso o sistema pare por conta de SSD, memória cheia, você pode limpar o SSD, nada que vai afetar nenhum projeto do Claude. Né?

## Como interpretei (limite)

Só apago o que se recria sozinho e não é fonte de nenhum projeto:
- cache do npm (`npm-cache`), cache de build `.next/cache`;
- arquivos temporários antigos em `%LOCALAPPDATA%\Temp`, fora da pasta da sessão em uso;
- `node_modules` de worktrees em `D:\rh-work` cujas branches já estão no GitHub (reinstaláveis).

Nunca: código, `.git`, branch não enviada, arquivos de cliente, Downloads, Documentos, área de trabalho, segredos.
