import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { Box, BoxB } from '../_ui/primitivos'
import FormImportacao from './_form'

export const dynamic = 'force-dynamic'

export default async function ImportarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''

  if (!email || !(await isAdmin(supabase, email))) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Box>
          <BoxB>
            <p className="text-sm text-[#94a3b8]">
              Esta tela é de administradores do hub. Se você precisa carregar a planilha, peça a
              alguém com esse acesso.
            </p>
            <Link href="/obras/base" className="mt-3 inline-block text-sm text-[#f05a28] hover:underline">
              ← Voltar para a base de obras
            </Link>
          </BoxB>
        </Box>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-lg font-semibold text-[#e8eef7]">Importar a planilha</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Carga da base de obras a partir da planilha de controle. Pode ser rodada de novo: obra que
          já existe é atualizada pelo Nº da OS, não duplicada.
        </p>
      </header>

      <FormImportacao />

      <Box>
        <BoxB>
          <h2 className="mb-2 text-sm font-semibold text-[#e8eef7]">O que a importação não traz</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#94a3b8]">
            <li>
              <strong className="text-[#e8eef7]">Remarcações.</strong> As colunas da planilha apontam
              para um arquivo externo que não vem junto, e os poucos valores guardados estão
              quebrados. A ficha mostra a seção vazia em vez de exibir número errado.
            </li>
            <li>
              <strong className="text-[#e8eef7]">Avanço físico.</strong> A planilha tem duas escalas
              convivendo — 0,9 numa linha e 95 em outra querendo dizer a mesma coisa. O sistema usa
              prazo consumido, calculado da duração, em vez de percentual digitado à mão.
            </li>
            <li>
              <strong className="text-[#e8eef7]">Equipe &quot;DEFINIR&quot;.</strong> É um lembrete,
              não uma equipe. Entra vazia, e a obra aparece esperando definição.
            </li>
          </ul>
        </BoxB>
      </Box>
    </div>
  )
}
