import { useEffect, useState } from 'react'
import { CurrentEvent } from '../hooks/useCurrentEvent'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

interface Props {
  event: CurrentEvent
  isAdmin: boolean
  weekOffset: number
  weekLabel: string
  onPrev: () => void
  onNext: () => void
  onResetWeek: () => void
  onSaveLimit: (limit: number) => void
  onSaveRsvpSchedule: (day: number, hour: number) => void
}

export function EventHeader({ event, isAdmin, weekOffset, weekLabel, onPrev, onNext, onResetWeek, onSaveLimit, onSaveRsvpSchedule }: Props) {
  const [opensDay, setOpensDay] = useState(event.rsvp_opens_day)
  const [opensHour, setOpensHour] = useState(event.rsvp_opens_hour)

  useEffect(() => {
    setOpensDay(event.rsvp_opens_day)
    setOpensHour(event.rsvp_opens_hour)
  }, [event.id])

  const date = new Date(event.match_date + 'T00:00:00')
  const day = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  const handleDayChange = (d: number) => {
    setOpensDay(d)
    onSaveRsvpSchedule(d, opensHour)
  }

  const handleHourChange = (h: number) => {
    setOpensHour(h)
    onSaveRsvpSchedule(opensDay, h)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      {/* Week navigation */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button
          onClick={onPrev}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg active:scale-95 transition-all"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-800">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button
              onClick={onResetWeek}
              className="text-xs text-[#1a5c2a] font-semibold hover:underline"
            >
              Back to this week
            </button>
          )}
        </div>
        <button
          onClick={onNext}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg active:scale-95 transition-all"
        >
          ›
        </button>
      </div>

      {/* Date banner */}
      <div className="bg-[#1a5c2a] px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-[#4ade80] text-xs font-semibold uppercase tracking-widest">{day}</p>
          <p className="text-white text-xl font-bold mt-0.5">{dateStr}</p>
          {event.location && (
            <p className="text-green-200 text-sm mt-0.5">📍 {event.location}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {event.cancelled && (
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
              Cancelled
            </span>
          )}
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
              <span className="text-green-200 text-xs font-semibold">Limit</span>
              <button
                onClick={() => onSaveLimit(Math.max(2, event.player_limit - 1))}
                className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-sm leading-none flex items-center justify-center active:scale-95 transition-all"
              >
                −
              </button>
              <span className="text-white font-bold text-sm w-6 text-center">{event.player_limit}</span>
              <button
                onClick={() => onSaveLimit(event.player_limit + 1)}
                className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-sm leading-none flex items-center justify-center active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin: RSVP window settings */}
      {isAdmin && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">RSVPs open</span>
          <select
            value={opensDay}
            onChange={(e) => handleDayChange(Number(e.target.value))}
            className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1a5c2a]"
          >
            {DAYS.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">at</span>
          <select
            value={opensHour}
            onChange={(e) => handleHourChange(Number(e.target.value))}
            className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1a5c2a]"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">(UK time)</span>
        </div>
      )}

      {/* Non-admin: show when RSVPs open if window not yet open */}
      {!isAdmin && !event.rsvp_open && (
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700 font-medium">
            RSVPs open {DAYS[event.rsvp_opens_day]} at {formatHour(event.rsvp_opens_hour)}
          </p>
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-sm text-amber-800">📝 {event.notes}</p>
        </div>
      )}
    </div>
  )
}
