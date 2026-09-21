# Limite do bucket `obras-fotos` — aplicação pelo João

O código do Diário aceita apenas JPEG de até 5 MiB e confere os metadados do objeto
antes de gravar o caminho. Para impedir upload direto fora da tela, configurar no
bucket privado `obras-fotos`:

- **Tamanho máximo por arquivo:** `5242880` bytes (5 MiB).
- **Tipos MIME permitidos:** apenas `image/jpeg`.
- **Visibilidade:** manter `private`.

Aplicar pela configuração do bucket no Supabase Storage, antes do deploy deste bloco.
Não editar `storage.buckets` por SQL: a [documentação do Supabase sobre o schema de
Storage](https://supabase.com/docs/guides/storage/schema/design) orienta a tratá-lo
como somente leitura; as restrições pertencem à configuração do bucket. A
[API de atualização de bucket](https://supabase.com/docs/reference/javascript/file-buckets-updatebucket)
recebe `fileSizeLimit` e `allowedMimeTypes` se o painel não oferecer os campos.

Após aplicar, conferir a configuração exibida para o bucket e testar em ambiente
controlado: um JPEG menor que 5 MiB deve subir; arquivo maior e MIME diferente
devem ser recusados. Não há alteração de objetos existentes nem de policies RLS.
