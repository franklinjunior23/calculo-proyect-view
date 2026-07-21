/**
 * Modelos de datos derivados del análisis de integrales dobles del proyecto
 * "Aplicación de Integrales Múltiples para el Cálculo de Volúmenes en Ingeniería Civil".
 */

/** Dimensiones y volúmenes del tablero del puente (base + curva parabólica). */
export interface BridgeGeometryData {
  /** Largo del puente en el eje longitudinal (m). */
  lengthX: number;
  /** Ancho del puente (m). */
  widthY: number;
  /** Altura máxima de la curva parabólica del tablero (m). */
  curveHeight: number;
  /** Espesor uniforme del bloque base (m). */
  baseThickness: number;
  /** Volumen bajo la curva f(x), obtenido de ∫₀³⁰∫₀¹⁰ f(x) dy dx (m³). */
  curveVolume: number;
  /** Volumen del bloque base 30×10×2 (m³). */
  baseVolume: number;
  /** Volumen total del puente = curva + base (m³). */
  totalVolume: number;
}

/** Dimensiones y volumen de las columnas de soporte. */
export interface ColumnGeometryData {
  /** Radio de la columna cilíndrica (m). */
  radius: number;
  /** Altura de la columna (m). */
  height: number;
  /** Distancia de inserción desde cada borde del puente (m). */
  edgeOffset: number;
  /** Número de columnas. */
  count: number;
  /** Volumen por columna, ∫∫_D h dA con D = círculo de radio r (m³). */
  volumePerColumn: number;
  /** Volumen total de las 4 columnas (m³). */
  totalVolume: number;
}

/** Línea de costos de materiales para una estructura (puente o columnas). */
export interface MaterialCostLine {
  structure: 'Puente' | 'Columnas';
  cementoM3: number;
  varillaM3: number;
  costoCemento: number;
  costoVarilla: number;
  total: number;
}

export type ScenarioId = '70-30' | '60-40';

/** Escenario de distribución de materiales (cemento / varilla). */
export interface MaterialScenario {
  id: ScenarioId;
  label: string;
  cementoPct: number;
  varillaPct: number;
  lines: MaterialCostLine[];
  totalObra: number;
}

/** Metadata para el cajetín técnico del plano. */
export interface ProjectMetadata {
  curso: string;
  tema: string;
  alumno: string;
  codigoAlumno: string;
  docente: string;
  anio: string;
}
