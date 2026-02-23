export interface GlossaryEntry {
  id: string
  source: string
  target: string
  context?: string
  language: string
}

export interface Glossary {
  projectId: string
  entries: GlossaryEntry[]
}
