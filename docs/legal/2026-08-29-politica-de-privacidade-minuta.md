# Política de Privacidade — manfac.com.br (MINUTA)

> **Status: minuta.** Escrita em 29/08/2026 a partir da leitura do código do site
> (`manfac-site/`) e do SQL da tabela `site_leads`. Cada afirmação abaixo corresponde a
> algo que o código comprovadamente faz. Onde falta informação da empresa, há um marcador
> «PENDENTE: ...» — a página **não pode ser publicada** enquanto houver marcador no texto.
> A lista completa dos pendentes está no fim, em "Notas para o João".

---

## Política de Privacidade

### 1. Quem é responsável pelos seus dados

O site **manfac.com.br** é operado por «PENDENTE: razão social», inscrita no CNPJ
«PENDENTE: CNPJ», com endereço em «PENDENTE: endereço». Ao longo deste texto usamos
apenas "Manfac".

A Manfac é a **controladora** dos dados pessoais coletados neste site — ou seja, é quem
decide quais dados são coletados e para quê. Esta política segue a Lei Geral de Proteção
de Dados (Lei nº 13.709/2018, a LGPD).

### 2. O que este site coleta — e o que ele não coleta

**O site só coleta dados em um lugar: o formulário da página de contato.** Navegar pelo
site, ler as páginas de serviços, ver os resultados ou clicar nos botões de WhatsApp não
faz o site guardar nada sobre você.

Especificamente, este site **não** tem:

- Google Analytics, Google Tag Manager, pixel do Facebook/Meta, Hotjar, ou qualquer
  ferramenta de medição de audiência;
- cookies próprios ou de terceiros — nenhum. Por isso não existe (nem é necessário) um
  banner de cookies;
- scripts de terceiros carregados no seu navegador. As fontes de texto são baixadas no
  momento em que o site é compilado e servidas pelo próprio manfac.com.br, e não pelo
  servidor de outra empresa;
- qualquer registro de endereço IP, navegador ou páginas visitadas dentro do banco de
  dados da Manfac.

### 3. Os dados que você informa no formulário de contato

O formulário tem duas etapas.

**Etapa 1 — obrigatória.** Sem estes campos o formulário não avança:

| Dado | O que é | Para que serve |
|---|---|---|
| Tipo de demanda | Uma entre "Manutenção recorrente", "Obra ou reforma" e "Avaliação técnica" | Direcionar sua solicitação à pessoa certa do time |
| Nome | O nome que você digita | Saber com quem estamos falando ao responder |
| E-mail | Seu e-mail | Responder à sua solicitação |
| Telefone / WhatsApp | Seu telefone com DDD | Responder à sua solicitação |
| Aceite do consentimento | O fato de você ter marcado a caixa, a data e a hora exatas do aceite, e o texto exato que estava escrito ao lado da caixa naquele momento | Provar que a autorização existiu e a que texto ela se referia |

**Etapa 2 — opcional.** Você pode preencher ou clicar em "Pular e falar agora". Nada aqui
é obrigatório:

| Dado | O que é | Para que serve |
|---|---|---|
| Empresa | Nome da empresa onde você trabalha | Entender o contexto antes do primeiro contato |
| Cargo | Sua função | Entender o contexto antes do primeiro contato |
| Localidade das unidades | Onde ficam os imóveis da sua operação | Avaliar se atendemos a região |
| Nº de unidades | Faixa de quantidade (só aparece para manutenção recorrente) | Dimensionar a proposta |
| Resumo da demanda | Texto livre que você escreve | Preparar a resposta antes de falar com você |

**Um ponto que merece destaque:** os dados da Etapa 1 são gravados no nosso banco assim
que você clica em "Continuar" — antes da Etapa 2 e antes de qualquer mensagem no
WhatsApp. Se você preencher a Etapa 1 e fechar a página em seguida, esses dados já estão
conosco.

**Sobre o campo "Resumo da demanda":** ele é livre. Peça-se que você não escreva ali
dados sensíveis (saúde, religião, opinião política, biometria) nem dados de outras
pessoas. O site não pede nem precisa dessas informações, e a Manfac não os solicita em
nenhum momento.

**Menores de idade:** o formulário é dirigido a contatos profissionais e não se destina a
menores de 18 anos.

**Campo antisspam:** o formulário tem um campo escondido que pessoas não veem nem
preenchem, e que serve apenas para identificar robôs. Ele não coleta nenhuma informação
sua.

### 4. Com que base legal tratamos esses dados

**O tratamento é feito com base no seu consentimento** (LGPD, art. 7º, inciso I). Antes de
enviar, você precisa marcar uma caixa com o seguinte texto — e o formulário não avança sem
isso:

> «PENDENTE: substituir pelo texto de consentimento vigente na data da publicação.
> Hoje o texto é: "Autorizo a Manfac Engenharia a usar meus dados de contato para
> responder a esta solicitação." Ver item (b) das Notas para o João.»

Guardamos, junto com o seu registro, **o texto exato que você aceitou** e a data e hora do
aceite. Se algum dia mudarmos esse texto, o seu registro continua apontando para aquilo
que você de fato autorizou, não para a versão nova.

**Você pode retirar o consentimento a qualquer momento**, pelos canais do item 8. Retirar o
consentimento interrompe o uso dos dados daí em diante e não invalida o que já foi feito
enquanto ele valia.

### 5. Para onde os seus dados vão

**Nós não vendemos os seus dados e não os usamos para publicidade.** Eles vão apenas para
os lugares necessários ao atendimento:

**a) Supabase (banco de dados) — operador, com servidor nos Estados Unidos.**
Os dados do formulário são gravados em um banco hospedado pela Supabase, em servidor
localizado nos **Estados Unidos**. Isso caracteriza **transferência internacional de
dados** (LGPD, arts. 33 e seguintes) e acontece com base no consentimento que você dá ao
enviar o formulário. A Supabase atua como **operadora**: trata os dados a nosso pedido e
segundo as nossas instruções, não para finalidades próprias.

**b) WhatsApp / Meta.**
Ao concluir o formulário, o site abre o WhatsApp com uma mensagem já escrita, contendo o
que você preencheu — tipo de demanda, nome, cargo, empresa, e-mail, telefone, localidade,
número de unidades e o resumo, conforme o que você tiver informado. Duas consequências que
você deve conhecer:

- para montar essa mensagem, o seu navegador é levado a um endereço do WhatsApp
  (`wa.me`), serviço da Meta, **com esses dados no próprio endereço**;
- a mensagem só é efetivamente enviada quando **você** aperta enviar no seu WhatsApp. A
  conversa a partir daí é tratada pelo WhatsApp e sujeita à política de privacidade da
  Meta, sobre a qual a Manfac não tem controle.

Os botões de WhatsApp espalhados pelo site (o flutuante e os das páginas de serviço)
funcionam do mesmo jeito, com uma mensagem genérica: eles não passam pelo nosso banco e o
único dado seu envolvido é o seu próprio número, visível para nós quando você escreve.

**c) Equipe interna da Manfac.**
Os registros do formulário são lidos por pessoas da Manfac em um sistema interno, protegido
por login, acessível apenas a contas de e-mail corporativo `@manfac.com.br` que tenham
autorização específica para essa área. A tela mostra os registros mais recentes, do mais
novo para o mais antigo.

**d) Autoridades.**
Podemos fornecer dados quando houver obrigação legal ou ordem de autoridade competente.

### 6. Por quanto tempo guardamos

Guardamos o registro do seu contato **enquanto durar o interesse comercial que ele
originou e enquanto for necessário para comprovar a existência do seu consentimento**.

Sendo transparentes: **hoje não existe uma rotina automática que apague registros antigos.**
Um registro só sai do nosso banco quando alguém da Manfac o exclui — inclusive a pedido
seu, conforme o item 8. Se e quando adotarmos um prazo fixo de descarte, esta política será
atualizada e a data de vigência, alterada.

### 7. Os seus direitos

A LGPD (art. 18) garante a você o direito de, a qualquer momento:

- **confirmar** se tratamos dados seus e **acessar** esses dados;
- **corrigir** dados incompletos, desatualizados ou errados;
- pedir a **anonimização, o bloqueio ou a eliminação** de dados desnecessários ou tratados
  fora da lei;
- pedir a **portabilidade** dos dados a outro fornecedor;
- pedir a **eliminação** dos dados tratados com base no seu consentimento;
- saber **com quem compartilhamos** os seus dados;
- ser informado sobre a possibilidade de **não consentir** e sobre o que acontece se você
  recusar — no caso deste site, a recusa significa apenas que o formulário não é enviado, e
  você pode falar com a gente por WhatsApp, telefone ou e-mail do mesmo jeito;
- **revogar o consentimento**.

Nenhuma decisão sobre você é tomada de forma automatizada neste site: não há pontuação
automática de leads, nem perfilamento, nem decisão feita por sistema sem gente no meio.

### 8. Como exercer os seus direitos

Escreva para o nosso encarregado de proteção de dados (DPO):

- **E-mail:** «PENDENTE: e-mail do encarregado»
- **Encarregado:** «PENDENTE: nome do encarregado»

Você também pode usar o e-mail geral **contato@manfac.com.br** ou o WhatsApp comercial
**(21) 98428-0058**, e o pedido será encaminhado ao encarregado.

Para atender ao pedido, podemos precisar de informações que confirmem que você é mesmo a
pessoa titular daqueles dados — normalmente, o e-mail ou o telefone usados no formulário.

### 9. Segurança

O que efetivamente fazemos hoje para proteger esses dados:

- o site é servido por conexão criptografada (HTTPS);
- a tabela onde ficam os registros do formulário **não é acessível pelo navegador de
  ninguém**: ela não tem nenhuma regra de leitura ou escrita pública, e todo acesso passa
  por credencial de servidor que nunca chega ao seu navegador;
- o acesso da equipe aos registros exige login e autorização específica, restrita a contas
  de e-mail corporativo da Manfac;
- o site envia cabeçalhos de segurança que impedem que ele seja embutido em outro site,
  restringem de onde podem vir scripts e estilos, e bloqueiam por padrão o uso de câmera,
  microfone e localização;
- os campos do formulário têm limite de tamanho, e o envio é validado no servidor, não
  apenas no navegador;
- os registros técnicos de erro do sistema guardam a mensagem da falha, não o conteúdo do
  que você digitou.

Nenhum sistema é 100% seguro, e não prometemos que seja. Se ocorrer um incidente de
segurança com risco relevante a você, comunicaremos você e a ANPD, conforme o art. 48 da
LGPD.

### 10. Cookies

**Este site não usa cookies** — nem próprios, nem de terceiros, nem de análise, nem de
publicidade. Não há nada para você aceitar ou recusar nesse tema.

Se isso mudar, esta política será atualizada antes da mudança entrar no ar, e um aviso de
cookies passará a aparecer.

### 11. Mudanças nesta política

Podemos alterar esta política. Quando isso acontecer, a data de vigência abaixo muda. Se a
alteração afetar o que fazemos com dados já coletados, avisaremos pelos canais de contato
que você nos informou.

### 12. Vigência

Esta política vale a partir de «PENDENTE: data de publicação da página».

---

## Notas para o João

### (a) O que precisa ser pedido ao cliente antes de publicar

A página **não vai ao ar** com nenhum destes em aberto:

1. **«PENDENTE: razão social»** — nome empresarial completo, como está no contrato social.
   O site hoje escreve "Manfac Engenharia" em todo lugar, que é nome fantasia. Numa política
   de privacidade, quem responde é a pessoa jurídica.
2. **«PENDENTE: CNPJ»**.
3. **«PENDENTE: endereço»** — endereço completo da sede. Já é o mesmo pendente que tirou o
   bloco do mapa da página de contato (commit `86ddc72`), então é um pedido só, que resolve
   duas coisas.
4. **«PENDENTE: e-mail do encarregado»** e **«PENDENTE: nome do encarregado»** — a LGPD
   (art. 41) exige que o controlador indique um encarregado e divulgue publicamente o
   contato dele. Não precisa ser um profissional externo: pode ser alguém da própria
   Manfac, desde que nomeado. Se o cliente não quiser criar um endereço novo, o mínimo é
   um alias tipo `privacidade@manfac.com.br` apontando para quem for designado — mas
   **não escrevi esse endereço na minuta**, porque ele não existe hoje e política de
   privacidade com e-mail que devolve erro é pior que não ter política.
5. **«PENDENTE: data de publicação da página»** — trivial, mas precisa ser a data real de
   publicação, não a de hoje.
6. **Decisão da empresa (não é dado, é escolha):** existe prazo de descarte dos leads?
   Hoje não existe nenhum, e a minuta diz isso honestamente. Se o cliente quiser prometer
   um prazo, aí vira código: alguém tem que apagar de fato. Recomendação: publicar sem
   prazo agora (é a verdade) e tratar o descarte como frente separada, com rotina real,
   antes de prometer qualquer número.

Ponto que não é pendente, mas é decisão de layout: **o rodapé do site não tem link para
política nenhuma hoje.** Publicar a página sem linkar do rodapé e do formulário é
publicar para ninguém.

### (b) O `TEXTO_CONSENTIMENTO` precisa mudar?

**Precisa, sim — por dois motivos, e ambos são de conteúdo, não de estilo.**

**Motivo 1 — ele não aponta para lugar nenhum.** O art. 9º da LGPD exige que o titular seja
informado, de forma clara, sobre finalidade, controlador e como exercer seus direitos,
*antes* de consentir. Hoje o texto informa a finalidade ("responder a esta solicitação"),
o que já é bom, mas não dá caminho para o resto. Quando a política existir, o link é o que
transforma "aceitei uma frase" em "consenti informado".

**Motivo 2, e este é o mais concreto — o texto fala em "dados de contato", mas a Etapa 2
coleta coisas que não são dados de contato.** Empresa, cargo, localidade, número de unidades
e o resumo livre da demanda não cabem em "dados de contato" por nenhuma leitura razoável. E o
consentimento é colhido na Etapa 1, *antes* de a Etapa 2 sequer aparecer na tela. Ou seja:
hoje gravamos cinco campos sob a cobertura de um texto que não os menciona. Isso é uma
lacuna real, não um preciosismo.

**Redação mínima que eu recomendo** — mantém o espírito curto que você aprovou em 21/08,
não acrescenta nenhuma promessa nova, e corrige as duas coisas:

> Autorizo a Manfac Engenharia a usar os dados que eu informar aqui para responder a esta
> solicitação, conforme a Política de Privacidade.

Com "Política de Privacidade" como link para a página. Três observações sobre a troca:

- **Continua sem promessa nova.** Não diz prazo, não diz "não compartilhamos", não diz
  criptografia. Só amplia "dados de contato" → "os dados que eu informar aqui", que é o que
  de fato acontece, e liga ao documento que explica o resto.
- **A troca é segura para os leads antigos.** A coluna `consentimento_texto` guarda o texto
  vigente no momento de cada aceite (é exatamente para isso que ela existe, conforme o
  comentário no `sdd-sql-site-leads.sql`). Quem consentiu com o texto velho continua
  apontando para o texto velho. Não há retrabalho de dado histórico.
- **Cuidado de implementação:** hoje o `TEXTO_CONSENTIMENTO` é uma string única, renderizada
  crua dentro de um `<span>` no `ContactForm.tsx`. Para ter link, ou o texto vira dois
  pedaços (texto + `<a>`), ou vira JSX. Não dá para meter HTML na constante e esperar que
  renderize — ela é interpolada como texto. É uma mudança pequena, mas é mudança de código,
  não só de string, e mexe no arquivo que grava o valor no banco. Vale um teste que garanta
  que o que é gravado em `consentimento_texto` é igual ao que está escrito na tela.

### (c) Coisas que o código faz e que a política tem obrigação de revelar

Estas foram as que eu achei lendo o código e que passariam batido em qualquer modelo
genérico de política:

1. **O lead é gravado no clique de "Continuar", não no fim.** Quem preenche nome, e-mail e
   telefone e some já está no banco. A tela não diz isso em lugar nenhum — o rótulo do botão
   sugere que nada aconteceu ainda. Está no item 3 da minuta, com destaque. Se você quiser
   ir além, o lugar certo é a UI, não a política.
2. **Os dados viajam na URL até um domínio da Meta.** O `buildWhatsAppUrl` monta
   `wa.me/...?text=<nome, e-mail, telefone, empresa, cargo, resumo>`. Mesmo que a pessoa
   nunca aperte enviar no WhatsApp, o navegador dela já foi a um endereço da Meta carregando
   esse conteúdo. Isso é compartilhamento, e omitir seria omissão relevante. Está no item 5b.
3. **Servidor nos Estados Unidos = transferência internacional.** O Supabase de produção
   está em `us-east-1`. A LGPD trata isso em capítulo próprio, e a base aqui é o
   consentimento. Modelo genérico de política brasileira quase nunca menciona isso. Está no
   item 5a.
4. **Nenhum registro é apagado hoje.** Não há cron, não há trigger, não há coluna de
   expiração. Preferi escrever a verdade a copiar o "guardamos pelo tempo necessário" que
   todo mundo escreve e ninguém cumpre. Ver item 6 e o pendente 6 acima.
5. **O `resumo` é campo livre, e campo livre acaba recebendo dado de terceiro.** "Meu
   síndico fulano, telefone tal, reclamou de..." é o tipo de coisa que aparece. A minuta
   pede explicitamente que não se escreva dado sensível nem de terceiro ali. É o mínimo que
   dá para fazer sem mudar o produto.
6. **O que o site NÃO faz é tão relevante quanto o que faz — e é uma vantagem.** Zero
   cookies, zero analytics, zero scripts de terceiros, fontes servidas do próprio domínio,
   nenhum IP gravado. Isso é raro e vale afirmar de frente (item 2 e item 10): elimina a
   necessidade de banner de cookies, que é o item que mais gera atrito e mais gera
   política mentirosa por aí.
7. **Só uma coisa eu não consegui verificar pelo código:** os registros do servidor que
   hospeda o site (o proxy do EasyPanel/VPS) podem guardar IPs de acesso por padrão, e isso
   está fora do repositório. **Não escrevi nada sobre isso na minuta**, porque afirmar que
   guardamos ou que não guardamos seria chute nos dois sentidos. Antes de publicar, vale
   conferir no painel se há log de acesso com IP e por quanto tempo ele é retido — se
   houver, entra um parágrafo curto no item 2.
8. **A UI promete "Resposta em até 1 dia útil"** em dois lugares do formulário. Não é
   assunto de privacidade e por isso não repeti na política — mas registro que é uma
   promessa da empresa já publicada, e política de privacidade não é lugar de reforçar
   prazo de atendimento.
9. **O campo-armadilha descarta o envio em silêncio e responde "sucesso".** Não coleta nada
   e não é problema de privacidade — mencionei em uma linha no item 3 só por transparência.
   O risco real dele é outro e é de produto: um gerenciador de senhas agressivo que preencha
   campos ocultos faria o lead de uma pessoa de verdade ser descartado sem que ninguém
   soubesse. Fora do escopo desta minuta, mas anoto porque apareceu na leitura.
