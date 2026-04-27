import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Availability() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace('/login')

      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (!business) return
      setBusinessId(business.id)

      const { data: existing } = await supabase
        .from('availability')
        .select('*')
        .eq('business_id', business.id)
        .order('day_of_week')

      if (existing && existing.length > 0) {
        setRows(existing)
      } else {
        setRows(days.map((_, i) => ({
          business_id: business.id,
          day_of_week: i,
          start_time: '09:00',
          end_time: '17:00',
          is_closed: i === 0
        })))
      }
    }

    init()
  }, [router])

  function updateRow(index: number, field: string, value: any) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  async function saveAvailability() {
    if (!businessId) return
    setLoading(true)

    await supabase.from('availability').delete().eq('business_id', businessId)

    const cleanRows = rows.map(r => ({
      business_id: businessId,
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      is_closed: r.is_closed
    }))

    await supabase.from('availability').insert(cleanRows)
    setLoading(false)
    alert('Working hours saved')
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>Working hours</h1>

      {rows.map((row, index) => (
        <div key={row.day_of_week} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '0.75rem',
          alignItems: 'center',
          border: '1px solid #ddd',
          padding: '1rem',
          marginBottom: '0.75rem'
        }}>
          <strong>{days[row.day_of_week]}</strong>

          <label>
            <input
              type="checkbox"
              checked={row.is_closed}
              onChange={(e) => updateRow(index, 'is_closed', e.target.checked)}
            />
            {' '}Closed
          </label>

          <input
            type="time"
            value={row.start_time}
            disabled={row.is_closed}
            onChange={(e) => updateRow(index, 'start_time', e.target.value)}
          />

          <input
            type="time"
            value={row.end_time}
            disabled={row.is_closed}
            onChange={(e) => updateRow(index, 'end_time', e.target.value)}
          />
        </div>
      ))}

      <button onClick={saveAvailability} disabled={loading} style={{ padding: '0.75rem 1rem' }}>
        {loading ? 'Saving...' : 'Save working hours'}
      </button>
    </main>
  )
}