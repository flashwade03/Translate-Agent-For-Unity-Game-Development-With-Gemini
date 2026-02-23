import { useQuery } from '@tanstack/react-query'
import { fetchSheetNames, fetchSheetData } from '../api/sheets'
import { QUERY_KEYS } from '../lib/constants'

export function useSheetNames(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.sheets(projectId),
    queryFn: () => fetchSheetNames(projectId),
    enabled: !!projectId,
  })
}

export function useSheetData(projectId: string, sheetName: string) {
  return useQuery({
    queryKey: QUERY_KEYS.sheetData(projectId, sheetName),
    queryFn: () => fetchSheetData(projectId, sheetName),
    enabled: !!projectId && !!sheetName,
  })
}
