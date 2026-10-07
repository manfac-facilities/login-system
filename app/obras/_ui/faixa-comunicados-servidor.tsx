import { listarComunicadosNaoLidos, type Comunicado } from '../_comunicados-actions'
import FaixaComunicados from './faixa-comunicados'

/**
 * Busca os comunicados não lidos no servidor, junto com a renderização da
 * página (o layout a envolve em <Suspense fallback={null}> para não segurar o
 * conteúdo). A faixa em si segue sendo o componente cliente, com o botão
 * "Entendi".
 *
 * Exceção aqui derrubaria /obras inteiro (Suspense não captura erro e o
 * error.tsx do segmento não cobre o layout), então falha = sem faixa, como
 * antes de a busca ir para o servidor.
 */
export default async function FaixaComunicadosServidor() {
  let comunicados: Comunicado[]
  try {
    comunicados = await listarComunicadosNaoLidos()
  } catch {
    return null
  }
  return <FaixaComunicados iniciais={comunicados} />
}
