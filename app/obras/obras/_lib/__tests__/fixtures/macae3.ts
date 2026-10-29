// Macaé 3 — 28 atividades de §10.1 de docs/cliente/2026-10-29-sgo-especificacao-eduardo.md
// + peso_valor de §10.2 (mesmos dados do seed em sdd-sql-obras-modalidade-obra.sql, seção 6.4).
import type { AtividadeExec, AtividadePlano } from '../../cronograma'

export const PLANO_MACAE3: AtividadePlano[] = [
  { numero: 1, etapa: '1 – Mobilização e isolamento', descricao: 'Reunião de partida no local: identificar P1–P4, treliça e faixa de piso afetada', pred1: null, pred2: null, duracao: 1, bloqueiaPorTrava: false, pesoValor: 6650 },
  { numero: 2, etapa: '1 – Mobilização e isolamento', descricao: 'Pontos de acompanhamento fotográfico, relatório "antes da obra" e marcos de nível', pred1: 1, pred2: null, duracao: 2, bloqueiaPorTrava: false, pesoValor: 4500 },
  { numero: 3, etapa: '1 – Mobilização e isolamento', descricao: 'Instalar divisória de fechamento da área', pred1: 1, pred2: null, duracao: 2, bloqueiaPorTrava: false, pesoValor: 17869.2 },
  { numero: 4, etapa: '1 – Mobilização e isolamento', descricao: 'Remover produtos, virar o balcão e mudar o mobiliário da área afetada', pred1: 3, pred2: null, duracao: 3, bloqueiaPorTrava: false, pesoValor: 5851 },
  { numero: 5, etapa: '1 – Mobilização e isolamento', descricao: 'Aliviar a carga do mezanino (retirar estoque do depósito)', pred1: 3, pred2: null, duracao: 1, bloqueiaPorTrava: false, pesoValor: 0 },
  { numero: 6, etapa: '2 – Estabilização', descricao: 'Escoramento provisório sob a treliça (P2/P3 e vão P3–P4); macaco só para encunhar', pred1: 5, pred2: null, duracao: 3, bloqueiaPorTrava: false, pesoValor: 15200 },
  { numero: 7, etapa: '3 – Investigação e projeto', descricao: 'Levantamento topográfico de níveis e medição dos m² da faixa afetada', pred1: 6, pred2: null, duracao: 2, bloqueiaPorTrava: false, pesoValor: 11500 },
  { numero: 8, etapa: '3 – Investigação e projeto', descricao: 'Estudo de solo: SPT e poço de inspeção com abertura localizada do piso', pred1: 6, pred2: null, duracao: 5, bloqueiaPorTrava: false, pesoValor: 38000 },
  { numero: 9, etapa: '3 – Investigação e projeto', descricao: 'Projeto estrutural de reforço (treliça, apoios e fundações) + ART', pred1: 8, pred2: 7, duracao: 10, bloqueiaPorTrava: false, pesoValor: 16293.44 },
  { numero: 10, etapa: '3 – Investigação e projeto', descricao: 'Fechar quantitativos e revisar o orçamento da Fase 2', pred1: 9, pred2: null, duracao: 5, bloqueiaPorTrava: false, pesoValor: 0 },
  { numero: 11, etapa: '4 – Desmobilização e demolição', descricao: 'Abertura de porta com retirada de vidro (logística de entulho e materiais)', pred1: 10, pred2: null, duracao: 1, bloqueiaPorTrava: true, pesoValor: 2100 },
  { numero: 12, etapa: '4 – Desmobilização e demolição', descricao: 'Descarte de gôndolas e geladeira', pred1: 10, pred2: null, duracao: 2, bloqueiaPorTrava: true, pesoValor: 1729 },
  { numero: 13, etapa: '4 – Desmobilização e demolição', descricao: 'Desmobilização do banheiro', pred1: 10, pred2: null, duracao: 2, bloqueiaPorTrava: true, pesoValor: 438.68 },
  { numero: 14, etapa: '4 – Desmobilização e demolição', descricao: 'Demolição do piso (revestimento, contrapiso e laje) + descarte com CTR', pred1: 12, pred2: 13, duracao: 5, bloqueiaPorTrava: true, pesoValor: 23415.86 },
  { numero: 15, etapa: '5 – Reforço e reconstrução', descricao: 'Reforço das fundações de P2/P3 e da treliça, conforme projeto', pred1: 14, pred2: null, duracao: 10, bloqueiaPorTrava: false, pesoValor: 49000 },
  { numero: 16, etapa: '5 – Reforço e reconstrução', descricao: 'Remoção do solo inadequado, base de brita e compactação em camadas (máx. 20 cm)', pred1: 14, pred2: null, duracao: 5, bloqueiaPorTrava: false, pesoValor: 19500 },
  { numero: 17, etapa: '5 – Reforço e reconstrução', descricao: 'Nova laje de piso armada com nível final (inclui cura)', pred1: 16, pred2: 15, duracao: 10, bloqueiaPorTrava: false, pesoValor: 9426 },
  { numero: 18, etapa: '5 – Reforço e reconstrução', descricao: 'Piso do banheiro e revestimento do salão', pred1: 17, pred2: null, duracao: 8, bloqueiaPorTrava: false, pesoValor: 28000 },
  { numero: 19, etapa: '6 – Acabamentos e entrega', descricao: 'Recuperação do mezanino: drywall, piso cerâmico, copa e WCs', pred1: 15, pred2: null, duracao: 8, bloqueiaPorTrava: false, pesoValor: 20000 },
  { numero: 20, etapa: '6 – Acabamentos e entrega', descricao: 'Retirada do escoramento, conferência final de níveis, limpeza e liberação', pred1: 18, pred2: 27, duracao: 3, bloqueiaPorTrava: false, pesoValor: 13656 },
  { numero: 21, etapa: 'R – Reforma light', descricao: 'Demolição de forro (250 m²) e drywall (100 m²)', pred1: 6, pred2: null, duracao: 4, bloqueiaPorTrava: true, pesoValor: 2122.5 },
  { numero: 22, etapa: 'R – Reforma light', descricao: 'Infraestrutura elétrica, rede, iluminação e ativações', pred1: 21, pred2: null, duracao: 10, bloqueiaPorTrava: false, pesoValor: 38254.25 },
  { numero: 23, etapa: 'R – Reforma light', descricao: 'Ar-condicionado: retirada, reinstalação de splits e drenos', pred1: 21, pred2: null, duracao: 5, bloqueiaPorTrava: false, pesoValor: 22042.6 },
  { numero: 24, etapa: 'R – Reforma light', descricao: 'Drywall novo (190 m²) com reforço em MDF', pred1: 22, pred2: null, duracao: 6, bloqueiaPorTrava: false, pesoValor: 24917.6 },
  { numero: 25, etapa: 'R – Reforma light', descricao: 'Forro mineral (250 m²) e abertura de luminárias', pred1: 24, pred2: 23, duracao: 6, bloqueiaPorTrava: false, pesoValor: 35648.08 },
  { numero: 26, etapa: 'R – Reforma light', descricao: 'Portas, molas, grelhas, guia de porta de enrolar e fechadura', pred1: 24, pred2: null, duracao: 4, bloqueiaPorTrava: false, pesoValor: 14246.2 },
  { numero: 27, etapa: 'R – Reforma light', descricao: 'Pintura (fundo, massa e acabamento)', pred1: 25, pred2: 19, duracao: 6, bloqueiaPorTrava: false, pesoValor: 13620 },
  { numero: 28, etapa: 'R – Reforma light', descricao: 'Fachada: fixação de vidros e pintura', pred1: 11, pred2: null, duracao: 3, bloqueiaPorTrava: false, pesoValor: 3792 },
]

/** Estado inicial: nº 6 em andamento, o resto não iniciado. */
export function execInicialMacae3(): AtividadeExec[] {
  return PLANO_MACAE3.map((a) => ({
    numero: a.numero,
    status: a.numero === 6 ? 'em_andamento' : 'nao_iniciado',
    percentual: 0,
    inicioReal: null,
    fimReal: null,
  }))
}
