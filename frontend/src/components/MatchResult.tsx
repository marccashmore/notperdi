import { CurrentEvent } from '../hooks/useCurrentEvent'

interface Props {
  event: CurrentEvent
  isAdmin: boolean
  onSaveWinner: (winner: 0 | 1 | 2 | null) => void
}

export function MatchResult({ event, isAdmin, onSaveWinner }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">Result</h3>
      </div>
      <div className="px-6 py-5">
        {event.winner !== null ? (
          <div className="flex gap-3 items-center">
            <span className={`flex-1 text-center text-sm font-bold py-3 rounded-xl ${event.winner === 1 ? 'bg-red-600 text-white' : event.winner === 2 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {event.winner === 1 ? '🔴 Red won' : event.winner === 2 ? '⚫ Black won' : '🤝 Draw'}
            </span>
            {isAdmin && (
              <button
                onClick={() => onSaveWinner(null)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        ) : isAdmin ? (
          <div className="flex gap-3">
            <button
              onClick={() => onSaveWinner(1)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl active:scale-95 transition-all text-sm"
            >
              🔴 Red won
            </button>
            <button
              onClick={() => onSaveWinner(0)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl active:scale-95 transition-all text-sm"
            >
              🤝 Draw
            </button>
            <button
              onClick={() => onSaveWinner(2)}
              className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl active:scale-95 transition-all text-sm"
            >
              ⚫ Black won
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No result recorded yet</p>
        )}
      </div>
    </div>
  )
}
