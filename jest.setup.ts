// TZ fixo em UTC para todo o Jest, de propósito: sem isto, um teste de fuso
// horário (ex.: I1 da review-historico-2026-09-15.md) pode passar por
// acidente porque a máquina que roda o teste já está em America/Sao_Paulo —
// e passaria igual, errado, numa máquina de CI em UTC. Com TZ=UTC, qualquer
// código que formate data/hora sem `timeZone` explícito estoura na hora
// errada aqui, não só em produção.
process.env.TZ = 'UTC'

import '@testing-library/jest-dom'
