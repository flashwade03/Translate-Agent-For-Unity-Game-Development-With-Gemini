import { useQuery } from '@tanstack/react-query'
import { fetchJobHistory } from '../api/jobHistory'
import { QUERY_KEYS } from '../lib/constants'

export function useJobHistory(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.jobHistory(projectId),
    queryFn: () => fetchJobHistory(projectId),
    enabled: !!projectId,
  })
}
