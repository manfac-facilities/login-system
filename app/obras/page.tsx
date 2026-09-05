import { redirect } from 'next/navigation'

/**
 * /obras não tem tela própria: é só a porta. A Base de obras é a visão que
 * responde "onde está cada obra", e é ela que o card do hub promete.
 *
 * A tela em si é da frente B (app/obras/base/). Enquanto ela não existir, este
 * redirect cai em 404 — é esperado no esqueleto, não é bug de rota.
 */
export default function ObrasPage() {
  redirect('/obras/base')
}
