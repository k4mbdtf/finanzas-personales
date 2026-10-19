// Colores de los gráficos para modo claro y oscuro.
// Recharts recibe colores como atributos SVG, así que se eligen en JS según el tema.
// Ingresos/gastos validados con el validador de paleta (dataviz): pasan contraste y
// brillo; la separación para daltonismo verde/rojo queda en la banda 6–8, por lo que
// SIEMPRE van con codificación secundaria: leyenda, orden fijo, separación y tabla.
import { useIsDark } from './theme'

const LIGHT = {
  surface: '#ffffff', // = bg-white de las tarjetas
  income: '#008300',
  expense: '#e34948',
  other: '#94a3b8',
  grid: '#e2e8f0',
  axis: '#64748b',
  text: '#0f172a',
}
const DARK: typeof LIGHT = {
  surface: '#1e293b', // = dark:bg-slate-800 de las tarjetas
  income: '#0ca30c',
  expense: '#e66767',
  other: '#64748b',
  grid: '#334155',
  axis: '#94a3b8',
  text: '#f1f5f9',
}

export type ChartTheme = typeof LIGHT

/** Colores según el tema activo de la app (sistema o elegido en Ajustes). */
export function useChartTheme(): ChartTheme {
  return useIsDark() ? DARK : LIGHT
}
