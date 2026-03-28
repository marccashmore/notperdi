import { User } from '../hooks/useUsers'

interface Props {
  teamA: User[]  // Red — top half
  teamB: User[]  // Black — bottom half
}

const W = 300
const H = 460
const PAD = 14

// Positions as [x, y] fractions:
//   x: 0 = left touchline, 1 = right touchline
//   y: 0 = own goal line, 1 = centre line
const FORMATIONS: Record<number, [number, number][]> = {
  1: [[0.5, 0.08]],
  2: [[0.5, 0.08], [0.5, 0.78]],
  3: [[0.5, 0.08], [0.25, 0.68], [0.75, 0.68]],
  4: [[0.5, 0.08], [0.2, 0.44], [0.8, 0.44], [0.5, 0.82]],
  5: [[0.5, 0.08], [0.22, 0.38], [0.78, 0.38], [0.28, 0.78], [0.72, 0.78]],
  6: [[0.5, 0.08], [0.2, 0.32], [0.8, 0.32], [0.5, 0.54], [0.28, 0.8], [0.72, 0.8]],
  7: [[0.5, 0.08], [0.2, 0.28], [0.8, 0.28], [0.18, 0.57], [0.5, 0.57], [0.82, 0.57], [0.5, 0.86]],
  8: [[0.5, 0.08], [0.15, 0.28], [0.85, 0.28], [0.15, 0.54], [0.85, 0.54], [0.25, 0.8], [0.5, 0.8], [0.75, 0.8]],
}

function positions(count: number): [number, number][] {
  if (FORMATIONS[count]) return FORMATIONS[count]
  // Fallback: distribute evenly in rows of up to 3
  const result: [number, number][] = []
  let rem = count
  const rows = Math.ceil(count / 3)
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(3, rem)
    const y = 0.08 + (r / Math.max(rows - 1, 1)) * 0.82
    for (let c = 0; c < inRow; c++) {
      result.push([(c + 1) / (inRow + 1), y])
    }
    rem -= inRow
  }
  return result
}

function firstName(name: string): string {
  const f = name.split(' ')[0]
  return f.length > 9 ? f.slice(0, 8) + '…' : f
}

const pitchW = W - 2 * PAD
const halfH = H / 2 - PAD

function toPixTop(fx: number, fy: number) {
  return { x: PAD + fx * pitchW, y: PAD + fy * halfH }
}
function toPixBottom(fx: number, fy: number) {
  return { x: PAD + fx * pitchW, y: H - PAD - fy * halfH }
}

export function PitchView({ teamA, teamB }: Props) {
  const posA = positions(teamA.length)
  const posB = positions(teamB.length)
  const hasTeams = teamA.length > 0 || teamB.length > 0
  if (!hasTeams) return null

  const cx = W / 2
  const cy = H / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl">
      {/* Striped pitch */}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect
          key={i}
          x={PAD} y={PAD + i * ((H - 2 * PAD) / 9)}
          width={pitchW} height={(H - 2 * PAD) / 9}
          fill={i % 2 === 0 ? '#2d7a3a' : '#2a6e33'}
        />
      ))}

      {/* Outer border */}
      <rect x={PAD} y={PAD} width={pitchW} height={H - 2 * PAD} fill="none" stroke="#4ade80" strokeWidth="1.5" />

      {/* Centre line */}
      <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="#4ade80" strokeWidth="1.5" />

      {/* Centre circle */}
      <circle cx={cx} cy={cy} r={36} fill="none" stroke="#4ade80" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={2.5} fill="#4ade80" />

      {/* Penalty area — top */}
      <rect x={cx - 52} y={PAD} width={104} height={52} fill="none" stroke="#4ade80" strokeWidth="1.5" />
      <rect x={cx - 26} y={PAD} width={52} height={22} fill="none" stroke="#4ade80" strokeWidth="1.5" />
      <circle cx={cx} cy={PAD + 34} r={2} fill="#4ade80" />

      {/* Penalty area — bottom */}
      <rect x={cx - 52} y={H - PAD - 52} width={104} height={52} fill="none" stroke="#4ade80" strokeWidth="1.5" />
      <rect x={cx - 26} y={H - PAD - 22} width={52} height={22} fill="none" stroke="#4ade80" strokeWidth="1.5" />
      <circle cx={cx} cy={H - PAD - 34} r={2} fill="#4ade80" />

      {/* Team A — Red — top half */}
      {teamA.map((u, i) => {
        const [fx, fy] = posA[i] ?? [0.5, 0.5]
        const { x, y } = toPixTop(fx, fy)
        return (
          <g key={u.id}>
            <circle cx={x} cy={y} r={10} fill="#dc2626" stroke="white" strokeWidth="1.5" />
            <text x={x} y={y + 22} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">
              {firstName(u.name)}
            </text>
          </g>
        )
      })}

      {/* Team B — Black — bottom half */}
      {teamB.map((u, i) => {
        const [fx, fy] = posB[i] ?? [0.5, 0.5]
        const { x, y } = toPixBottom(fx, fy)
        return (
          <g key={u.id}>
            <circle cx={x} cy={y} r={10} fill="#111827" stroke="white" strokeWidth="1.5" />
            <text x={x} y={y - 14} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">
              {firstName(u.name)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
