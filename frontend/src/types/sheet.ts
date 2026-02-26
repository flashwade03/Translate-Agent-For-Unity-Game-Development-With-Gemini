export interface SheetRow {
  key: string
  [langCode: string]: string
}

export interface SheetData {
  sheetName: string
  headers: string[]
  languages: Language[]
  rows: SheetRow[]
}

export interface Language {
  code: string
  label: string
  isSource: boolean
}

export interface CsvUploadResult {
  addedKeys: number
  updatedKeys: number
  addedLanguages: { code: string; label: string }[]
}
