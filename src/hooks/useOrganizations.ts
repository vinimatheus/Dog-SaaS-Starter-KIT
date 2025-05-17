// src/hooks/use-organizations.ts
import { useCallback, useEffect, useState } from "react"

type Organization = {
  id: string
  name: string
  uniqueId: string
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/organizations")
      if (!res.ok) throw new Error("Erro ao buscar organizações")
      const data: Organization[] = await res.json()
      setOrganizations(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erro desconhecido"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  return { organizations, loading, error, refetch: fetchOrganizations }
}
