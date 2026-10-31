import { exigirVisao } from '../../../_lib/guarda'
import { Bloco, CartaoAguardando, Vazio } from '../../../_ui/blocos'

export const dynamic = 'force-dynamic'

/** Aguardando vocês (Leva 5 §3.2): impedimentos do cliente abertos e decisões/restrições do cliente não liberadas. */
export default async function AguardandoPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { visao } = await exigirVisao(obraId)
  const raiz = `/portal-obra/obras/${obraId}`
  const impedimentos = visao.aguardando.filter((i) => i.tipo === 'impedimento')
  const decisoes = visao.aguardando.filter((i) => i.tipo === 'decisao')
  if (!visao.aguardando.length) {
    return (
      <Bloco titulo="Aguardando vocês" id="b-aguardando">
        <Vazio>Nada pendente do lado de vocês no momento.</Vazio>
      </Bloco>
    )
  }
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {impedimentos.length ? (
        <Bloco titulo="Estão segurando a obra" id="b-impedimentos">
          <div className="flex flex-col gap-3">
            {impedimentos.map((i, k) => (
              <CartaoAguardando key={k} item={i} raiz={raiz} />
            ))}
          </div>
        </Bloco>
      ) : null}
      {decisoes.length ? (
        <Bloco titulo="Decisões e liberações pendentes" id="b-decisoes">
          <div className="flex flex-col gap-3">
            {decisoes.map((i, k) => (
              <CartaoAguardando key={k} item={i} raiz={raiz} />
            ))}
          </div>
        </Bloco>
      ) : null}
    </div>
  )
}
