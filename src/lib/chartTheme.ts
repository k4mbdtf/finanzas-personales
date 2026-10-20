// Colores de los gráficos para modo claro y oscuro.
// Recharts recibe colores como atributos SVG, así que se eligen en JS según el tema.
// Ingresos/gastos validados con el validador de paleta (dataviz): pasan contraste y
// brillo; la separación para daltonismo verde/rojo queda en la banda 6–8, por lo que
// SIEMPRE van con codificación secundaria: leyenda, orden fijo, separación y tabla.
import { useIsDark } from './theme'

const LIGHT = {
  surface: '#ffffff', // = --surface (tarjetas)
  income: '#008300',
  expense: '#e34948',
  net: '#2a78d6', // patrimonio y valor de inversiones (validada vs superficie)
  invested: '#eb6834', // lo aportado a una inversión (par validado con net: ΔE CVD 24,7)
  other: '#a39e93',
  grid: '#ece7dc', // líneas finas, un tono sobre la superficie
  axis: '#6e695f',
  text: '#1c1c1c',
}
const DARK: typeof LIGHT = {
  surface: '#1c1c1e', // = --surface en oscuro
  income: '#0ca30c',
  expense: '#e66767',
  net: '#3987e5',
  invested: '#d95926', // par validado con net en oscuro (ΔE CVD 26,8)
  other: '#636366',
  grid: '#2c2c2e',
  axis: '#98989d',
  text: '#f5f5f7',
}

export type ChartTheme = typeof LIGHT

/**
 * Suaviza un color de categoría mezclándolo con el gris cálido de la paleta,
 * para que los gráficos no desentonen con la interfaz (el tono se mantiene:
 * cada categoría sigue siendo reconocible y coincide con su ícono).
 */
export function mute(hex: string, amount = 0.22): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const mix = (c: number, g: number) => Math.round(c * (1 - amount) + g * amount)
  const r = mix((n >> 16) & 255, 0x8a), g = mix((n >> 8) & 255, 0x84), b = mix(n & 255, 0x78)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Colores según el tema activo de la app (sistema o elegido en Ajustes). */
export function useChartTheme(): ChartTheme {
  return useIsDark() ? DARK : LIGHT
}
