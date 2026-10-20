// Datos de íconos y colores (sin React). Los componentes están en components/icons.tsx.
// La BD guarda el NOMBRE del ícono de cada categoría (p. ej. "utensils"), que
// coincide con el ícono de Lucide que se dibuja.

/** Íconos disponibles para categorías y metas, con su nombre para lectores de pantalla. */
export const CATEGORY_ICONS: Record<string, string> = {
  utensils: 'Comida',
  'shopping-cart': 'Supermercado',
  coffee: 'Café',
  bus: 'Bus',
  car: 'Auto',
  fuel: 'Combustible',
  plane: 'Viaje',
  home: 'Casa',
  zap: 'Electricidad',
  wifi: 'Internet',
  phone: 'Teléfono',
  'heart-pulse': 'Salud',
  pill: 'Remedios',
  'gamepad-2': 'Juegos',
  film: 'Cine',
  music: 'Música',
  'graduation-cap': 'Educación',
  book: 'Libros',
  repeat: 'Suscripción',
  shirt: 'Ropa',
  'paw-print': 'Mascotas',
  baby: 'Bebé',
  gift: 'Regalos',
  dumbbell: 'Deporte',
  beauty: 'Belleza',
  tools: 'Reparaciones',
  tag: 'Otros',
  briefcase: 'Trabajo',
  receipt: 'Boletas',
  'trending-up': 'Inversiones',
  'piggy-bank': 'Ahorro',
  bank: 'Banco',
}

export const ACCOUNT_TYPES = {
  cash: { label: 'Efectivo' },
  bank: { label: 'Cuenta bancaria' },
  savings: { label: 'Ahorro' },
  credit_card: { label: 'Tarjeta de crédito' },
  loan: { label: 'Préstamo / deuda' },
  receivable: { label: 'Me deben' },
} as const

/** Cuentas cuyo saldo negativo es una deuda (se muestran como "Debes $X"). */
export const LIABILITY_TYPES = ['credit_card', 'loan'] as const
export const isLiability = (type: string) => (LIABILITY_TYPES as readonly string[]).includes(type)

/** Paleta sobria para cuentas, categorías y metas (saturación ≤ 80%). */
export const COLORS = [
  '#3d5a80', // azul acero
  '#2f6f5e', // verde petróleo
  '#5b4b8a', // violeta
  '#9b4a5e', // vino
  '#b5532f', // óxido
  '#b38b6d', // taupe
  '#8a7a3d', // oliva
  '#4f7a3a', // musgo
  '#4a7d8c', // azul gris
  '#6b6b6b', // grafito
]
