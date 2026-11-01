/**
 * URL do worker do pdfjs, separada do conversor para o Jest conseguir trocá-la
 * (`import.meta` não existe no ambiente de teste). O bundler resolve o `new URL`
 * e serve o worker como arquivo estático.
 */
export const URL_WORKER_PDFJS = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
