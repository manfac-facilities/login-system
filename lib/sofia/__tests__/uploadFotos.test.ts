import { uploadFotos } from '../uploadFotos'

function makeSupabaseMock(uploadImpl: (...args: unknown[]) => Promise<{ error: unknown }>) {
  const upload = jest.fn(uploadImpl)
  return {
    supabase: {
      storage: { from: jest.fn(() => ({ upload })) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    upload,
  }
}

const blob = new Blob(['x'], { type: 'image/jpeg' })

describe('uploadFotos', () => {
  it('returns a storage path + lat/lng per photo when every upload succeeds', async () => {
    const { supabase } = makeSupabaseMock(async () => ({ error: null }))

    const result = await uploadFotos(supabase, 'checklist-fotos', 'checklist-1', [
      { blob, posicao: 'Frente', lat: -23.5, lng: -46.6 },
      { blob, posicao: 'Traseira', lat: null, lng: null },
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.fotos)).toEqual(['Frente', 'Traseira'])
      expect(result.fotos.Frente.lat).toBe(-23.5)
      expect(result.fotos.Frente.path).toContain('checklist-1/Frente-')
    }
  })

  it('fails without returning any path when one upload fails (regression for the write-once guarantee, U-02)', async () => {
    let call = 0
    const { supabase } = makeSupabaseMock(async () => {
      call += 1
      return call === 2 ? { error: { message: 'network error' } } : { error: null }
    })

    const result = await uploadFotos(supabase, 'checklist-fotos', 'checklist-1', [
      { blob, posicao: 'Frente', lat: null, lng: null },
      { blob, posicao: 'Traseira', lat: null, lng: null },
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.falhas).toEqual(['Traseira'])
      expect(result.error).toContain('Traseira')
    }
  })

  it('uses the given bucket and prefix to build the storage path', async () => {
    const { supabase, upload } = makeSupabaseMock(async () => ({ error: null }))

    await uploadFotos(supabase, 'sofia-anexos', 'sinistros/sinistro-9', [
      { blob, posicao: 'Dano 1', lat: null, lng: null },
    ])

    expect(upload).toHaveBeenCalled()
    const [path] = upload.mock.calls[0]
    expect(path).toContain('sinistros/sinistro-9/Dano-1-')
  })

  it('duas fotos com a mesma posição-base no mesmo ms geram caminhos diferentes', async () => {
    const agora = jest.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const { supabase, upload } = makeSupabaseMock(async () => ({ error: null }))
    await uploadFotos(supabase, 'checklist-fotos', 'c1', [
      { blob, posicao: 'Extra 1', lat: null, lng: null },
      { blob, posicao: 'Extra 1', lat: null, lng: null },
    ])
    const caminhos = upload.mock.calls.map((c) => c[0])
    expect(new Set(caminhos).size).toBe(2)
    agora.mockRestore()
  })

  it('repassa tipo_foto e avaria_ref no resultado', async () => {
    const { supabase } = makeSupabaseMock(async () => ({ error: null }))
    const r = await uploadFotos(supabase, 'checklist-fotos', 'c1', [
      { blob, posicao: 'Avaria 1 dano 1', lat: null, lng: null, tipo_foto: 'avaria_dano', avaria_ref: 'av-a' },
      { blob, posicao: 'Frente', lat: null, lng: null },
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.fotos['Avaria 1 dano 1']).toEqual(expect.objectContaining({ tipo_foto: 'avaria_dano', avaria_ref: 'av-a' }))
      expect(r.fotos.Frente.tipo_foto).toBeUndefined()
    }
  })

  it('falha de um upload entre vários continua devolvendo ok: false sem caminhos', async () => {
    let n = 0
    const { supabase } = makeSupabaseMock(async () => ({ error: ++n === 3 ? { message: 'x' } : null }))
    const r = await uploadFotos(supabase, 'checklist-fotos', 'c1', [
      { blob, posicao: 'Extra 1', lat: null, lng: null },
      { blob, posicao: 'Extra 2', lat: null, lng: null },
      { blob, posicao: 'Extra 3', lat: null, lng: null },
    ])
    expect(r.ok).toBe(false)
    expect('fotos' in r).toBe(false)
  })
})
