# Relato do João — OS cadastradas no Field que não subiram para Obras

Literal, colado no chat:

> Essas OS foram cadastradas no field entre 10h e 12h e nao subiram para as obras
>
> 0926-014271	DP BARRA DE SÃO JOÃO
> 0926-013146	DP SEROPEDICA
> 0926-010667	DP COPACABANA 13
> 0926-010663	DP COPACABANA 15
> 0926-010665	DP COPACABANA 16
> 0526-016810	DPA UNAMAR
> 0326-013538	DP RIO DAS OSTRAS 4

---

## Diagnóstico (Claude, 21/09/2026 ~18h) — consulta só leitura à API do Field

| OS | Tipo no Field | Criada (UTC) | updatedAt | Última atividade |
|---|---|---|---|---|
| 0926-013146 | Atividade Spot | 2026-09-21T13:48:02Z | **null** | scheduled |
| 0926-010667 | Atividade Spot | 2026-09-21T13:55:50Z | **null** | scheduled |
| 0926-010663 | Atividade Spot | 2026-09-21T13:56:55Z | **null** | scheduled |
| 0926-010665 | Atividade Spot | 2026-09-21T13:58:14Z | **null** | scheduled |
| 0526-016810 | Atividade Spot | 2026-09-21T13:59:24Z | **null** | scheduled |
| 0326-013538 | Atividade Spot | 2026-09-21T13:35:49Z | **null** | scheduled |
| 0926-014271 | **Manutenção Corretiva** | 2026-09-17T18:53:20Z | 2026-09-18T12:56:23Z | reported |

**Causa raiz (6 OS):** a incremental (`*/5`) busca `/orders` com `updated_at>=<marca d'água>`
(`app/obras/_lib/field/cliente.ts:181`). OS recém-criada e nunca editada tem `updatedAt = null`
no Field e não casa com o filtro — só a varredura completa (03:02, sem filtro de data) a enxerga.
Toda OS nova espera até a madrugada. Nenhum erro registrado: `obras_sync_execucao` mostra sucesso.

**0926-014271:** fora do tipo sincronizado ("Atividade Spot"). Não é defeito do sistema; se é
obra, o tipo precisa ser corrigido no Field.

**Remédio imediato:** disparar a varredura completa. Bloqueado pela permissão do modo automático
(escrita em produção) — aguarda autorização do João.
**Correção definitiva:** a incremental também precisa buscar `created_at>=<marca>` (e a marca
d'água considerar `createdAt`). Arquivos da frente do Duda (`_lib/field/`, `sincronizar/`).
