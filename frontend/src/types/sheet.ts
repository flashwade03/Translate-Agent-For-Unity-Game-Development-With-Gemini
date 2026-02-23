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
