'use client'

import { useState } from 'react'

/**
 * Cascade veículo↔motorista compartilhado (achado U-06 da auditoria).
 * Antes, o mesmo vínculo era implementado de 3 formas divergentes nos
 * formulários de multa, sinistro e revisão (uns bidirecionais, outro de uma
 * via, com/sem limpeza do lado oposto). Este hook centraliza a lógica:
 *
 * - `onVeiculoChange`: seleciona o veículo e auto-preenche o motorista dele
 *   (limpando o motorista se o veículo não tiver um vinculado).
 * - `onMotoristaChange`: seleciona o motorista e auto-preenche o veículo dele
 *   (mantém o veículo atual se a busca falhar).
 * - `setMotoristaId`/`setVeiculoId`: para telas onde um dos lados é escolhido
 *   manualmente sem disparar o cascade reverso (ex.: revisão é de uma via só).
 */
export function useVeiculoMotoristaCascade() {
  const [veiculoId, setVeiculoId] = useState('')
  const [motoristaId, setMotoristaId] = useState('')

  async function onVeiculoChange(id: string) {
    setVeiculoId(id)
    if (!id) {
      setMotoristaId('')
      return
    }
    try {
      const res = await fetch(`/api/sofia/veiculo-motorista?veiculo_id=${id}`)
      const data = await res.json()
      setMotoristaId(data?.motoristas?.id ?? '')
    } catch {
      setMotoristaId('')
    }
  }

  async function onMotoristaChange(id: string) {
    setMotoristaId(id)
    if (!id) return
    try {
      const res = await fetch(`/api/sofia/veiculo-motorista?motorista_id=${id}`)
      const data = await res.json()
      if (data?.veiculo?.id) setVeiculoId(data.veiculo.id)
    } catch {
      // mantém o veículo atual em caso de falha
    }
  }

  return { veiculoId, motoristaId, setVeiculoId, setMotoristaId, onVeiculoChange, onMotoristaChange }
}
