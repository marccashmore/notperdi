import { useCallback, useEffect, useState } from 'react'

export interface User {
  id: number
  name: string
}

export interface AttendanceRecord extends User {
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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addUser = useCallback(
    async (name: string) => {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      refresh()
    },
    [refresh]
  )

  const deleteUser = useCallback(
    async (id: number) => {
      await fetch(`/api/users/${id}`, { method: 'DELETE' })
      refresh()
    },
    [refresh]
  )

  const renameUser = useCallback(
    async (id: number, name: string) => {
      await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      refresh()
    },
    [refresh]
  )

  return { users, loading, addUser, deleteUser, renameUser }
}

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch('/api/users/attendance')
      .then((r) => r.json())
      .then((data) => setRecords(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { records, loading, refresh }
}
