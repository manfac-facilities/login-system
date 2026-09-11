/**
 * A fronteira pública desta pasta.
 *
 * Existe para que uma renomeação interna não quebre quem consome em silêncio:
 * quem for ligar isto à aplicação importa de `_lib/field`, nunca de
 * `_lib/field/cliente`. Se um símbolo daqui sumir, este teste cai antes do
 * build de quem depende.
 */

import * as field from '../index'

describe('a superfície pública de app/obras/_lib/field', () => {
  it('exporta o criador do cliente e os erros que quem consome precisa distinguir', () => {
    expect(typeof field.criarClienteField).toBe('function')
    expect(typeof field.ErroDeRateLimit).toBe('function')
    expect(typeof field.ErroDeParametroInvalido).toBe('function')
    expect(typeof field.ErroDaApiField).toBe('function')
    expect(typeof field.ErroDeTipoDeOs).toBe('function')
  })

  it('expõe o ponto de variação da loja, que é o que vai mudar quando o cliente responder', () => {
    expect(typeof field.criarResolvedorDeLoja).toBe('function')
    expect(typeof field.textoDoEndereco).toBe('function')
  })

  it('publica os limites documentados da API como constantes, não como número solto no código', () => {
    expect(field.TAMANHO_MAXIMO_DA_PAGINA).toBe(100)
    expect(field.OFFSET_MAXIMO).toBe(200000)
    expect(field.NOME_PADRAO_DO_TIPO_DE_OS).toBe('Atividade Spot')
    expect(field.BASE_URL_FIELD).toBe('https://carchost.fieldcontrol.com.br')
  })
})
