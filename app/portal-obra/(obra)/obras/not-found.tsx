import Link from 'next/link'

/** 404 do portal: mesma mensagem para obra inexistente e obra de outro cliente (nada vaza). */
export default function NaoEncontradaPortal() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-[22px] font-bold text-(--obra-ink)">Página não encontrada</h1>
      <p className="mt-2 text-[15px] text-(--obra-text)">Esta página não existe ou não está disponível para o seu acesso.</p>
      <Link href="/portal-obra/obras" className="mt-4 inline-flex min-h-11 items-center text-[15px] font-semibold text-(--obra-ink) underline underline-offset-2">
        Voltar para suas obras
      </Link>
    </main>
  )
}
