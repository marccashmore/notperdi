import { useState } from 'react'
import { AttendanceRecord } from '../hooks/useUsers'

interface Props {
  records: AttendanceRecord[]
  onAdd: (name: string) => void
  onDelete: (id: number) => void
  onRename: (id: number, name: string) => void
  onRate: (id: number, rating: number) => void
}

export function PlayerManager({ records, onAdd, onDelete, onRename, onRate }: Props) {
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editingRating, setEditingRating] = useState<number | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  const startEdit = (id: number, currentName: string) => {
    setEditing(id)
    setEditName(currentName)
    setConfirmDelete(null)
  }

  const commitEdit = (id: number) => {
    const trimmed = editName.trim()
    if (trimmed) onRename(id, trimmed)
    setEditing(null)
  }

  const sorted = [...records].sort((a, b) => (b.attendance_rate ?? -1) - (a.attendance_rate ?? -1))

  return (
    <div className="space-y-4">
      {/* Add player */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Add Player</h3>
        </div>
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[#1a5c2a] transition-colors"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-[#1a5c2a] text-white font-bold px-6 py-3.5 rounded-xl text-sm hover:bg-[#154d23] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Player list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Squad</h3>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{records.length} players</span>
        </div>

        {sorted.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm text-gray-400 font-medium">No players yet. Add some above.</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-400">Sorted by attendance · illness doesn't count against you · win % = won / played</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {sorted.map((record, i) => {
                const rate = record.attendance_rate !== null
                  ? Math.round(record.attendance_rate * 100)
                  : null

                return (
                  <li key={record.id} className="flex items-center gap-3 px-6 py-4">
                    {/* Rank */}
                    <span className="text-xs font-bold text-gray-300 w-5 shrink-0">{i + 1}</span>

                    {/* Info / edit */}
                    {editing === record.id ? (
                      <form
                        className="flex-1 flex gap-2"
                        onSubmit={(e) => { e.preventDefault(); commitEdit(record.id) }}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 border-2 border-[#1a5c2a] rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!editName.trim()}
                          className="text-xs bg-[#1a5c2a] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[#154d23] active:scale-95 transition-all disabled:opacity-30"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 active:scale-95 transition-all"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{record.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {record.attended_recent + record.ill_recent}/{record.recent_event_count} last 6 wks
                          </p>
                        </div>

                        {/* Stacked Att / Win pills */}
                        <div className="flex flex-col gap-1 shrink-0 items-end">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rate === null ? 'bg-gray-100 text-gray-400' : rate >= 75 ? 'bg-green-100 text-green-700' : rate >= 50 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                            Att: {rate !== null ? `${rate}%` : '—'}
                          </span>
                          {(() => {
                            if (record.games_with_result === 0) {
                              return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Win: —</span>
                            }
                            const pct = Math.round((record.win_rate ?? 0) * 100)
                            const color = pct >= 60 ? 'bg-green-100 text-green-700' : pct >= 40 ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                            return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>Win: {pct}%</span>
                          })()}
                        </div>

                        {/* Star rating */}
                        {editingRating === record.id ? (
                          <div className="flex gap-1 shrink-0">
                            {[1,2,3,4,5].map((n) => (
                              <button
                                key={n}
                                onClick={() => { onRate(record.id, n); setEditingRating(null) }}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all active:scale-95 ${n === record.rating ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-amber-100'}`}
                              >
                                {n}
                              </button>
                            ))}
                            <button onClick={() => setEditingRating(null)} className="w-7 h-7 rounded-lg text-xs bg-gray-100 text-gray-400 hover:bg-gray-200">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingRating(record.id); setConfirmDelete(null); setEditing(null) }}
                            className="shrink-0 bg-amber-100 text-amber-700 font-bold text-xs px-2.5 py-1 rounded-full hover:bg-amber-200 active:scale-95 transition-all"
                            title="Set star rating"
                          >
                            ⭐ {record.rating ?? 3}
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => startEdit(record.id, record.name)}
                          className="shrink-0 text-gray-300 hover:text-[#1a5c2a] transition-colors text-sm leading-none px-1"
                          title="Rename player"
                        >
                          ✏️
                        </button>

                        {/* Delete */}
                        {confirmDelete === record.id ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => { onDelete(record.id); setConfirmDelete(null) }}
                              className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 active:scale-95 transition-all"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 active:scale-95 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(record.id)}
                            className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                            title="Remove player"
                          >
                            ×
                          </button>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
