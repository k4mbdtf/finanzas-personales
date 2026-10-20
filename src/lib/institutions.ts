// Bancos y billeteras de Chile para crear cuentas con un toque: cada uno trae
// su color de marca, un logo (monograma) y sus productos más comunes. La BD
// guarda solo el id (accounts.institution); el resto vive aquí.
// Los logos son monogramas propios, no los logos oficiales (marcas registradas).
// Sin imports a propósito: se prueba con `node --test` (institutions.test.ts).

export type ProductType = 'bank' | 'savings' | 'credit_card'

export type Product = {
  id: string
  /** Texto del botón. */
  label: string
  type: ProductType
  /** Cómo se llama la cuenta: "<banco> <name>" (por defecto, el label)... */
  name?: string
  /** ...o un nombre completo propio (p. ej. "CMR Falabella"). */
  fullName?: string
}

export type Institution = {
  id: string
  name: string
  /** Para el nombre de la cuenta: "Falabella Cuenta Corriente". */
  short: string
  /** Monograma del logo. */
  mark: string
  /** Color de marca (fondo del logo y color por defecto de la cuenta). */
  color: string
  /** Color del monograma sobre el color de marca. */
  ink: string
  products: Product[]
  /** Otras formas de escribirlo (para reconocerlo en "¿A quién le debes?"). */
  aliases?: string[]
}

const CORRIENTE: Product = { id: 'corriente', label: 'Cuenta Corriente', type: 'bank' }
const VISTA: Product = { id: 'vista', label: 'Cuenta Vista / Débito', type: 'bank', name: 'Cuenta Vista' }
const AHORRO: Product = { id: 'ahorro', label: 'Cuenta de Ahorro', type: 'savings' }
const CREDITO: Product = { id: 'credito', label: 'Tarjeta de Crédito', type: 'credit_card' }
const BANK_PRODUCTS = [CORRIENTE, VISTA, AHORRO, CREDITO]
const WALLET_PRODUCTS: Product[] = [{ id: 'cuenta', label: 'Cuenta / Débito', type: 'bank', name: 'Cuenta' }, CREDITO]

export const INSTITUTIONS: Institution[] = [
  {
    id: 'bancoestado', name: 'BancoEstado', short: 'BancoEstado', mark: 'BE', color: '#c8102e', ink: '#ffffff',
    products: [
      { id: 'cuentarut', label: 'CuentaRUT', type: 'bank' },
      CORRIENTE,
      { id: 'vista', label: 'Chequera Electrónica / Vista', type: 'bank', name: 'Cuenta Vista' },
      AHORRO, CREDITO,
    ],
    aliases: ['banco estado', 'estado'],
  },
  {
    id: 'bancochile', name: 'Banco de Chile', short: 'Banco de Chile', mark: 'BCh', color: '#002d72', ink: '#ffffff',
    products: BANK_PRODUCTS, aliases: ['banco chile', 'bchile', 'edwards', 'banco edwards'],
  },
  {
    id: 'santander', name: 'Santander', short: 'Santander', mark: 'S', color: '#ec0000', ink: '#ffffff',
    products: BANK_PRODUCTS, aliases: ['banco santander'],
  },
  {
    id: 'bci', name: 'Bci', short: 'Bci', mark: 'bci', color: '#1f3a93', ink: '#ffffff',
    products: BANK_PRODUCTS, aliases: ['banco bci', 'banco de credito e inversiones'],
  },
  {
    id: 'scotiabank', name: 'Scotiabank', short: 'Scotiabank', mark: 'Sc', color: '#ec111a', ink: '#ffffff',
    products: BANK_PRODUCTS, aliases: ['scotia', 'banco scotiabank'],
  },
  {
    id: 'itau', name: 'Itaú', short: 'Itaú', mark: 'itaú', color: '#ec7000', ink: '#0b2a6f',
    products: BANK_PRODUCTS, aliases: ['banco itau', 'itau corpbanca'],
  },
  {
    id: 'falabella', name: 'Banco Falabella', short: 'Falabella', mark: 'F', color: '#007937', ink: '#ffffff',
    products: [
      CORRIENTE,
      { id: 'debito', label: 'Débito / Cuenta Vista', type: 'bank', name: 'Débito' },
      AHORRO,
      { id: 'cmr', label: 'Tarjeta CMR (crédito)', type: 'credit_card', fullName: 'CMR Falabella' },
    ],
    aliases: ['falabella', 'cmr', 'cmr falabella'],
  },
  {
    id: 'ripley', name: 'Banco Ripley', short: 'Ripley', mark: 'R', color: '#5b2c83', ink: '#ffffff',
    products: [VISTA, { id: 'credito', label: 'Tarjeta Ripley (crédito)', type: 'credit_card', fullName: 'Tarjeta Ripley' }],
    aliases: ['ripley'],
  },
  {
    id: 'bice', name: 'Banco BICE', short: 'BICE', mark: 'BICE', color: '#003a70', ink: '#ffffff',
    products: [CORRIENTE, VISTA, CREDITO], aliases: ['bice'],
  },
  {
    id: 'security', name: 'Banco Security', short: 'Security', mark: 'Se', color: '#6b2c91', ink: '#ffffff',
    products: [CORRIENTE, VISTA, CREDITO], aliases: ['security'],
  },
  {
    id: 'coopeuch', name: 'Coopeuch', short: 'Coopeuch', mark: 'C', color: '#004b93', ink: '#ffffff',
    products: [VISTA, AHORRO, CREDITO],
  },
  {
    id: 'tenpo', name: 'Tenpo', short: 'Tenpo', mark: 'T', color: '#00a887', ink: '#ffffff',
    products: WALLET_PRODUCTS,
  },
  {
    id: 'mach', name: 'MACH', short: 'MACH', mark: 'M', color: '#5a20d6', ink: '#ffffff',
    products: WALLET_PRODUCTS,
  },
  {
    id: 'mercadopago', name: 'Mercado Pago', short: 'Mercado Pago', mark: 'MP', color: '#ffe600', ink: '#2d3277',
    products: WALLET_PRODUCTS, aliases: ['mercadopago', 'mp'],
  },
]

/** Productos para un banco que no está en la lista. */
export const OTHER_PRODUCTS = BANK_PRODUCTS

const byId = new Map(INSTITUTIONS.map((i) => [i.id, i]))

export const institutionById = (id: string | null | undefined): Institution | undefined =>
  id ? byId.get(id) : undefined

/** "Banco Estado " -> "bancoestado" (sin tildes, espacios ni signos). */
export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Reconoce un banco escrito a mano ("banco estado", "Itau"...). */
export function findInstitution(text: string): Institution | undefined {
  const n = normalizeName(text)
  if (!n) return undefined
  return INSTITUTIONS.find((i) => [i.name, i.short, ...(i.aliases ?? [])].some((x) => normalizeName(x) === n))
}

/** Nombre sugerido para la cuenta: "BancoEstado CuentaRUT", "CMR Falabella"... */
export const productAccountName = (inst: Institution, p: Product) =>
  p.fullName ?? `${inst.short} ${p.name ?? p.label}`

/** Luminancia relativa (WCAG) de un color #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Blanco o carbón: el que más contraste tenga sobre `bg`. */
export function inkOn(bg: string): string {
  const l = luminance(bg)
  const onWhite = 1.05 / (l + 0.05)
  const onCharcoal = (l + 0.05) / (luminance('#1c1c1c') + 0.05)
  return onWhite >= onCharcoal ? '#ffffff' : '#1c1c1c'
}
