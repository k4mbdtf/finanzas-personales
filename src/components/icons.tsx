// Sistema de íconos (Lucide, trazo fino). Reemplaza a los emojis.
// Solo se incluyen en el bundle los íconos importados aquí.
import type { CSSProperties } from 'react'
import {
  Baby, Banknote, Bitcoin, BookOpen, Briefcase, Bus, Car, ChartCandlestick, ChartPie, Coffee, CreditCard,
  Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, Handshake, HeartPulse, House, Landmark,
  Music, PawPrint, PiggyBank, Pill, Plane, Receipt, Repeat, Scissors, Shirt, ShoppingCart, Smartphone, Tag,
  TrendingUp, Umbrella, Utensils, Wifi, Wrench, Zap, ArrowLeftRight, type LucideIcon,
} from 'lucide-react'
import { inkOn, institutionById } from '@/lib/institutions'
import type { Account, AccountType, InvestmentKind } from '@/types'

const CATEGORY: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-cart': ShoppingCart, coffee: Coffee, bus: Bus, car: Car, fuel: Fuel,
  plane: Plane, home: House, zap: Zap, wifi: Wifi, phone: Smartphone, 'heart-pulse': HeartPulse,
  pill: Pill, 'gamepad-2': Gamepad2, film: Film, music: Music, 'graduation-cap': GraduationCap,
  book: BookOpen, repeat: Repeat, shirt: Shirt, 'paw-print': PawPrint, baby: Baby, gift: Gift,
  dumbbell: Dumbbell, beauty: Scissors, tools: Wrench, tag: Tag, briefcase: Briefcase, receipt: Receipt,
  'trending-up': TrendingUp, 'piggy-bank': PiggyBank, bank: Landmark,
}

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  cash: Banknote, bank: Landmark, savings: PiggyBank, credit_card: CreditCard, loan: HandCoins,
  receivable: Handshake, investment: TrendingUp,
}

export const INVESTMENT_ICONS: Record<InvestmentKind, LucideIcon> = {
  fund: ChartPie, stocks: ChartCandlestick, deposit: Landmark, crypto: Bitcoin, retirement: Umbrella, other: TrendingUp,
}

export const categoryIcon = (name: string | undefined): LucideIcon => (name && CATEGORY[name]) || Tag
export { ArrowLeftRight as TransferIcon }

const SIZES = {
  sm: { box: 'size-8', icon: 16, text: 13 },
  md: { box: 'size-10', icon: 20, text: 15 },
  lg: { box: 'size-12', icon: 24, text: 18 },
} as const
type Size = keyof typeof SIZES

/**
 * Ícono en un recuadro suave con el color de la categoría/cuenta. El trazo usa
 * el mismo color oscurecido (claro) o aclarado (oscuro) para que se lea bien.
 */
export function IconTile({
  icon: Icon, color, size = 'md', className = '',
}: { icon: LucideIcon; color?: string; size?: Size; className?: string }) {
  const s = SIZES[size]
  // Sin color: estilo neutro del tema (sirve igual en claro y oscuro).
  const style: CSSProperties | undefined = color ? {
    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
    color: `color-mix(in srgb, ${color} 72%, var(--icon-mix))`,
  } : undefined
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ${color ? '' : 'bg-subtle text-ink'} ${s.box} ${className}`} style={style} aria-hidden>
      <Icon size={s.icon} strokeWidth={1.75} />
    </span>
  )
}

export function CategoryIcon({ name, color, size }: { name?: string; color?: string; size?: Size }) {
  return <IconTile icon={categoryIcon(name)} color={color} size={size} />
}

/**
 * Logo de un banco: monograma sobre un color sólido. Por defecto el color de
 * marca; si la cuenta tiene otro color, ese (la letra elige blanco o carbón).
 */
export function InstitutionMark({
  id, color, size = 'md', className = '',
}: { id: string; color?: string; size?: Size; className?: string }) {
  const inst = institutionById(id)
  if (!inst) return null
  const s = SIZES[size]
  const bg = color ?? inst.color
  const ink = bg.toLowerCase() === inst.color ? inst.ink : inkOn(bg)
  const n = inst.mark.length
  const fontSize = Math.round(s.text * (n >= 4 ? 0.68 : n === 3 ? 0.8 : n === 2 ? 0.95 : 1.15))
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg font-bold leading-none tracking-[-0.02em] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] ${s.box} ${className}`}
      style={{ backgroundColor: bg, color: ink, fontSize }} aria-hidden>
      {inst.mark}
    </span>
  )
}

/** Ícono de una cuenta: el logo de su banco si tiene uno; si no, el de su tipo. */
export function AccountIcon({
  account: a, size = 'md', className,
}: { account: Pick<Account, 'type' | 'color' | 'institution' | 'investment_kind'>; size?: Size; className?: string }) {
  if (a.institution && institutionById(a.institution)) {
    return <InstitutionMark id={a.institution} color={a.color} size={size} className={className} />
  }
  const icon = a.type === 'investment' && a.investment_kind ? INVESTMENT_ICONS[a.investment_kind] : ACCOUNT_ICONS[a.type]
  return <IconTile icon={icon} color={a.color} size={size} className={className} />
}
