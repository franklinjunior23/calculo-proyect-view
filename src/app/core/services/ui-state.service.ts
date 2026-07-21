import { Injectable, signal } from '@angular/core';

/** Estado de UI compartido entre el panel de datos y la escena 3D. */
@Injectable({ providedIn: 'root' })
export class UiStateService {
  /** Alterna entre render sólido (PBR) y wireframe estructural. */
  readonly wireframe = signal(false);

  /** Muestra u oculta las cotas técnicas superpuestas sobre el canvas. */
  readonly showDimensions = signal(true);

  /** Drawer inferior de datos abierto en vista mobile. */
  readonly panelOpen = signal(false);

  toggleWireframe(): void {
    this.wireframe.update((v) => !v);
  }

  toggleDimensions(): void {
    this.showDimensions.update((v) => !v);
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
  }
}
