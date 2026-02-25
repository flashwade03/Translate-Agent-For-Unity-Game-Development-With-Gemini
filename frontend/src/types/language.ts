export interface ProjectLanguage {
  code: string
  label: string
}

export interface LanguageDeleteResult {
  ok: boolean
  affectedSheets: number
  affectedTranslations: number
}
