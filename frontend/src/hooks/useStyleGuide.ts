import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchStyleGuide, updateStyleGuide } from '../api/config'
import { QUERY_KEYS } from '../lib/constants'
import type { StyleGuide } from '../types'

export function useStyleGuide(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.styleGuide(projectId),
    queryFn: () => fetchStyleGuide(projectId),
    enabled: !!projectId,
  })
}

export function useUpdateStyleGuide(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guide: StyleGuide) => updateStyleGuide(projectId, guide),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.styleGuide(projectId) })
    },
  })
}
