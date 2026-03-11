export type SourceType = 'csv' | 'gws'

export interface Project {
  id: string
  name: string
  description: string
  sourceType: SourceType
  spreadsheetId: string | null
  sheetCount: number
  lastTranslatedAt: string | null
  createdAt: string
}

export interface CreateProjectPayload {
  name: string
  description: string
  sourceType?: SourceType
  spreadsheetId?: string
}
