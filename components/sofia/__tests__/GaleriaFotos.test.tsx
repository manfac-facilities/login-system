// components/sofia/__tests__/GaleriaFotos.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import GaleriaFotos from '../GaleriaFotos'

describe('GaleriaFotos', () => {
  it('mostra uma mensagem quando não há fotos', () => {
    render(<GaleriaFotos fotos={[]} />)
    expect(screen.getByText(/nenhuma foto/i)).toBeInTheDocument()
  })

  it('renderiza uma miniatura por foto', () => {
    render(
      <GaleriaFotos
        fotos={[
          { id: '1', url: 'https://example.com/frente.jpg', label: 'Frente' },
          { id: '2', url: 'https://example.com/traseira.jpg', label: 'Traseira' },
        ]}
      />
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByAltText('Frente')).toBeInTheDocument()
    expect(screen.getByAltText('Traseira')).toBeInTheDocument()
  })

  it('abre a foto em tela cheia ao clicar na miniatura, e fecha ao clicar de novo', () => {
    render(<GaleriaFotos fotos={[{ id: '1', url: 'https://example.com/frente.jpg', label: 'Frente' }]} />)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getAllByAltText('Frente')).toHaveLength(2) // miniatura + versão ampliada

    fireEvent.click(screen.getAllByAltText('Frente')[1])
    expect(screen.getAllByAltText('Frente')).toHaveLength(1) // fechou, só a miniatura sobra
  })
})
