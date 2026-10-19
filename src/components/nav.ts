// Secciones de la app. Para agregar una sección: súmala aquí y su ruta en App.tsx.
//   MAIN_NAV: barra inferior en celular (4 + "Más") y arriba en la sidebar.
//   MORE_NAV: en celular se llega desde la página "Más"; en escritorio, sidebar.
export type NavItem = { to: string; label: string; icon: string; end?: boolean; hint?: string }

export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/movimientos', label: 'Movimientos', icon: '📋' },
  { to: '/presupuestos', label: 'Presupuestos', icon: '🎯' },
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
]

export const MORE_NAV: NavItem[] = [
  { to: '/deudas', label: 'Deudas y cuotas', icon: '🧾', hint: 'Préstamos, tarjetas, compras en cuotas y lo que te deben' },
  { to: '/metas', label: 'Metas de ahorro', icon: '🐷', hint: 'Ahorra para algo y sigue tu avance' },
  { to: '/recurrentes', label: 'Recurrentes', icon: '🔁', hint: 'Sueldo, arriendo y suscripciones automáticas' },
  { to: '/patrimonio', label: 'Patrimonio', icon: '📈', hint: 'Lo que tienes menos lo que debes, mes a mes' },
  { to: '/importar', label: 'Importar cartola', icon: '📥', hint: 'Carga los movimientos de tu banco desde un CSV' },
  { to: '/categorias', label: 'Categorías', icon: '🏷️', hint: 'Colores, íconos y categorías propias' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️', hint: 'Tema, exportar datos, contraseña y cuenta' },
]
