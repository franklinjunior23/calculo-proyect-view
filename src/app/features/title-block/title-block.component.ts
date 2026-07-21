import { Component, inject } from '@angular/core';
import { BridgeDataService } from '../../core/services/bridge-data.service';

/** Cajetín técnico inferior, al estilo de un plano de ingeniería civil real. */
@Component({
  selector: 'app-title-block',
  standalone: true,
  template: `
    <div
      class="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t-2 border-blueprint bg-panel px-4.5 py-2.5 font-mono max-md:flex-col max-md:gap-y-1"
    >
      <div class="flex min-w-0 basis-full items-baseline gap-1.5">
        <span class="shrink-0 text-[0.62rem] uppercase tracking-wider text-steel">Tema</span>
        <span class="whitespace-normal text-[0.72rem] font-semibold text-blueprint">
          {{ data.metadata.tema }}
        </span>
      </div>
      <div class="flex min-w-0 items-baseline gap-1.5">
        <span class="shrink-0 text-[0.62rem] uppercase tracking-wider text-steel">Curso</span>
        <span class="truncate text-[0.72rem] text-slate-800 max-md:whitespace-normal">
          {{ data.metadata.curso }}
        </span>
      </div>
      <div class="flex min-w-0 items-baseline gap-1.5">
        <span class="shrink-0 text-[0.62rem] uppercase tracking-wider text-steel">Alumno</span>
        <span class="truncate text-[0.72rem] text-slate-800 max-md:whitespace-normal">
          {{ data.metadata.alumno }} · {{ data.metadata.codigoAlumno }}
        </span>
      </div>
      <div class="flex min-w-0 items-baseline gap-1.5">
        <span class="shrink-0 text-[0.62rem] uppercase tracking-wider text-steel">Docente</span>
        <span class="truncate text-[0.72rem] text-slate-800 max-md:whitespace-normal">
          {{ data.metadata.docente }}
        </span>
      </div>
      <div class="flex min-w-0 items-baseline gap-1.5">
        <span class="shrink-0 text-[0.62rem] uppercase tracking-wider text-steel">Año</span>
        <span class="truncate text-[0.72rem] text-slate-800 max-md:whitespace-normal">
          {{ data.metadata.anio }}
        </span>
      </div>
    </div>
  `,
})
export class TitleBlockComponent {
  protected readonly data = inject(BridgeDataService);
}
