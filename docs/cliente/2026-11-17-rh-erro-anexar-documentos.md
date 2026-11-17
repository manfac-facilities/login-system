# RH — erro ao anexar documentos de colaborador (17/11/2026)

Relato do Jose, repassado pelo João no chat em 17/11/2026. Texto literal:

> To tentando anexar os documentos do André vinicius ta dando esse erro ai..

O print do erro ("esse erro ai") não veio junto no chat.

## Complemento (mesmo dia)

O João mandou em seguida, literal:

> codigo do erro 3916280396

## Decisões do João depois da correção (mesmo dia), literais

> aumenta o limite para isso nao acontecer mais e me avisa que dou deploy

> outra coisa,sempre que tiver um erro o sistema tem que apontar o erro, nao dizer que feu erro e naoexplicar

## Autorização para aplicar a 018 (mesmo dia), literal

> aplica a 018 e me avisa pro deploy

Cobre: migration `018_rh_arquivos_50mb.sql` do RH (regra `rh_arquivos_tamanho_valido` para 50 MB) e o
limite da pasta `rh-arquivos` para 50 MB (`docs/rh-arquivos-pasta.md` do RH), no projeto
`iyytcavcgukfjnjjrerx`.
