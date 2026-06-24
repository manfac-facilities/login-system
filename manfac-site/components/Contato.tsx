export default function Contato() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-2xl font-bold text-[var(--ink)] md:text-3xl">
          Se a sua operação exige controle, visibilidade e resultado,
          <br />a Manfac é o parceiro certo para construir isso com você.
        </h2>
        <a
          href="mailto:contato@manfac.com.br"
          className="mt-8 inline-block rounded-md bg-[var(--orange)] px-8 py-3 font-medium text-white transition-colors hover:bg-[var(--orange-hover)]"
        >
          contato@manfac.com.br
        </a>
      </div>
    </section>
  )
}
