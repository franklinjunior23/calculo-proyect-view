import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BridgeDataService } from '../../core/services/bridge-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { ScenarioId } from '../../core/models/bridge-data.model';

const CTRL_BTN_LAYOUT =
  'flex-1 min-w-[120px] rounded border border-blueprint/45 px-2.5 py-2 ' +
  'font-mono text-[0.7rem] transition-colors';
/** Botón inactivo: fondo transparente, texto azul plano. */
const CTRL_BTN_INACTIVE = `${CTRL_BTN_LAYOUT} bg-transparent text-blueprint`;
/** Botón activo: fondo azul sólido, texto blanco en negrita — clases completas, sin mezclar con las de arriba. */
const CTRL_BTN_ACTIVE = `${CTRL_BTN_LAYOUT} bg-blueprint text-white font-bold`;

/** Panel lateral / drawer con los resultados del análisis y los controles de escena. */
@Component({
  selector: 'app-data-panel',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="flex h-full flex-col gap-4 overflow-y-auto px-4 py-5 font-mono text-slate-800">
      <header>
        <h2 class="m-0 font-heading text-[1.05rem] tracking-wide text-blueprint">
          Resultados del análisis
        </h2>
        <p class="m-0 mt-0.5 text-[0.72rem] text-slate-500">
          Integrales dobles · volúmenes y materiales
        </p>
      </header>

      <section class="flex flex-wrap gap-2">
        <button
          type="button"
          [class]="uiState.wireframe() ? CTRL_BTN_ACTIVE : CTRL_BTN_INACTIVE"
          (click)="uiState.toggleWireframe()"
        >
          {{ uiState.wireframe() ? 'Estructura sólida' : 'Vista wireframe' }}
        </button>
        <button
          type="button"
          [class]="uiState.showDimensions() ? CTRL_BTN_ACTIVE : CTRL_BTN_INACTIVE"
          (click)="uiState.toggleDimensions()"
        >
          {{ uiState.showDimensions() ? 'Ocultar cotas' : 'Mostrar cotas' }}
        </button>
      </section>

      <section class="border-t border-blueprint/20 pt-3.5">
        <h3 class="m-0 mb-2.5 font-heading text-[0.82rem] uppercase tracking-wider text-steel">
          Volúmenes — tablero
        </h3>
        <dl class="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[0.78rem]">
          <dt class="text-slate-500">Curva f(x) ∫∫</dt>
          <dd class="m-0 text-right">{{ data.bridgeGeometry.curveVolume }} m³</dd>
          <dt class="text-slate-500">Bloque base</dt>
          <dd class="m-0 text-right">{{ data.bridgeGeometry.baseVolume }} m³</dd>
          <dt class="font-bold text-blueprint">Total puente</dt>
          <dd class="m-0 text-right font-bold text-blueprint">
            {{ data.bridgeGeometry.totalVolume }} m³
          </dd>
        </dl>
      </section>

      <section class="border-t border-blueprint/20 pt-3.5">
        <h3 class="m-0 mb-2.5 font-heading text-[0.82rem] uppercase tracking-wider text-steel">
          Volúmenes — columnas (×4)
        </h3>
        <dl class="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[0.78rem]">
          <dt class="text-slate-500">Por columna</dt>
          <dd class="m-0 text-right">{{ data.columnGeometry.volumePerColumn | number: '1.2-2' }} m³</dd>
          <dt class="font-bold text-blueprint">Total columnas</dt>
          <dd class="m-0 text-right font-bold text-blueprint">
            {{ data.columnGeometry.totalVolume | number: '1.2-2' }} m³
          </dd>
        </dl>
      </section>

      <section class="border-t border-blueprint/20 pt-3.5">
        <h3 class="m-0 mb-2.5 font-heading text-[0.82rem] uppercase tracking-wider text-steel">
          Escenario de materiales
        </h3>
        <div class="mb-3 flex gap-1.5">
          @for (scenario of data.allScenarios; track scenario.id) {
            <button
              type="button"
              [class]="data.activeScenarioId() === scenario.id ? CTRL_BTN_ACTIVE : CTRL_BTN_INACTIVE"
              (click)="selectScenario(scenario.id)"
            >
              {{ scenario.label }}
            </button>
          }
        </div>

        <table class="w-full border-collapse text-[0.7rem]">
          <thead>
            <tr>
              <th class="border-b border-blueprint/25 pb-1.5 text-left font-medium text-slate-500">
                Estructura
              </th>
              <th class="border-b border-blueprint/25 pb-1.5 text-right font-medium text-slate-500">
                Cemento
              </th>
              <th class="border-b border-blueprint/25 pb-1.5 text-right font-medium text-slate-500">
                Varilla
              </th>
              <th class="border-b border-blueprint/25 pb-1.5 text-right font-medium text-slate-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            @for (line of data.activeScenario().lines; track line.structure) {
              <tr>
                <td class="border-b border-dashed border-blueprint/10 py-1.5 text-left">
                  {{ line.structure }}
                </td>
                <td class="border-b border-dashed border-blueprint/10 py-1.5 text-right">
                  S/ {{ line.costoCemento | number: '1.0-0' }}
                </td>
                <td class="border-b border-dashed border-blueprint/10 py-1.5 text-right">
                  S/ {{ line.costoVarilla | number: '1.0-0' }}
                </td>
                <td class="border-b border-dashed border-blueprint/10 py-1.5 text-right">
                  S/ {{ line.total | number: '1.0-0' }}
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="mt-3 flex items-baseline justify-between border-t border-steel/50 pt-2.5">
          <span class="text-[0.75rem] text-steel">Total obra</span>
          <strong class="text-[1.05rem] text-steel">
            S/ {{ data.activeScenario().totalObra | number: '1.0-0' }}
          </strong>
        </div>
      </section>
    </div>
  `,
})
export class DataPanelComponent {
  protected readonly data = inject(BridgeDataService);
  protected readonly uiState = inject(UiStateService);
  protected readonly CTRL_BTN_ACTIVE = CTRL_BTN_ACTIVE;
  protected readonly CTRL_BTN_INACTIVE = CTRL_BTN_INACTIVE;

  selectScenario(id: ScenarioId): void {
    this.data.setScenario(id);
  }
}
