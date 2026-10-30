import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import EnviarExtratoForm from './_form'

export default async function EnviarExtratoPage() {
  const supabase = await createClient()
  const podeGerir = await podeGerirFrotas(supabase)

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Enviar extrato</h1>
      <p className="text-[#94a3b8] text-sm mb-6">
        Pode enviar a qualquer hora, quantas vezes quiser, com períodos que se sobrepõem. Linha repetida é ignorada.
      </p>
      {podeGerir ? (
        <EnviarExtratoForm />
      ) : (
        <p className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-5 text-sm text-[#94a3b8]">
          Enviar extratos é só para o gestor de frotas e para o admin. Você pode acompanhar os envios em
          “Histórico de envios”. Se precisa de acesso, peça a um admin em Admin → Acessos.
        </p>
      )}
    </div>
  )
}
