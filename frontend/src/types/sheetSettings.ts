export interface SheetSettings {
  sourceLanguage: string | null
  translationStyle: string | null
  characterLimit: number | null
  glossaryOverride: string | null
  instructions: string | null
}

export interface SheetSettingsResponse {
  projectId: string
  sheetName: string
  settings: SheetSettings
  projectDefaults: SheetSettings
}
