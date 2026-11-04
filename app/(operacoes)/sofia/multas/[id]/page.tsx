import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { podeAutorizarDescontoMulta } from '@/lib/sofia/multaPermissoes'
import { resolverNaData, type TrechoBruto } from '@/lib/sofia/bases/responsabilidade'
import {
  MODO_INDICACAO_POR_LOCADORA,
  ORDEM_STEPPER,
  acaoPara,
  classePrazo,
  ehEtapaMulta,
  hojeSP,
  infoEtapa,
  ordemEtapa,
  proximasAcoes,
  type MultaComEtapa,
  type MultaEtapa,
} from '@/lib/sofia/multaEtapas'
import PillPrazo from '../_pill'
import { FormBoleto, FormDobro, FormEtapa, FormPrazo } from './_fluxo'

type Trecho = TrechoBruto & { equipes: { codigo: string } | null; motoristas: { nome: string } | null }

interface LinhaEtapa {
  id: string
  etapa: MultaEtapa
  etapa_anterior: string | null
  feito_em: string
  feito_por: string
  em_nome_de: string | null
  canal: string | null
  observacao: string | null
}

const fmtData = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—')
const fmtDataHora = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const CANAL: Record<string, string> = { email: 'e-mail', whatsapp: 'WhatsApp', telefone: 'telefone', presencial: 'presencial' }
const TAG: Record<string, string> = {
  NOVO: 'bg-[#3a1d10] text-[#f05a28]',
  AMPLIADO: 'bg-amber-900 text-amber-300',
  EXISTE: 'bg-[#1e3a5f] text-[#94a3b8]',
}

export default async function MultaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: multaRaw } = await supabase
    .from('multas')
    .select('*, veiculos(placa), motoristas!motorista_id(nome)')
    .eq('id', id)
    .single()
  if (!multaRaw) notFound()
  const multa = multaRaw as MultaComEtapa & { veiculos: { placa: string } | null; motoristas: { nome: string } | null }
  if (!ehEtapaMulta(multa.etapa)) notFound()

  const [podeGerir, ehAdmin, { data: etapasRaw }, { data: motoristasRaw }, { data: trechosRaw }] = await Promise.all([
    podeGerirFrotas(supabase),
    podeAutorizarDescontoMulta(supabase),
    supabase
      .from('multa_etapas')
      .select('id, etapa, etapa_anterior, feito_em, feito_por, em_nome_de, canal, observacao')
      .eq('multa_id', id)
      .order('feito_em'),
    supabase.from('motoristas').select('id, nome').eq('ativo', true).order('nome'),
    multa.veiculo_id
      ? supabase
          .from('veiculo_responsabilidade_historico')
          .select('veiculo_id, equipe_id, motorista_id, inicio, fim, created_at, equipes(codigo), motoristas(nome)')
          .eq('veiculo_id', multa.veiculo_id)
      : Promise.resolve({ data: [] }),
  ])

  const historico = (etapasRaw ?? []) as LinhaEtapa[]
  const motoristas = (motoristasRaw ?? []) as { id: string; nome: string }[]
  const sugerido = multa.veiculo_id
    ? resolverNaData((trechosRaw ?? []) as unknown as Trecho[], multa.veiculo_id, multa.data)
    : null

  const perfil = { podeGerir, ehAdmin }
  const atual = multa.etapa
  const hoje = hojeSP()
  const prazo = classePrazo(multa.prazo_indicacao, atual, hoje)
  const acoesAtuais = proximasAcoes(atual, perfil)

  // etapa selecionada no stepper: só aceita uma chave válida (nunca texto livre da URL)
  const pedida = typeof sp.etapa === 'string' && ehEtapaMulta(sp.etapa) ? sp.etapa : null
  const proxima = acoesAtuais.find((a) => a.tipo === 'avancar' && a.destino !== 'contestada')?.destino ?? atual
  const selecionada: MultaEtapa = pedida ?? proxima
  const info = infoEtapa(selecionada)
  const registradas = new Set(historico.map((h) => h.etapa))
  const ordemAtual = ordemEtapa(atual)
  const passos: MultaEtapa[] = atual === 'contestada' ? [...ORDEM_STEPPER.slice(0, 4), 'contestada'] : [...ORDEM_STEPPER]

  // ações do painel: na etapa atual, as de voltar; numa etapa à frente, a ação para ela (pular é permitido)
  const acoesPainel =
    selecionada === atual
      ? acoesAtuais.filter((a) => a.tipo === 'voltar')
      : [acaoPara(atual, selecionada, perfil)].filter((a) => a !== null)

  const condutorNome = multa.motoristas?.nome ?? null
  const modoLocadora = multa.locadora ? MODO_INDICACAO_POR_LOCADORA[multa.locadora] : undefined

  let termoUrl: string | null = null
  if (multa.autorizacao_storage_path) {
    const { data } = await supabase.storage.from('sofia-anexos').createSignedUrl(multa.autorizacao_storage_path, 3600)
    termoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Link href="/sofia/multas" className="text-sm text-[#94a3b8] hover:underline">
        ← Multas
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-4 mt-4">
        {/* Cartão da multa */}
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 flex flex-col gap-2 h-fit">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-white font-bold">
                <span className="font-mono">{multa.veiculos?.placa ?? 'Sem veículo'}</span> · {condutorNome ?? 'Condutor não confirmado'}
              </p>
              <p className="text-xs text-[#94a3b8]">
                Auto {multa.auto_infracao ?? '—'} · {multa.orgao_autuador ?? 'órgão não informado'} ·{' '}
                {multa.pontos ?? '—'} pontos
              </p>
            </div>
            <PillPrazo prazo={prazo} />
          </div>
          <p className="text-sm text-white">
            {multa.tipo_infracao ?? multa.descricao ?? '—'} · R$ {Number(multa.valor).toFixed(2)}
          </p>
          <p className="text-xs text-[#94a3b8]">
            Infração em {fmtData(multa.data)} · recebida em {fmtData(multa.data_recebimento)} · prazo de indicação até{' '}
            {fmtData(multa.prazo_indicacao)}
            {multa.locadora ? ` (${multa.locadora})` : ''}
          </p>
          <p className="text-xs text-[#94a3b8]">
            Etapa atual: <span className="text-white">{infoEtapa(atual).rotulo}</span>
          </p>
          {termoUrl && (
            <a href={termoUrl} target="_blank" rel="noreferrer" className="text-xs text-[#f05a28] hover:underline">
              Ver termo assinado
            </a>
          )}
          {multa.pago_em_dobro && (
            <p className="text-xs text-red-300">
              Paga em dobro · responsável: {multa.responsavel_dobro === 'empresa' ? 'empresa' : 'motorista'}
            </p>
          )}
          {podeGerir && ordemAtual < ordemEtapa('indicado') && (
            <div className="mt-2">
              <FormPrazo multaId={multa.id} prazo={multa.prazo_indicacao} />
            </div>
          )}
        </div>

        {/* Stepper (lista vertical: funciona igual no celular) */}
        <ol className="rounded-xl border border-[#1e3a5f] p-2 flex flex-col">
          {passos.map((k, i) => {
            const feito = atual !== 'contestada' ? ordemEtapa(k) <= ordemAtual : k !== 'contestada' ? ordemEtapa(k) < ordemAtual : true
            const ehAtual = k === atual
            const sel = k === selecionada
            const e = infoEtapa(k)
            return (
              <li key={k}>
                <Link
                  href={`/sofia/multas/${multa.id}?etapa=${k}`}
                  scroll={false}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 ${sel ? 'bg-[#0d2050] ring-1 ring-[#f05a28]' : 'hover:bg-[#0d2050]'}`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      feito ? 'bg-green-800 text-green-200' : 'bg-[#1e3a5f] text-[#94a3b8]'
                    }`}
                  >
                    {feito ? '✓' : i + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm text-white">
                      {e.rotulo}{' '}
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${TAG[e.tag]}`}>{e.tag}</span>
                    </span>
                    <span className="text-xs text-[#94a3b8]">
                      {e.ator}
                      {ehAtual ? ' · etapa atual' : ''}
                      {feito && k !== 'registrada' && !registradas.has(k) ? ' · não registrada' : ''}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Painel da etapa selecionada */}
      <div className="rounded-xl border border-[#1e3a5f] p-4 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-white font-bold">{info.rotulo}</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${TAG[info.tag]}`}>{info.tag}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <p className="text-xs text-[#4a6080]">Como era</p>
            <p className="text-sm text-[#94a3b8]">{info.hoje}</p>
          </div>
          <div>
            <p className="text-xs text-[#f05a28] font-bold">Como fica</p>
            <p className="text-sm text-[#94a3b8]">{info.novo}</p>
          </div>
        </div>

        {acoesPainel.length > 0 ? (
          acoesPainel.map((a) => (
            <FormEtapa
              key={a.destino + a.tipo}
              multaId={multa.id}
              acao={a}
              motoristas={motoristas}
              condutorSugeridoId={sugerido?.motorista_id ?? null}
              valorMulta={Number(multa.valor)}
            />
          ))
        ) : (
          <p className="text-xs text-[#94a3b8] mt-3">
            {selecionada === atual
              ? atual === 'contestada'
                ? 'Multa contestada: não segue para desconto.'
                : 'Etapa atual.'
              : ordemEtapa(selecionada) <= ordemAtual
                ? 'Etapa concluída.'
                : 'Esta etapa não pode ser registrada a partir da etapa atual.'}
          </p>
        )}
        {selecionada !== atual && selecionada !== proxima && acoesPainel.length > 0 && (
          <p className="text-xs text-amber-300 mt-2">
            Pulando etapas: as etapas entre a atual e esta ficam como &quot;não registrada&quot;.
          </p>
        )}
      </div>

      {/* Cartões extras por etapa */}
      {selecionada === 'condutor' && (
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 mt-4 text-sm">
          <p className="text-xs text-[#4a6080]">Sugestão do sistema para a data da infração ({fmtData(multa.data)})</p>
          {sugerido ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-2">
              <dt className="text-[#94a3b8]">Equipe</dt>
              <dd className="text-white">{(sugerido as Trecho).equipes?.codigo ?? '—'}</dd>
              <dt className="text-[#94a3b8]">Carro</dt>
              <dd className="text-white font-mono">{multa.veiculos?.placa ?? '—'}</dd>
              <dt className="text-[#94a3b8]">Motorista no dia</dt>
              <dd className="text-white">{(sugerido as Trecho).motoristas?.nome ?? 'sem motorista no histórico'}</dd>
            </dl>
          ) : (
            <p className="text-[#94a3b8] mt-2">Sem histórico de equipe/motorista para este carro nessa data.</p>
          )}
        </div>
      )}
      {selecionada === 'indicado' && modoLocadora && (
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 mt-4">
          <p className="text-xs text-[#4a6080]">Modo de indicação por locadora (do documento do Igor)</p>
          <p className="text-sm text-[#94a3b8] mt-1">{modoLocadora}</p>
        </div>
      )}
      {atual === 'contestada' &&
        (multa.boleto_lancado_em ? (
          <p className="text-sm text-[#94a3b8] mt-4">Boleto lançado em {fmtData(multa.boleto_lancado_em)}</p>
        ) : (
          <div className="rounded-xl border border-[#1e3a5f] p-4 mt-4">
            <FormBoleto multaId={multa.id} permitido={podeGerir || ehAdmin} hoje={hoje} />
          </div>
        ))}
      {prazo?.tipo === 'vencido' && (
        <div className="rounded-xl border border-red-900 p-4 mt-4">
          <p className="text-sm font-bold text-red-300">Prazo vencido: a multa será paga em dobro.</p>
          <p className="text-xs text-[#94a3b8] mt-1">
            Valor extra: R$ {Number(multa.valor).toFixed(2)}. Só registra quem perdeu o prazo; não há desconto automático.
          </p>
          {podeGerir && !multa.pago_em_dobro && <FormDobro multaId={multa.id} />}
        </div>
      )}

      {/* Histórico */}
      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mt-6 mb-3">Histórico da multa</h2>
      {historico.length === 0 ? (
        <p className="text-sm text-[#94a3b8]">Nenhuma etapa registrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {historico.map((h) => (
            <li key={h.id} className="rounded-lg border border-[#1e3a5f] px-3 py-2 text-sm">
              <p className="text-white">
                {infoEtapa(h.etapa)?.rotulo ?? h.etapa}
                {h.etapa_anterior && ehEtapaMulta(h.etapa_anterior) && ordemEtapa(h.etapa) < ordemEtapa(h.etapa_anterior)
                  ? ' (voltou)'
                  : ''}
              </p>
              <p className="text-xs text-[#94a3b8]">
                {fmtDataHora(h.feito_em)} · {h.feito_por}
                {h.em_nome_de ? ` · em nome de ${h.em_nome_de}` : ''}
                {h.canal ? ` · por ${CANAL[h.canal] ?? h.canal}` : ''}
              </p>
              {h.observacao && <p className="text-xs text-[#94a3b8] mt-1">{h.observacao}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
