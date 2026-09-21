# Passo a passo — verificar a Manfac na Meta e abrir conta na 360dialog

Escrito em 22/09/2026, para o João seguir sozinho, sem precisar de desenvolvedor nesta parte.
Base: `pesquisa-provedor-whatsapp-2026-09-21.md` (pesquisa comparando provedores) e
`2026-09-21-decisoes-camadas-3-e-4.md` decisão 3 (caminho oficial via 360dialog, Twilio como
alternativa se travar). Toda fonte usada aqui foi consultada em 22/09/2026, salvo indicação
diferente — a URL e a data estão em cada passo.

**Aviso importante encontrado nesta pesquisa, que não estava na pesquisa de 21/09:** a 360dialog
pausou temporariamente o "Partner-led Business Verification" (o caminho de verificação mais
rápido, que prometia até 48h) em 01/09/2026, enquanto revisa o processo com a Meta. Hoje só a
verificação clássica está disponível, que é a mesma que você faria direto com a Meta — não há mais
atalho de prazo por passar pela 360dialog. Fonte:
[docs.360dialog.com — PLBV](https://docs.360dialog.com/docs/resources/meta-business-verification/partner-led-business-verification-plbv-for-whatsapp),
consultado 22/09/2026. Isso não muda a decisão (360dialog ainda é o caminho certo pelo preço e
pela simplicidade), só a expectativa de prazo: trate como 2-10 dias úteis, não como 48h.

---

## 0. O que separar antes de começar

Junte tudo isso primeiro — evita ficar no meio de uma tela sem o que ela pede:

1. **Documento da empresa.** O Cartão CNPJ é o principal aceito pela Meta para empresas
   brasileiras. Tenha também o Contrato Social e, se possível, um extrato de conta bancária
   empresarial ou uma conta de luz/telefone em nome da Manfac Facilities — a Meta às vezes pede um
   segundo documento se o primeiro não for suficiente. Formatos aceitos: PDF, JPEG ou PNG, até
   10MB, documento inteiro visível (sem corte de borda) e legível, dentro da validade. **Não
   confirmei uma lista oficial única da Meta para o Brasil** — a lista acima vem de fontes de
   terceiros que cruzei entre si (Aurorainbox e Singhamandeep, ambos de 2026) mais o padrão geral
   de documentos aceitos que a própria Meta descreve (Certificate/Articles of Incorporation,
   Business Registration/License, Business Tax Registration, Business Bank Statement, Utility
   Bill) — fonte: busca sobre a Meta Business Help Center, 22/09/2026.
2. **E-mail com domínio da empresa** (ex.: `algo@manfac.com.br`), não Gmail/Hotmail pessoal — é um
   dos pontos que a documentação e as fontes citam como causa comum de reprovação ("e-mail
   genérico").
3. **Site da empresa já no ar com o nome legal da Manfac visível** — `manfac.com.br` já está no
   ar, então esse item está resolvido, mas confira que o nome que aparece no site bate exatamente
   com o nome do Cartão CNPJ (maiúsculas, acentos, tudo igual). Isso é citado repetidamente como
   causa de reprovação: "nome do negócio não corresponde exatamente ao perfil" — fonte:
   [docs.360dialog.com — Meta Business Verification](https://docs.360dialog.com/docs/resources/meta-business-verification),
   22/09/2026.
4. **Um número de telefone NOVO**, que nunca esteve em nenhum WhatsApp (nem pessoal, nem Business
   App comum) e que consiga receber SMS ou uma ligação de voz automática com um código de 6
   dígitos — é assim que a Meta confirma o número durante o cadastro. Fonte:
   [docs.360dialog.com — Embedded Signup](https://docs.360dialog.com/docs/hub/embedded-signup),
   22/09/2026.
5. **Um cartão** para o pagamento da mensalidade da 360dialog (não é cobrança da Meta direto,
   é a mensalidade do provedor — plano "Regular" a partir de €49/número/mês segundo o site oficial,
   [360dialog.com/pricing](https://www.360dialog.com/pricing), consultado 22/09/2026 — **não
   confirmei o valor exato em Reais**, câmbio muda).

---

## 1. Verificar a empresa no Meta Business Manager (Business Suite)

1. Entre em `business.facebook.com` com uma conta pessoal sua (a que vai administrar o negócio) e
   confirme que existe um Business Manager da Manfac — se não existir, crie um com o nome legal
   exato da empresa.
2. Vá em **Configurações do negócio → Segurança do negócio → Verificação do negócio** (o caminho
   exato pode variar um pouco na tela porque a Meta muda o menu com frequência — procure por
   "Business verification" se "Verificação do negócio" não aparecer).
3. Preencha: nome legal exato (igual ao Cartão CNPJ, com acentos e maiúsculas certos), endereço
   registrado, número de registro (CNPJ), telefone e site (`manfac.com.br`).
4. Envie o documento (Cartão CNPJ) e, se pedido, um segundo documento.
5. **O que costuma reprovar**, segundo os pontos que apareceram em mais de uma fonte: nome
   divergente entre o documento e o cadastro (mesmo diferença pequena de acentuação já reprova);
   site sem o nome da empresa visível; e-mail de contato genérico (Gmail/Hotmail) em vez de
   domínio próprio; documento cortado, com baixa resolução, ou vencido; documento autopreenchido
   sem selo/assinatura oficial (a Meta não aceita documento "feito em casa"). Fontes:
   [docs.360dialog.com — Meta Business Verification](https://docs.360dialog.com/docs/resources/meta-business-verification)
   e [docs.360dialog.com — PLBV](https://docs.360dialog.com/docs/resources/meta-business-verification/partner-led-business-verification-plbv-for-whatsapp),
   ambas 22/09/2026.
6. **Não consegui confirmar dentro da página oficial da Meta** (as páginas de ajuda da Meta em
   `facebook.com/business/help/...` não abriram o conteúdo completo por WebFetch — provavelmente
   exigem login) — o passo a passo acima vem da documentação da 360dialog (que é parceira oficial
   da Meta e descreve o mesmo fluxo) e de buscas cruzadas. Se uma tela pedir algo diferente do que
   está descrito aqui, siga o que a tela pedir — ela é a fonte mais atual.

---

## 2. Criar conta na 360dialog e fazer o Embedded Signup (ligar o número)

1. **Criar a conta**: entre em uma destas URLs — `https://start.360dialog.com/connect` (entrada
   geral) ou `https://app.360dialog.com/signup/direct-api` (cadastro direto, sem passar por
   parceiro). **Não consegui confirmar qual delas é hoje a entrada oficial recomendada pela
   360dialog** — as duas apareceram em fontes diferentes; se uma der erro, tente a outra. Informe
   nome da empresa, fuso horário e e-mail (use o e-mail com domínio `manfac.com.br`); a 360dialog
   manda um código por e-mail para confirmar a conta. Fonte: busca sobre criação de conta
   360dialog, 22/09/2026.
2. **Adicionar o canal**: dentro do painel (Client Hub), clique em "Add channel" na página de
   números.
3. **Escolher o plano**: selecione o plano (o "Regular" a ~€49/mês atende o volume da Manfac,
   segundo a pesquisa de 21/09) e, se for cliente de pagamento direto, cadastre o cartão nessa
   etapa.
4. **Informar o número novo** (o separado no passo 0) e dizer que ele **não está conectado a
   nenhum WhatsApp** — a tela pergunta isso explicitamente (opções: não conectado / app pessoal /
   Business App / já na Cloud API).
5. **Confirmar acesso ao Business Manager da Manfac** (login com a conta que administra o negócio
   verificado no passo 1) e aceitar os termos da Meta.
6. **Escolher os ativos**: selecionar o Business Manager da Manfac e criar (ou escolher) o WABA
   (WhatsApp Business Account).
7. **Verificar o número**: a Meta manda um código de 6 dígitos por SMS ou ligação de voz para o
   número novo — digitar o código na tela.
8. **Nome de exibição (display name)**: escolher o nome que vai aparecer para quem recebe a
   mensagem. **Regras que reprovam**, segundo a documentação da 360dialog e da própria Meta: nome
   que não bate com o nome da empresa que aparece no site (tem que ser a mesma grafia, maiúsculas
   e espaçamento); nome genérico demais sem ligação clara com "Manfac" (ex.: só "Cobrança" ou só
   "Obras" reprovaria; "Manfac" ou "Manfac Facilities" tem mais chance de aprovar por bater com o
   site); tudo em maiúsculas, emoji, slogan, preço ou URL dentro do nome; nome com menos de 3
   caracteres. Use algo como **"Manfac Facilities"**, igual ao que está escrito em
   `manfac.com.br`. Fontes:
   [docs.360dialog.com — Display Names](https://docs.360dialog.com/docs/resources/phone-numbers/display-names)
   e [Meta Business Help Center — About WhatsApp Business Display Name](https://www.facebook.com/business/help/338047025165344)
   (esta última não abriu o conteúdo completo por WebFetch, só o título — o detalhe veio da página
   da 360dialog, que cita a mesma política), ambas 22/09/2026.
9. **Revisar e confirmar o compartilhamento de dados** com a 360dialog e clicar em "Finish" — volta
   automaticamente para o painel da 360dialog com o número conectado.

Fonte do passo a passo completo (passos 1 a 9):
[docs.360dialog.com — Embedded Signup](https://docs.360dialog.com/docs/hub/embedded-signup),
consultado 22/09/2026 (a página específica "signup-step-by-step" que eu tentei primeiro estava
fora do ar — 404 — e o conteúdo acima veio da página geral, que cobre o mesmo fluxo).

---

## 3. O que NÃO fazer

- **Não instale o número novo no WhatsApp comum (app pessoal) nem no WhatsApp Business App**
  antes ou depois de registrá-lo na Meta/360dialog. Um número já ativo num desses apps não pode
  ser registrado na API do jeito simples — exige um processo extra de migração, com risco de
  perder conversa e de atraso. O número tem que chegar "virgem" na tela do passo 2.4.
- **Não use um número pessoal seu** (nem da Roberta, nem de ninguém) como o número do agente
  cobrador — tem que ser um número novo, dedicado só a isso, da empresa.
- **Não rode a verificação da Meta duas vezes ao mesmo tempo** (ex.: começar pela 360dialog e
  depois tentar de novo direto no Business Manager) — a documentação da 360dialog cita
  especificamente "requisições simultâneas" como causa de atraso. Espere terminar uma antes de
  tentar outra via.
- **Não preencha o nome da empresa "de cabeça"** — copie exatamente como está escrito no Cartão
  CNPJ, com acento e tudo, em todo campo (Business Manager, 360dialog, display name).

---

## 4. Quanto tempo cada etapa leva e como saber que terminou

| Etapa | Prazo típico | Como saber que terminou |
|---|---|---|
| Criar conta na 360dialog | Minutos | Você recebe e confirma o código por e-mail e entra no painel |
| Embedded Signup (ligar o número) | 15-30 minutos, se o número receber o SMS/ligação na hora | O número aparece "conectado" no painel da 360dialog |
| Verificação de negócio na Meta | **2 a 10 dias úteis** segundo as fontes cruzadas — pode chegar a 14 dias se faltar documento. Não há um número único garantido pela Meta | Você recebe um aviso no Business Manager (e normalmente por e-mail) dizendo que o negócio foi verificado; o status na tela de "Verificação do negócio" muda para verificado/aprovado |
| Aprovação do display name | Minutos a 24h, segundo as fontes — pode haver rejeição e precisar reenviar | O nome aparece sem aviso de pendência na tela de números da 360dialog/Meta |
| Aprovação do primeiro template de mensagem (fica para depois, é trabalho do Claude) | Minutos a 24h | Status do template muda para "aprovado" no painel |

**Não encontrei uma fonte da própria Meta com um prazo único e garantido para a verificação de
negócio** — todas as faixas acima vêm de fontes de terceiros que convergem em ordem de grandeza
(dias, não semanas) mas divergem no número exato. Trate os "2 a 10 dias úteis" como reserva de
cronograma, não como promessa.

---

## 5. O que me entregar ao final, para eu integrar

Depois que o número estiver conectado e a verificação aprovada, preciso de:

1. **A API key da 360dialog** — ela aparece no painel (Client Hub → Channels → escolher o canal/
   número → API Settings → gerar a chave). **Atenção: a chave só aparece UMA VEZ na tela** — se
   fechar sem copiar, precisa gerar outra (e isso invalida a anterior). Fonte:
   [docs.360dialog.com — API Keys](https://docs.360dialog.com/docs/hub/api-key), 22/09/2026.
2. **O número de telefone registrado** (o novo, com DDI/DDD).
3. Confirmação de que o **display name foi aprovado** (nome que ficou aprovado, exatamente como
   está escrito).

**Nunca cole a API key aqui no chat.** Assim que gerar a chave no painel da 360dialog, abra o
PowerShell no seu computador e rode o script abaixo — ele pede a chave por uma pergunta na tela
(sem mostrar de volta o que aparece no painel) e grava direto num arquivo local, sem passar pelo
chat:

```powershell
param(
    [string]$Path = "C:\Users\joao-\.360dialog-key"
)
$Value = Read-Host "Cole aqui a API key da 360dialog"
Set-Content -Path $Path -Value $Value
Write-Host "Chave salva em $Path — pode fechar esta janela."
```

Salve esse texto num arquivo `.ps1` (ex.: `salvar-chave.ps1`) e rode com `./salvar-chave.ps1`. Ele
usa `-Path` para dizer onde salvar e `-Value` (dentro do `Set-Content`) para gravar o que você
colar — depois disso, é só me avisar que salvou, e eu leio o arquivo local quando for integrar.

---

## Fontes consultadas (todas em 22/09/2026, salvo indicação diferente)

- [docs.360dialog.com/docs/hub/embedded-signup](https://docs.360dialog.com/docs/hub/embedded-signup) — passo a passo do Embedded Signup
- [docs.360dialog.com/docs/resources/meta-business-verification](https://docs.360dialog.com/docs/resources/meta-business-verification) — verificação de negócio, documentos, causas de reprovação
- [docs.360dialog.com/docs/resources/meta-business-verification/partner-led-business-verification-plbv-for-whatsapp](https://docs.360dialog.com/docs/resources/meta-business-verification/partner-led-business-verification-plbv-for-whatsapp) — PLBV pausado desde 01/09/2026, prazos, causas de atraso
- [docs.360dialog.com/docs/resources/phone-numbers/display-names](https://docs.360dialog.com/docs/resources/phone-numbers/display-names) — regras de display name, exemplos aprovados/reprovados
- [docs.360dialog.com/docs/hub/api-key](https://docs.360dialog.com/docs/hub/api-key) — onde gerar e como a chave só aparece uma vez
- [www.360dialog.com/pricing](https://www.360dialog.com/pricing) — preço (€49/número/mês no plano Regular) e URLs de cadastro
- [www.facebook.com/business/help/338047025165344](https://www.facebook.com/business/help/338047025165344) — página oficial da Meta sobre display name (só o título abriu por WebFetch, conteúdo não confirmado diretamente)
- [www.facebook.com/business/help/2058515294227817](https://www.facebook.com/business/help/2058515294227817) e
  [en-gb.facebook.com/business/help/2342133782492969](https://en-gb.facebook.com/business/help/2342133782492969) — páginas oficiais da Meta sobre verificação e reprovação (não abriram conteúdo completo por WebFetch, provavelmente por exigirem login — não usadas como fonte direta, apenas tentadas)
- Buscas cruzadas sobre documentos aceitos no Brasil e criação de conta 360dialog (Aurorainbox, Singhamandeep, Conversation24 — blogs de terceiros, 2026), usadas só onde convergiam entre si

**O que não consegui confirmar, listado num só lugar:** (1) uma lista oficial única da Meta para
documentos aceitos no Brasil — usei convergência de fontes de terceiros; (2) o prazo exato e
garantido da verificação de negócio — só faixas; (3) qual das duas URLs de cadastro da 360dialog
(`start.360dialog.com/connect` ou `app.360dialog.com/signup/direct-api`) é a entrada
oficialmente recomendada hoje; (4) o valor da mensalidade em Reais (só em Euros na fonte oficial);
(5) o conteúdo literal das páginas de ajuda da própria Meta (`facebook.com/business/help/...`) —
não renderizaram por WebFetch, provavelmente por exigirem login.
