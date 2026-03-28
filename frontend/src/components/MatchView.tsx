import { useState } from 'react'
import { CurrentEvent } from '../hooks/useCurrentEvent'
import { User } from '../hooks/useUsers'
import { PitchView } from './PitchView'

type RsvpStatus = 'in' | 'out' | 'ill'

const STATUS_CONFIG: Record<RsvpStatus, { label: string; activeBg: string; activeText: string; idleBg: string; idleText: string }> = {
  in:  { label: "I'm In",      activeBg: 'bg-green-600', activeText: 'text-white', idleBg: 'bg-green-50',  idleText: 'text-green-700'  },
  out: { label: "I'm Out",     activeBg: 'bg-red-500',   activeText: 'text-white', idleBg: 'bg-red-50',    idleText: 'text-red-600'    },
  ill: { label: "I'm Injured", activeBg: 'bg-amber-400', activeText: 'text-white', idleBg: 'bg-amber-50',  idleText: 'text-amber-700'  },
}

const PILL: Record<RsvpStatus, string> = {
  in:  'bg-green-100 text-green-800',
  out: 'bg-red-100 text-red-700',
  ill: 'bg-amber-100 text-amber-700',
}

type TeamMap = Record<number, 1 | 2>

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function draftSplit(players: User[], starRatings: Record<number, number>, winRates: Record<number, number | null>): TeamMap {
  const n = players.length
  if (n === 0) return {}
  const capSmall = Math.floor(n / 2)
  const available = [...players].sort((a, b) => {
    const rDiff = (starRatings[b.id] ?? 3) - (starRatings[a.id] ?? 3)
    if (rDiff !== 0) return rDiff
    return (winRates[b.id] ?? 0) - (winRates[a.id] ?? 0)
  })
  const teamA: User[] = [], teamB: User[] = []
  const result: TeamMap = {}
  const startA = Math.random() < 0.5
  while (available.length > 0) {
    const sumRatingA = teamA.reduce((s, u) => s + (starRatings[u.id] ?? 3), 0)
    const sumRatingB = teamB.reduce((s, u) => s + (starRatings[u.id] ?? 3), 0)
    const sumWinA = teamA.reduce((s, u) => s + (winRates[u.id] ?? 0), 0)
    const sumWinB = teamB.reduce((s, u) => s + (winRates[u.id] ?? 0), 0)
    let pickA: boolean
    if (teamA.length === 0 && teamB.length === 0) {
      pickA = startA
    } else if (sumRatingA !== sumRatingB) {
      pickA = sumRatingA < sumRatingB
    } else if (sumWinA !== sumWinB) {
      pickA = sumWinA < sumWinB
    } else {
      pickA = Math.random() < 0.5
    }
    const player = available.shift()!
    if (pickA) { teamA.push(player); result[player.id] = 1 }
    else        { teamB.push(player); result[player.id] = 2 }
    if (teamA.length === capSmall || teamB.length === capSmall) {
      const rest: 1 | 2 = teamA.length === capSmall ? 2 : 1
      for (const p of available) result[p.id] = rest
      break
    }
  }
  return result
}

interface Props {
  users: User[]
  event: CurrentEvent
  onRsvp: (userId: number, status: RsvpStatus) => void
  onSaveTeams: (assignments: { user_id: number; team: 1 | 2 }[]) => void
  isAdmin: boolean
  starRatings: Record<number, number>
  winRates: Record<number, number | null>
}

export function MatchView({ users, event, onRsvp, onSaveTeams, isAdmin, starRatings, winRates }: Props) {
  // RSVP modal state
  const [picking, setPicking] = useState<RsvpStatus | null>(null)
  const [search, setSearch] = useState('')

  // Team state
  const [teams, setTeams] = useState<TeamMap>(() => {
    const t: TeamMap = {}
    for (const [uid, team] of Object.entries(event.teams)) t[Number(uid)] = team as 1 | 2
    return t
  })
  const [saved, setSaved] = useState(Object.keys(event.teams).length > 0)
  const [savedPlayingIds, setSavedPlayingIds] = useState<Set<number>>(
    () => new Set(Object.keys(event.teams).map(Number))
  )
  const [viewMode, setViewMode] = useState<'list' | 'pitch'>('list')
  const [assigning, setAssigning] = useState<User | null>(null)
  const [copied, setCopied] = useState(false)

  // Derived player groups
  const playingIds = new Set(event.in_order.slice(0, event.player_limit))
  const reserveIds = new Set(event.in_order.slice(event.player_limit))
  const playingUsers = event.in_order.slice(0, event.player_limit)
    .map((id) => users.find((u) => u.id === id)).filter((u): u is User => u !== undefined)
  const reserveUsers = event.in_order.slice(event.player_limit)
    .map((id) => users.find((u) => u.id === id)).filter((u): u is User => u !== undefined)
  const outUsers = users.filter((u) => event.rsvps[u.id] === 'out')
  const illUsers = users.filter((u) => event.rsvps[u.id] === 'ill')
  const playingCount = playingUsers.length
  const reserveCount = reserveUsers.length

  // Team groups
  const teamA = playingUsers.filter((u) => teams[u.id] === 1)
  const teamB = playingUsers.filter((u) => teams[u.id] === 2)
  const unassigned = playingUsers.filter((u) => teams[u.id] === undefined)

  const teamsAssigned = teamA.length > 0 || teamB.length > 0
  const showTeamControls = isAdmin && playingUsers.length >= 6

  // Attendance changed alert
  const currentInIds = new Set(playingUsers.map((u) => u.id))
  const attendanceChanged =
    savedPlayingIds.size > 0 && (
      [...savedPlayingIds].some((id) => !currentInIds.has(id)) ||
      [...currentInIds].some((id) => !savedPlayingIds.has(id))
    )

  // RSVP modal helpers
  const filtered = users
    .filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (event.rsvps[a.id] ? 1 : 0) - (event.rsvps[b.id] ? 1 : 0))

  const getStatusLabel = (userId: number): { label: string; pill: string } | null => {
    const status = event.rsvps[userId] as RsvpStatus | undefined
    if (!status) return null
    if (status === 'in') {
      if (playingIds.has(userId)) return { label: 'playing', pill: 'bg-green-100 text-green-800' }
      if (reserveIds.has(userId)) return { label: 'reserve', pill: 'bg-blue-100 text-blue-700' }
    }
    return { label: status, pill: PILL[status] }
  }

  const closeModal = () => { setPicking(null); setSearch('') }
  const handleSelect = (userId: number) => {
    if (!picking) return
    onRsvp(userId, picking)
    setPicking(null)
    setSearch('')
  }

  // Team actions
  const randomise = () => {
    const shuffled = shuffle(playingUsers)
    const half = Math.ceil(shuffled.length / 2)
    const t: TeamMap = {}
    shuffled.forEach((u, i) => { t[u.id] = i < half ? 1 : 2 })
    setTeams(t); setSaved(false)
  }
  const bestMatch = () => { setTeams(draftSplit(playingUsers, starRatings, winRates)); setSaved(false) }
  const swapPlayer = (userId: number) => {
    setTeams((prev) => ({ ...prev, [userId]: prev[userId] === 1 ? 2 : 1 }))
    setSaved(false)
  }
  const assignPlayer = (userId: number, team: 1 | 2) => {
    setTeams((prev) => ({ ...prev, [userId]: team }))
    setSaved(false); setAssigning(null)
  }
  const handleSave = () => {
    const inIds = new Set(playingUsers.map((u) => u.id))
    onSaveTeams(Object.entries(teams).filter(([uid]) => inIds.has(Number(uid))).map(([uid, team]) => ({ user_id: Number(uid), team })))
    setSaved(true)
    setSavedPlayingIds(new Set(playingUsers.map((u) => u.id)))
  }
  const handleClear = () => {
    onSaveTeams([])
    setTeams({}); setSaved(false); setSavedPlayingIds(new Set())
  }

  // Copy
  const copyTeams = () => {
    const dateLabel = new Date(event.match_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const lines: string[] = [`⚽ Wednesday Football — ${dateLabel}\n`]
    if (teamsAssigned) {
      lines.push('🔴 Red'); teamA.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`))
      lines.push(''); lines.push('⚫ Black'); teamB.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`))
      if (reserveUsers.length > 0) { lines.push(''); lines.push('🔵 Reserves'); reserveUsers.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`)) }
    } else {
      if (playingUsers.length > 0) { lines.push(`✅ Playing (${playingUsers.length}/${event.player_limit})`); playingUsers.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`)) }
      if (reserveUsers.length > 0) { lines.push(''); lines.push('🔵 Reserves'); reserveUsers.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`)) }
      if (outUsers.length > 0) { lines.push(''); lines.push('❌ Out'); outUsers.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`)) }
      if (illUsers.length > 0) { lines.push(''); lines.push('🩹 Injured'); illUsers.forEach((u, i) => lines.push(`${i + 1}. ${u.name}`)) }
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const cfg = picking ? STATUS_CONFIG[picking] : null

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">

        {/* ── RSVP header ── */}
        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900">Are you playing?</h3>
            <div className="text-right">
              <span className="text-sm font-bold text-green-600">{playingCount}/{event.player_limit}</span>
              {reserveCount > 0 && (
                <span className="text-xs font-semibold text-blue-500 ml-2">+{reserveCount} reserve{reserveCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (playingCount / event.player_limit) * 100)}%`,
                backgroundColor: playingCount >= event.player_limit ? '#16a34a' : '#4ade80',
              }}
            />
          </div>
        </div>

        {/* ── RSVP buttons ── */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100">
          {(['in', 'out', 'ill'] as RsvpStatus[]).map((status) => {
            const c = STATUS_CONFIG[status]
            const disabled = !isAdmin && !event.rsvp_open
            return (
              <button
                key={status}
                onClick={() => { if (!disabled) { setPicking(status); setSearch('') } }}
                disabled={disabled}
                className={`py-3 rounded-xl font-semibold text-sm transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 hover:opacity-80'} ${c.idleBg} ${c.idleText}`}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {/* ── Admin team controls ── */}
        {showTeamControls && (
          <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-gray-100">
            <button onClick={randomise} className="bg-indigo-500 text-white font-bold py-3 rounded-xl hover:bg-indigo-600 active:scale-95 transition-all text-sm">
              🎲 Random
            </button>
            <button onClick={bestMatch} className="bg-[#1a5c2a] text-white font-bold py-3 rounded-xl hover:bg-[#154d23] active:scale-95 transition-all text-sm">
              ⚖️ Best match
            </button>
            <button
              onClick={handleSave}
              disabled={Object.keys(teams).length === 0}
              className="col-span-2 bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black active:scale-95 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              💾 Save Teams
            </button>
          </div>
        )}

        {/* ── Unsaved changes alert ── */}
        {isAdmin && !saved && Object.keys(teams).length > 0 && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <p className="text-xs text-amber-700 font-medium">You have unsaved team changes — hit Save Teams to confirm.</p>
          </div>
        )}

        {/* ── Attendance changed alert ── */}
        {attendanceChanged && (
          <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <span>⚠️</span>
            <p className="text-xs text-orange-700 font-medium">Attendance has changed since teams were picked — teams may need updating.</p>
          </div>
        )}

        {/* ── Teams section (when assigned) ── */}
        {teamsAssigned && (
          <>
            {/* Teams header with view toggle */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Teams</p>
              <div className="flex items-center gap-2">
                {isAdmin && saved && (
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">✓ Saved</span>
                )}
                <button
                  onClick={() => setViewMode(viewMode === 'list' ? 'pitch' : 'list')}
                  className="text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {viewMode === 'list' ? '⚽ Pitch view' : '≡ List view'}
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  {([1, 2] as const).map((teamNum) => {
                    const members = teamNum === 1 ? teamA : teamB
                    const isA = teamNum === 1
                    return (
                      <div key={teamNum} className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-lg ${isA ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
                          <span>{isA ? '🔴' : '⚫'}</span>
                          <span>{isA ? 'Red' : 'Black'} · {members.length}</span>
                        </div>
                        <ul className="space-y-1.5">
                          {members.map((u) => {
                            const wr = winRates[u.id]
                            const wrPct = wr !== null && wr !== undefined ? Math.round(wr * 100) : null
                            return (
                            <li key={u.id}>
                              <button
                                onClick={() => isAdmin && swapPlayer(u.id)}
                                className={`w-full text-left text-sm font-semibold px-3 py-2 rounded-xl transition-all flex items-center justify-between gap-2 ${isAdmin ? 'active:scale-95 cursor-pointer' : 'cursor-default'} ${isA ? 'bg-red-50 text-red-900 hover:bg-red-100' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                              >
                                <span className="truncate">{u.name}</span>
                                <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-full ${wrPct === null ? 'bg-white/60 text-gray-400' : wrPct >= 60 ? 'bg-green-100 text-green-700' : wrPct >= 40 ? 'bg-gray-200 text-gray-500' : 'bg-red-100 text-red-600'}`}>
                                  {wrPct !== null ? `${wrPct}%` : '—'}
                                </span>
                              </button>
                            </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>

                {unassigned.length > 0 && (
                  <div className="border-t border-gray-100 px-6 py-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Unassigned · {unassigned.length}</p>
                    <div className="space-y-1.5">
                      {unassigned.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => isAdmin && setAssigning(u)}
                          className={`w-full text-left text-sm font-semibold px-3 py-2 bg-gray-50 text-gray-700 rounded-xl transition-all ${isAdmin ? 'hover:bg-gray-100 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isAdmin && <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-50">Tap a player to swap teams</p>}
              </>
            ) : (
              <div className="px-4 py-4">
                <PitchView teamA={teamA} teamB={teamB} />
              </div>
            )}
          </>
        )}

        {/* ── RSVP subcards ── */}
        {(!teamsAssigned && playingUsers.length > 0) || reserveUsers.length > 0 || outUsers.length > 0 || illUsers.length > 0 ? (
          <div className="px-4 py-4 border-t border-gray-100 space-y-3">
            {!teamsAssigned && playingUsers.length > 0 && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">✓ Playing · {playingUsers.length}</p>
                <div className="flex flex-wrap gap-2">
                  {playingUsers.map((u) => (
                    <span key={u.id} className="text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-800">{u.name}</span>
                  ))}
                </div>
              </div>
            )}
            {reserveUsers.length > 0 && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">Reserves · {reserveUsers.length}</p>
                <div className="flex flex-wrap gap-2">
                  {reserveUsers.map((u, i) => (
                    <span key={u.id} className="text-sm font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800">#{i + 1} {u.name}</span>
                  ))}
                </div>
              </div>
            )}
            {outUsers.length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-600">✕ Out · {outUsers.length}</p>
                <div className="flex flex-wrap gap-2">
                  {outUsers.map((u) => (
                    <span key={u.id} className="text-sm font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700">{u.name}</span>
                  ))}
                </div>
              </div>
            )}
            {illUsers.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide mb-2 text-amber-700">🩹 Injured · {illUsers.length}</p>
                <div className="flex flex-wrap gap-2">
                  {illUsers.map((u) => (
                    <span key={u.id} className="text-sm font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">{u.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* ── Copy / Clear ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={copyTeams}
            className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
          >
            {copied ? '✅ Copied!' : teamsAssigned ? '📋 Copy Teams' : '📋 Copy Responses'}
          </button>
          {isAdmin && (
            <button
              onClick={handleClear}
              className="w-1/4 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200"
              title="Clear teams"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* ── RSVP picker modal ── */}
      {picking && cfg && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className={`px-6 py-5 ${cfg.activeBg} flex items-center justify-between`}>
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${cfg.activeText} opacity-75`}>Select your name</p>
                <p className={`text-lg font-extrabold ${cfg.activeText}`}>{cfg.label}</p>
              </div>
              <button onClick={closeModal} className={`${cfg.activeText} opacity-75 hover:opacity-100 text-2xl leading-none`}>×</button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your name..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[#1a5c2a] transition-colors"
              />
            </div>
            {picking === 'in' && playingCount >= event.player_limit && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                <p className="text-xs text-blue-700 font-medium">The squad is full — you'll be added as a reserve.</p>
              </div>
            )}
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <li className="px-6 py-6 text-sm text-gray-400 text-center">No players found</li>
              ) : filtered.map((u) => {
                const statusLabel = getStatusLabel(u.id)
                return (
                  <li key={u.id}>
                    <button
                      onClick={() => handleSelect(u.id)}
                      className="w-full text-left px-6 py-3.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <span>{u.name}</span>
                      {statusLabel && (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusLabel.pill}`}>{statusLabel.label}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ── Assign team modal ── */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAssigning(null)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Assign to team</p>
              <p className="text-lg font-extrabold text-gray-900 mt-0.5">{assigning.name}</p>
            </div>
            <div className="p-4 flex gap-3">
              <button onClick={() => assignPlayer(assigning.id, 1)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl active:scale-95 transition-all text-sm">🔴 Red</button>
              <button onClick={() => assignPlayer(assigning.id, 2)} className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl active:scale-95 transition-all text-sm">⚫ Black</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
