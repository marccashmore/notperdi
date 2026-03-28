import { useState } from 'react'

interface Props {
  onLogin: (password: string) => Promise<boolean>
  onClose: () => void
}

export function AdminLogin({ onLogin, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const ok = await onLogin(password)
    setLoading(false)
    if (ok) {
      onClose()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1a5c2a] px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[#4ade80] text-xs font-bold uppercase tracking-widest">Admin</p>
            <p className="text-white text-lg font-extrabold">Enter password</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-colors ${
              error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-[#1a5c2a]'
            }`}
          />
          {error && <p className="text-red-500 text-sm font-medium">Incorrect password.</p>}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full bg-[#1a5c2a] text-white font-bold py-3 rounded-xl hover:bg-[#154d23] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking...' : 'Unlock Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
