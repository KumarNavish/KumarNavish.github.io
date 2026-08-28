import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const obsolete = [
  'public/assets/folio.css',
  'public/assets/folio.js',
]

await Promise.all(
  obsolete.map((relativePath) => rm(resolve(root, relativePath), { recursive: true, force: true })),
)

console.log(`Pruned ${obsolete.length} obsolete public surfaces before production build.`)
