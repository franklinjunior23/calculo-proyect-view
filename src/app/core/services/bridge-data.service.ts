import { Injectable, computed, signal } from '@angular/core';
import {
  BridgeGeometryData,
  ColumnGeometryData,
  MaterialScenario,
  ProjectMetadata,
  ScenarioId,
} from '../models/bridge-data.model';

/**
 * Expone los resultados exactos del análisis de Cálculo II (integrales dobles
 * para volúmenes de la curva del tablero y de las columnas cilíndricas) y los
 * dos escenarios de distribución de materiales, como estado reactivo (signals).
 */
@Injectable({ providedIn: 'root' })
export class BridgeDataService {
  /** Geometría y volumen del tablero: ∫₀³⁰∫₀¹⁰ f(x) dy dx + bloque base. */
  readonly bridgeGeometry: BridgeGeometryData = {
    lengthX: 30,
    widthY: 10,
    curveHeight: 2,
    baseThickness: 2,
    curveVolume: 400,
    baseVolume: 600,
    totalVolume: 1000,
  };

  /** Geometría y volumen de las 4 columnas: ∫∫_D h dA, D = círculo r=0.5. */
  readonly columnGeometry: ColumnGeometryData = {
    radius: 0.5,
    height: 5,
    edgeOffset: 2,
    count: 4,
    volumePerColumn: 1.25 * Math.PI,
    totalVolume: 4 * (1.25 * Math.PI),
  };

  readonly metadata: ProjectMetadata = {
    curso: 'Cálculo II',
    tema: 'Aplicación de Integrales Múltiples para el Cálculo de Volúmenes en Ingeniería Civil',
    alumno: 'Cordero Picoy Omar Wilmer',
    codigoAlumno: 'U24233583',
    docente: 'Ing. Luis Enrique Quispe Gallegos',
    anio: '2025',
  };

  private readonly scenarios: readonly MaterialScenario[] = [
    {
      id: '70-30',
      label: '70% Cemento / 30% Varilla',
      cementoPct: 70,
      varillaPct: 30,
      lines: [
        {
          structure: 'Puente',
          cementoM3: 700,
          varillaM3: 300,
          costoCemento: 210_000,
          costoVarilla: 80_085,
          total: 290_085,
        },
        {
          structure: 'Columnas',
          cementoM3: 22.29,
          varillaM3: 9.55,
          costoCemento: 6_687,
          costoVarilla: 2_548,
          total: 9_235,
        },
      ],
      totalObra: 299_320,
    },
    {
      id: '60-40',
      label: '60% Cemento / 40% Varilla',
      cementoPct: 60,
      varillaPct: 40,
      lines: [
        {
          structure: 'Puente',
          cementoM3: 600,
          varillaM3: 400,
          costoCemento: 180_000,
          costoVarilla: 106_780,
          total: 286_780,
        },
        {
          structure: 'Columnas',
          cementoM3: 19.1,
          varillaM3: 12.74,
          costoCemento: 5_730,
          costoVarilla: 3_401,
          total: 9_131,
        },
      ],
      totalObra: 295_911,
    },
  ];

  /** Escenario de materiales activo, controlado desde el panel de datos. */
  readonly activeScenarioId = signal<ScenarioId>('70-30');

  readonly activeScenario = computed<MaterialScenario>(
    () => this.scenarios.find((s) => s.id === this.activeScenarioId())!,
  );

  readonly allScenarios: readonly MaterialScenario[] = this.scenarios;

  setScenario(id: ScenarioId): void {
    this.activeScenarioId.set(id);
  }

  toggleScenario(): void {
    this.setScenario(this.activeScenarioId() === '70-30' ? '60-40' : '70-30');
  }
}
