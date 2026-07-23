import { formatAutorizacaoLabel, autorizacaoBadgeClass } from '@/lib/sofia/autorizacao'
import type { AutorizacaoStatus } from '@/lib/sofia/types'

/**
 * Bloco de autorização (badge + botões Solicitar/Autorizar/Cancelar/Revogar),
 * antes duplicado em 4 telas (multas, sinistros, km, descontos) — achado U-16 —
 * com botões que pareciam links de texto — achado U-12. Extraído num componente
 * único com aparência clara de botão.
 *
 * A `action` já vem vinculada ao id quando necessário (`action.bind(null, id)`);
 * telas que identificam o registro por campos ocultos (KM excedido) passam
 * `hiddenFields`.
 */
type AutorizacaoAction = (formData: FormData) => void | Promise<void>

const BTN_BASE =
  'px-2.5 py-1 rounded-md text-xs font-medium border active:scale-95 transition-[background-color,transform] cursor-pointer'
const BTN_SOLICITAR = 'border-amber-500/50 text-amber-300 hover:bg-amber-500/15'
const BTN_AUTORIZAR = 'border-green-500/50 text-green-300 hover:bg-green-500/15'
const BTN_NEUTRO = 'border-[#1e3a5f] text-[#94a3b8] hover:bg-[#1e3a5f]/50'

interface Props {
  status: AutorizacaoStatus | null
  solicitadoEm: string | null
  action: AutorizacaoAction
  /** Campos ocultos enviados junto (ex.: KM excedido identifica por veiculo_id + mes). */
  hiddenFields?: Record<string, string | number>
  /** Quando false, mostra só o badge sem os botões de ação. Default true. */
  showActions?: boolean
}

export default function AutorizacaoActions({
  status,
  solicitadoEm,
  action,
  hiddenFields,
  showActions = true,
}: Props) {
  const st: AutorizacaoStatus = status ?? 'sem_solicitacao'
  const renderHidden = () =>
    hiddenFields
      ? Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))
      : null

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${autorizacaoBadgeClass(st)}`}>
        {formatAutorizacaoLabel(st, solicitadoEm)}
      </span>
      {showActions && (
        <div className="flex gap-2 flex-wrap">
          {st === 'sem_solicitacao' && (
            <form action={action}>
              {renderHidden()}
              <button name="status" value="solicitado" type="submit" className={`${BTN_BASE} ${BTN_SOLICITAR}`}>
                Solicitar
              </button>
            </form>
          )}
          {st === 'solicitado' && (
            <>
              <form action={action}>
                {renderHidden()}
                <button name="status" value="autorizado" type="submit" className={`${BTN_BASE} ${BTN_AUTORIZAR}`}>
                  Autorizar
                </button>
              </form>
              <form action={action}>
                {renderHidden()}
                <button name="status" value="sem_solicitacao" type="submit" className={`${BTN_BASE} ${BTN_NEUTRO}`}>
                  ← Cancelar
                </button>
              </form>
            </>
          )}
          {st === 'autorizado' && (
            <form action={action}>
              {renderHidden()}
              <button name="status" value="solicitado" type="submit" className={`${BTN_BASE} ${BTN_NEUTRO}`}>
                ← Revogar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
