// Sistema de íconos (Lucide, trazo fino). Reemplaza a los emojis.
// Solo se incluyen en el bundle los íconos importados aquí.
import type { CSSProperties } from 'react'
import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Car, Coffee, CreditCard, Dumbbell, Film, Fuel, Gamepad2,
  Gift, GraduationCap, HandCoins, Handshake, HeartPulse, House, Landmark, Music, PawPrint, PiggyBank,
  Pill, Plane, Receipt, Repeat, Scissors, Shirt, ShoppingCart, Smartphone, Tag, TrendingUp, Utensils,
  Wifi, Wrench, Zap, ArrowLeftRight, type LucideIcon,
} from 'lucide-react'
import type { AccountType } from '@/types'

const CATEGORY: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-cart': ShoppingCart, coffee: Coffee, bus: Bus, car: Car, fuel: Fuel,
  plane: Plane, home: House, zap: Zap, wifi: Wifi, phone: Smartphone, 'heart-pulse': HeartPulse,
  pill: Pill, 'gamepad-2': Gamepad2, film: Film, music: Music, 'graduation-cap': GraduationCap,
  book: BookOpen, repeat: Repeat, shirt: Shirt, 'paw-print': PawPrint, baby: Baby, gift: Gift,
  dumbbell: Dumbbell, beauty: Scissors, tools: Wrench, tag: Tag, briefcase: Briefcase, receipt: Receipt,
  'trending-up': TrendingUp, 'piggy-bank': PiggyBank, bank: Landmark,
}

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  cash: Banknote, bank: Landmark, savings: PiggyBank, credit_card: CreditCard, loan: HandCoins, receivable: Handshake,
}

export const categoryIcon = (name: string | undefined): LucideIcon => (name && CATEGORY[name]) || Tag
export { ArrowLeftRight as TransferIcon }

const SIZES = {
  sm: { box: 'size-8', icon: 16 },
  md: { box: 'size-10', icon: 20 },
  lg: { box: 'size-12', icon: 24 },
} as const

/**
 * Ícono en un recuadro suave con el color de la categoría/cuenta. El trazo usa
 * el mismo color oscurecido (claro) o aclarado (oscuro) para que se lea bien.
 */
export function IconTile({
  icon: Icon, color, size = 'md', className = '',
}: { icon: LucideIcon; color?: string; size?: keyof typeof SIZES; className?: string }) {
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

export function CategoryIcon({ name, color, size }: { name?: string; color?: string; size?: keyof typeof SIZES }) {
  return <IconTile icon={categoryIcon(name)} color={color} size={size} />
}
