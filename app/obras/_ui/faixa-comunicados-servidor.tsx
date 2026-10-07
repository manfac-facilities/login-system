import { listarComunicadosNaoLidos } from '../_comunicados-actions'
import FaixaComunicados from './faixa-comunicados'

/**
 * Busca os comunicados não lidos no servidor, junto com a renderização da
 * página (o layout a envolve em <Suspense fallback={null}> para não segurar o
 * conteúdo). A faixa em si segue sendo o componente cliente, com o botão
 * "Entendi".
 */
export default async function FaixaComunicadosServidor() {
  const comunicados = await listarComunicadosNaoLidos()
  return <FaixaComunicados iniciais={comunicados} />
}
