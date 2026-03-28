import { useCallback, useEffect, useState } from 'react'

export interface User {
  id: number
  name: string
}

export interface AttendanceRecord extends User {
  rating: number
  attended: number
  out: number
  ill: number
  total_events: number
  attended_recent: number
  ill_recent: number
  recent_event_count: number
  attendance_rate: number | null
  win_rate: number | null
  games_with_result: number
}

export function useUsers() {
  const addUser = useCallback(async (name: string) => {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }, [])

  const deleteUser = useCallback(async (id: number) => {
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
  }, [])

  const renameUser = useCallback(async (id: number, name: string) => {
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }, [])

  return { addUser, deleteUser, renameUser }
}

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    const attempt = (retriesLeft: number) => {
      fetch('/api/users/attendance')
        .then((r) => {
          if (!r.ok && retriesLeft > 0) throw new Error('retry')
          return r.json()
        })
        .then((data) => { setRecords(data); setLoading(false) })
        .catch(() => {
          if (retriesLeft > 0) setTimeout(() => attempt(retriesLeft - 1), 2000)
          else setLoading(false)
        })
    }
    attempt(3)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const updateRating = useCallback(
    async (id: number, rating: number) => {
      await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      refresh()
    },
    [refresh]
  )

  return { records, loading, refresh, updateRating }
}
