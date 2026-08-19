# DNS de `manfac.com.br` — estado esperado da zona

> **Por que este arquivo existe.** Em 17–18/08/2026 o domínio foi transferido de
> registrar e a zona DNS foi recriada sem os registros do projeto. O hub e o site
> saíram do ar por ~2 dias e a causa levou uma investigação inteira pra ser achada,
> porque não havia nenhum registro de qual era o estado correto. **Se você mudar
> qualquer coisa na zona, atualize este arquivo no mesmo dia.**

## Fatos do domínio

| Item | Valor |
|---|---|
| Domínio | `manfac.com.br` |
| Titular | MANFAC - ENGENHARIA MANUTENÇÃO E FACILITIES LTDA (CNPJ 30.471.209/0001-02) |
| Registro | Registro.br (todo `.com.br` é lá — o que muda é só o provedor) |
| Registrar/provedor | **HSTDOMAINS (Hostinger)** desde 17/08/2026 |
| Expira | 16/08/2028 |
| Nameservers | **`ns1` / `ns2` / `ns3.locaweb.com.br`** |
| DNS autoritativo | **Locaweb** — a zona se edita no painel da Locaweb, NÃO no da Hostinger |

**A separação que confunde todo mundo:** o domínio é *pago/renovado* na Hostinger,
mas o DNS é *servido* pela Locaweb. Mexer na zona = painel Locaweb.

## Registros do projeto (os que quebram o hub e o site)

| Nome | Tipo | Valor | Serve |
|---|---|---|---|
| `@` | A | `2.25.194.184` | site institucional (`manfac-site`) |
| `www` | CNAME | `manfac.com.br` | segue o apex |
| `hub` | A | `2.25.194.184` | hub Next.js (`manfac-login-system`) |

`2.25.194.184` é a VPS do EasyPanel. Os três hostnames já estão cadastrados nos apps
do EasyPanel, com certificado Let's Encrypt válido — **DNS certo = tudo volta sozinho,
sem tocar no servidor.**

## 🚫 Registros de e-mail — NÃO ALTERAR

O e-mail corporativo `@manfac.com.br` é hospedado na Locaweb e depende destes:

| Nome | Tipo | Valor |
|---|---|---|
| `@` | MX 10 | `mx.core.locaweb.com.br` |
| `@` | MX 20 | `mx.a.locaweb.com.br` |
| `@` | MX 20 | `mx.b.locaweb.com.br` |
| `@` | MX 20 | `mx.jk.locaweb.com.br` |
| `@` | TXT | `v=spf1 include:_spf.locaweb.com.br -all` |
| `mail` `smtp` `imap` | CNAME | `pop.manfac.com.br` |
| `pop` | CNAME | `mail.ita.locamail.com.br` |
| `webmail` | CNAME | `webmail.ita.locamail.com.br` |
| `autodiscover` | CNAME | `autodiscover.email.locaweb.com.br` |

**Trocar os nameservers para a Hostinger derruba o e-mail da empresa inteira** e
causa perda de mensagens — dano muito maior que site fora do ar. Alterar registro **A**
não afeta e-mail; alterar **NS** afeta tudo de uma vez.

## Como diagnosticar (não confie no painel)

```bash
nslookup -type=NS manfac.com.br 8.8.8.8      # tem que dar ns1/2/3.locaweb.com.br
nslookup hub.manfac.com.br 8.8.8.8           # tem que dar 2.25.194.184
nslookup manfac.com.br 8.8.8.8               # tem que dar 2.25.194.184
nslookup -type=MX manfac.com.br 8.8.8.8      # tem que listar os 4 mx da Locaweb

# App vivo na VPS mesmo com DNS quebrado (isola DNS de aplicação):
curl -sL --resolve hub.manfac.com.br:443:2.25.194.184 https://hub.manfac.com.br/ | grep -i "<title>"

# Estado oficial do domínio no Registro.br:
curl -s https://rdap.registro.br/domain/manfac.com.br
```

**`NXDOMAIN` num subdomínio = o registro não existe na zona.** Não é app caído,
não é servidor caído — é linha faltando no DNS.

## Regra de ouro

Antes de concluir que o hub ou o site "caiu", rode o `curl --resolve` acima. Se o
título da página aparecer, a aplicação está perfeita e o problema é DNS ou rede —
nunca código, nunca deploy.
