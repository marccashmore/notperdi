import { useState } from 'react'
import { EventHeader } from './components/EventHeader'
import { MatchView } from './components/MatchView'
import { PlayerManager } from './components/PlayerManager'
import { MatchResult } from './components/MatchResult'
import { AdminLogin } from './components/AdminLogin'
import { useCurrentEvent } from './hooks/useCurrentEvent'
import { useUsers, useAttendance } from './hooks/useUsers'
import { useAdmin } from './hooks/useAdmin'

type Tab = 'week' | 'players'

function getWednesday(offset: number): string {
  const today = new Date()
  const daysUntilWed = (3 - today.getDay() + 7) % 7
  const wed = new Date(today)
  wed.setDate(today.getDate() + daysUntilWed + offset * 7)
  return wed.toISOString().split('T')[0]
}

function weekLabel(offset: number): string {
  if (offset === 0) return 'This week'
  if (offset === -1) return 'Last week'
  if (offset === 1) return 'Next week'
  const d = new Date(getWednesday(offset) + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function App() {
  const [tab, setTab] = useState<Tab>('week')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const targetDate = getWednesday(weekOffset)
  const { event, loading: eventLoading, error, setRsvp, toggleCancelled, saveTeams, saveLimit, saveRsvpSchedule, saveWinner } = useCurrentEvent(targetDate)
  const { users, addUser, deleteUser, renameUser } = useUsers()
  const { records, refresh: refreshAttendance } = useAttendance()
  const { isAdmin, login, logout } = useAdmin()

  const scores: Record<number, number> = Object.fromEntries(records.map((r) => [r.id, r.win_rate ?? 0.5]))
  const winRates: Record<number, number | null> = Object.fromEntries(records.map((r) => [r.id, r.win_rate]))

  const isPastOrToday = event ? new Date(event.match_date + 'T00:00:00') <= new Date(new Date().toDateString()) : false

  return (
    <div className="min-h-screen bg-[#f0f2f0]">
      {/* Header */}
      <header className="bg-[#1a5c2a] px-5 pt-5 pb-9">
        <div className="relative flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Not Perdi ⚽</h1>
            <p className="text-[#4ade80] text-xs font-semibold mt-0.5">Wednesday Football</p>
          </div>
          <div className="absolute right-8">
            {isAdmin ? (
              <button
                onClick={() => { logout(); setTab('week') }}
                className="text-[#4ade80] text-2xl hover:text-white transition-colors"
              >
                🔓
              </button>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="text-green-300/60 text-2xl hover:text-white transition-colors"
              >
                🔒
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Centered content column */}
      <div className="max-w-xl mx-auto px-4">
        {/* Tab bar — admin only */}
        {isAdmin && (
          <div className="sticky top-0 z-10 -mt-5 mb-5">
            <div className="bg-white rounded-2xl shadow-lg flex overflow-hidden">
              <button
                onClick={() => setTab('week')}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${
                  tab === 'week' ? 'text-[#1a5c2a] border-b-2 border-[#1a5c2a]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                📅 Week
              </button>
              <button
                onClick={() => setTab('players')}
                className={`flex-1 py-4 text-sm font-semibold transition-all ${
                  tab === 'players' ? 'text-[#1a5c2a] border-b-2 border-[#1a5c2a]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                👥 Players
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className={`pb-8 ${!isAdmin ? '-mt-5' : ''}`}>
          {tab === 'week' && (
            <>
              {eventLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-[#1a5c2a] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}
              {event && (
                <>
                  <EventHeader
                    event={event}
                    isAdmin={isAdmin}
                    weekOffset={weekOffset}
                    weekLabel={weekLabel(weekOffset)}
                    onPrev={() => setWeekOffset((o) => o - 1)}
                    onNext={() => setWeekOffset((o) => o + 1)}
                    onResetWeek={() => setWeekOffset(0)}
                    onSaveLimit={saveLimit}
                    onSaveRsvpSchedule={saveRsvpSchedule}
                  />
                  {event.cancelled ? (
                    <div className="space-y-3">
                      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
                        <p className="text-4xl mb-3">🚫</p>
                        <p className="text-red-700 font-bold text-lg">Match cancelled</p>
                        <p className="text-red-400 text-sm mt-1">See you next Wednesday!</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={toggleCancelled}
                          className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95 bg-green-50 text-[#1a5c2a] hover:bg-green-100 border border-green-200"
                        >
                          ✅ Reinstate match
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <MatchView
                        key={event.id}
                        users={users}
                        event={event}
                        onRsvp={setRsvp}
                        onSaveTeams={saveTeams}
                        isAdmin={isAdmin}
                        scores={scores}
                        winRates={winRates}
                      />
                      {isPastOrToday && (
                        <MatchResult event={event} isAdmin={isAdmin} onSaveWinner={saveWinner} />
                      )}
                      {isAdmin && (
                        <button
                          onClick={toggleCancelled}
                          className="w-full mt-2 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                        >
                          🚫 Cancel this match
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'players' && isAdmin && (
            <PlayerManager
              records={records}
              onAdd={async (name) => { await addUser(name); refreshAttendance() }}
              onDelete={async (id) => { await deleteUser(id); refreshAttendance() }}
              onRename={async (id, name) => { await renameUser(id, name); refreshAttendance() }}
            />
          )}
        </main>
      </div>

      {/* Admin login modal */}
      {showAdminLogin && (
        <AdminLogin onLogin={login} onClose={() => setShowAdminLogin(false)} />
      )}
    </div>
  )
}
