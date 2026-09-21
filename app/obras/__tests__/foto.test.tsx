import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BotaoFoto from '../diario/_foto'

const uploadMock = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({ storage: { from: () => ({ upload: uploadMock }) } })),
}))

function escolher(arquivo: File) {
  const onChange = jest.fn()
  const { container } = render(
    <BotaoFoto obraId="obra-1" data="2026-09-05" valor={null} onChange={onChange} />,
  )
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [arquivo] },
  })
  return onChange
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: jest.fn().mockRejectedValue(new Error('canvas indisponível')),
  })
  uploadMock.mockResolvedValue({ error: null })
})

it('recusa arquivo que não é imagem antes do upload', async () => {
  escolher(new File(['pdf'], 'documento.pdf', { type: 'application/pdf' }))
  expect(await screen.findByText(/Escolha uma imagem/)).toBeInTheDocument()
  expect(uploadMock).not.toHaveBeenCalled()
})

it('recusa imagem acima de 5 MB quando a redução falha', async () => {
  escolher(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.jpg', { type: 'image/jpeg' }))
  expect(await screen.findByText(/até 5 MB/)).toBeInTheDocument()
  expect(uploadMock).not.toHaveBeenCalled()
})

it('envia JPEG válido pelo caminho da obra e do dia', async () => {
  const onChange = escolher(new File(['foto'], 'foto.jpg', { type: 'image/jpeg' }))
  await waitFor(() => expect(uploadMock).toHaveBeenCalledWith(
    'obra-1/2026-09-05.jpg', expect.any(Blob),
    { contentType: 'image/jpeg', upsert: true },
  ))
  expect(onChange).toHaveBeenCalledWith('obra-1/2026-09-05.jpg')
})
