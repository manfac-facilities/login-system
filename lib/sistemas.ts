export interface Sistema {
  slug: string
  label: string
}

// Fonte única dos sistemas do hub. O `slug` é o que vai para `hub_system_access`;
// o `label` é o nome que o cliente usa.
export const SISTEMAS: Sistema[] = [
  { slug: 'sofia', label: 'Gestão de Frotas' },
  { slug: 'conversor-os', label: 'Conversor OS' },
  { slug: 'dashboard-manutencao', label: 'Cockpit Manutenção Predial' },
]
