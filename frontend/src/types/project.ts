export interface Project {
  id: string
  name: string
  description: string
  sheetCount: number
  lastTranslatedAt: string | null
  createdAt: string
}

export interface CreateProjectPayload {
  name: string
  description: string
}
