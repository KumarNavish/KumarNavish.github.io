import 'react'

declare module 'react' {
  interface CSSProperties {
    '--node-x'?: string
    '--node-y'?: string
    '--path-index'?: number
  }
}
