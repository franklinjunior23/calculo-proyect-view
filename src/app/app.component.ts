import { Component, inject } from '@angular/core';
import { BridgeSceneComponent } from './features/bridge-scene/bridge-scene.component';
import { DataPanelComponent } from './features/data-panel/data-panel.component';
import { TitleBlockComponent } from './features/title-block/title-block.component';
import { UiStateService } from './core/services/ui-state.service';

const ASIDE_BASE_CLASSES =
  'min-h-0 flex-none border-l border-blueprint/25 bg-panel ' +
  'max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:h-[min(70%,520px)] ' +
  'max-lg:border-l-0 max-lg:border-t max-lg:shadow-[0_-6px_24px_rgba(15,40,60,0.18)] ' +
  'max-lg:transition-transform max-lg:duration-300 max-lg:ease-out lg:w-[340px]';

/** Layout raíz: header técnico, escena 3D + panel de datos, y cajetín inferior. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BridgeSceneComponent, DataPanelComponent, TitleBlockComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly uiState = inject(UiStateService);

  /** Clases del drawer de datos: en mobile se desliza según uiState.panelOpen(). */
  protected asideClasses(): string {
    const slide = this.uiState.panelOpen() ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full';
    return `${ASIDE_BASE_CLASSES} ${slide}`;
  }
}
