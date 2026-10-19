// Íconos de categorías como emoji: cero dependencias y se ven en todo dispositivo.
// La BD guarda el nombre (p. ej. "utensils"); aquí se traduce al emoji.
export const CATEGORY_ICONS: Record<string, string> = {
  utensils: '🍽️',
  'shopping-cart': '🛒',
  coffee: '☕',
  bus: '🚌',
  car: '🚗',
  fuel: '⛽',
  plane: '✈️',
  home: '🏠',
  zap: '⚡',
  wifi: '📶',
  phone: '📱',
  'heart-pulse': '🩺',
  pill: '💊',
  'gamepad-2': '🎮',
  film: '🎬',
  music: '🎵',
  'graduation-cap': '🎓',
  book: '📚',
  repeat: '🔁',
  shirt: '👕',
  'paw-print': '🐾',
  baby: '👶',
  gift: '🎁',
  dumbbell: '🏋️',
  beauty: '💇',
  tools: '🛠️',
  tag: '🏷️',
  briefcase: '💼',
  receipt: '🧾',
  'trending-up': '📈',
  'piggy-bank': '🐷',
  bank: '🏦',
}

export function iconFor(name: string | undefined): string {
  return (name && CATEGORY_ICONS[name]) || '🏷️'
}

export const ACCOUNT_TYPES = {
  cash: { label: 'Efectivo', icon: '💵' },
  bank: { label: 'Cuenta bancaria', icon: '🏦' },
  savings: { label: 'Ahorro', icon: '🐷' },
  credit_card: { label: 'Tarjeta de crédito', icon: '💳' },
} as const

/** Paleta para cuentas y categorías (contraste aceptable en claro y oscuro). */
export const COLORS = [
  '#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#64748b',
]
