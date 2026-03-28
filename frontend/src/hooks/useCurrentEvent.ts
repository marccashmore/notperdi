import { useCallback, useEffect, useState } from 'react'

export interface CurrentEvent {
  id: number
  match_date: string
  location: string | null
  notes: string | null
  cancelled: boolean
  player_limit: number
  rsvp_opens_day: number   // 0=Mon … 6=Sun
  rsvp_opens_hour: number  // UTC hour 0–23
  rsvp_open: boolean       // computed by API: is the window currently open?
  winner: 0 | 1 | 2 | null
  rsvps: Record<number, 'in' | 'out' | 'ill'>
  in_order: number[]   // user_ids of 'in' players, sorted by responded_at ascending
  teams: Record<number, 1 | 2>
}

export function useCurrentEvent(targetDate: string) {
  const [event, setEvent] = useState<CurrentEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    const attempt = (retriesLeft: number) => {
      fetch(`/api/events/current?date=${targetDate}`)
        .then((r) => {
          if (!r.ok && retriesLeft > 0) throw new Error('retry')
          return r.json()
        })
        .then((data) => { setEvent(data); setError(null); setLoading(false) })
        .catch((e) => {
          if (retriesLeft > 0) {
            setTimeout(() => attempt(retriesLeft - 1), 2000)
          } else {
            setError(e.message === 'retry' ? 'Server is starting up, please refresh' : 'Failed to load event')
            setLoading(false)
          }
        })
    }
    attempt(3)
  }, [targetDate])

  useEffect(() => { refresh() }, [refresh])

  const setRsvp = useCallback(
    async (userId: number, status: 'in' | 'out' | 'ill') => {
      if (!event) return
      await fetch(`/api/events/${event.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, status }),
      })
      refresh()
    },
    [event, refresh]
  )

  const toggleCancelled = useCallback(async () => {
    if (!event) return
    await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelled: !event.cancelled }),
    })
    refresh()
  }, [event, refresh])

  const saveTeams = useCallback(
    async (assignments: { user_id: number; team: 1 | 2 }[]) => {
      if (!event) return
      await fetch(`/api/events/${event.id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      refresh()
    },
    [event, refresh]
  )

  const saveLimit = useCallback(async (limit: number) => {
    if (!event) return
    await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_limit: limit }),
    })
    refresh()
  }, [event, refresh])

  const saveRsvpSchedule = useCallback(async (day: number, hour: number) => {
    if (!event) return
    await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvp_opens_day: day, rsvp_opens_hour: hour }),
    })
    refresh()
  }, [event, refresh])

  const saveWinner = useCallback(async (winner: 0 | 1 | 2 | null) => {
    if (!event) return
    await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner }),
    })
    refresh()
  }, [event, refresh])

  return { event, loading, error, setRsvp, toggleCancelled, saveTeams, saveLimit, saveRsvpSchedule, saveWinner }
}
