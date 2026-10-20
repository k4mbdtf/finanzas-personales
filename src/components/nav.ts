// Secciones de la app. Para agregar una sección: súmala aquí y su ruta en App.tsx.
//   MAIN_NAV: barra inferior en celular (4 + "Más") y arriba en la sidebar.
//   MORE_NAV: en celular se llega desde la página "Más"; en escritorio, sidebar.
import {
  ArrowLeftRight, ChartLine, FileUp, HandCoins, House, PiggyBank, Repeat, Settings, Tags, Target, Wallet,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; hint?: string }

export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/presupuestos', label: 'Presupuestos', icon: Target },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
]

export const MORE_NAV: NavItem[] = [
  { to: '/deudas', label: 'Deudas y cuotas', icon: HandCoins, hint: 'Préstamos, tarjetas, compras en cuotas y lo que te deben' },
  { to: '/metas', label: 'Metas de ahorro', icon: PiggyBank, hint: 'Ahorra para algo y sigue tu avance' },
  { to: '/recurrentes', label: 'Recurrentes', icon: Repeat, hint: 'Sueldo, arriendo y suscripciones automáticas' },
  { to: '/patrimonio', label: 'Patrimonio', icon: ChartLine, hint: 'Lo que tienes menos lo que debes, mes a mes' },
  { to: '/importar', label: 'Importar cartola', icon: FileUp, hint: 'Carga los movimientos de tu banco desde un CSV' },
  { to: '/categorias', label: 'Categorías', icon: Tags, hint: 'Colores, íconos y categorías propias' },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, hint: 'Tema, exportar datos, contraseña y cuenta' },
]
