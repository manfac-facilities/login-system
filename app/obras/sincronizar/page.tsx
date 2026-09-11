import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { Box, BoxB } from '../_ui/primitivos'
import PainelSincronizacao from './_painel'

export const dynamic = 'force-dynamic'

export default async function SincronizarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''

  // Mesmo porteiro da importação da planilha: quem escreve na base inteira de
  // uma vez é administrador do hub. A checagem de verdade está na Server Action
  // — esta aqui só evita mostrar um botão que não vai funcionar.
  if (!email || !(await isAdmin(supabase, email))) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Box>
          <BoxB>
            <p className="text-sm text-[#94a3b8]">
              Esta tela é de administradores do hub. Se você precisa trazer as OS do Field Control,
              peça a alguém com esse acesso.
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
        <h1 className="text-lg font-semibold text-[#e8eef7]">Sincronizar com o Field Control</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          A OS que o cliente cadastra no Field Control entra aqui como obra, pronta para a triagem.
          É a mesma base da planilha — o Field é só outra porta de entrada.
        </p>
      </header>

      <PainelSincronizacao />

      <Box>
        <BoxB>
          <h2 className="mb-2 text-sm font-semibold text-[#e8eef7]">O que a sincronização faz</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#94a3b8]">
            <li>
              <strong className="text-[#e8eef7]">OS que não existe aqui vira obra nova</strong>, com
              número, loja e descrição do Field, na etapa &quot;Aguardando definição&quot; — ou seja,
              na fila da triagem.
            </li>
            <li>
              <strong className="text-[#e8eef7]">OS que já existe só ganha o que falta.</strong> O
              Field preenche campo vazio; campo que alguém digitou aqui fica como está, mesmo que o
              Field traga outro valor. A etapa e a triagem nunca são tocadas.
            </li>
            <li>
              <strong className="text-[#e8eef7]">OS sem número fica de fora</strong>, com o motivo no
              relatório. Sem número não há como reencontrá-la na próxima sincronização.
            </li>
          </ul>
        </BoxB>
      </Box>
    </div>
  )
}
