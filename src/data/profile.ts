// Perfil del usuario: por ahora, la opción de usar UF y dólares (migración 0009).
import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { emitChange } from '@/lib/events'

export type Profile = {
  multiCurrency: boolean
  /** false si la migración 0009 aún no se aplicó (la opción no se puede activar). */
  currencyAvailable: boolean
}

export async function getProfile(): Promise<Profile> {
  const res = await supabase.from('profiles').select('multi_currency').maybeSingle()
  if (res.error?.code === '42703') return { multiCurrency: false, currencyAvailable: false }
  const row = unwrap<{ multi_currency: boolean } | null>(res)
  return { multiCurrency: !!row?.multi_currency, currencyAvailable: true }
}

export async function setMultiCurrency(on: boolean): Promise<void> {
  const { data } = await supabase.auth.getSession()
  unwrap(await supabase.from('profiles').update({ multi_currency: on }).eq('user_id', data.session?.user.id ?? ''))
  emitChange('profile')
}
