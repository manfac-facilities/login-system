import fs from 'fs'
import path from 'path'
import { navSections, detailRoutes } from '../Sidebar'

describe('Sidebar navigation integrity', () => {
  const allHrefs = [
    ...navSections.flatMap((s) => s.items.map((i) => i.href)),
    ...detailRoutes,
  ]

  it.each(allHrefs)('route %s resolves to an existing page.tsx', (href) => {
    const segments = href.replace(/^\//, '').split('/')
    const filePath = path.join(process.cwd(), 'app', '(operacoes)', ...segments, 'page.tsx')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('every nav section has at least one item', () => {
    navSections.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0)
    })
  })
})
