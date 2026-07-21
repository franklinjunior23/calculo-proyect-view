import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import * as THREE from 'three';
import { UiStateService } from '../../core/services/ui-state.service';
import { OrbitCamera } from './orbit-camera';
import {
  DimensionAnchor,
  createApproachRoads,
  createArchRails,
  createBaseBlock,
  createColumns,
  createConcreteMaterial,
  createCurbs,
  createHangers,
  createPaintedMetalMaterial,
  createRailings,
  createRoadSurface,
  createRocks,
  createSky,
  createSteelMaterial,
  createStreetLamps,
  createTerrain,
  createTrees,
  createVehicles,
  createWater,
  getDimensionAnchors,
} from './bridge-geometry';

interface DimensionDom {
  anchor: DimensionAnchor;
  line: SVGLineElement;
  label: HTMLDivElement;
}

/** Clases Tailwind aplicadas a los `<line>` de cota, creados imperativamente (no vía template). */
const DIM_LINE_CLASS = 'stroke-blueprint stroke-[1.25] opacity-[0.85] [stroke-dasharray:3_3]';
/** Clases Tailwind aplicadas a las etiquetas de cota, creadas imperativamente (no vía template). */
const DIM_LABEL_CLASS =
  'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border ' +
  'border-blueprint bg-white/85 px-1.5 py-0.5 font-mono text-[0.72rem] text-slate-800';

/**
 * Canvas 3D del puente. Monta la escena three.js "a mano" (sin wrappers),
 * gestiona su propio ciclo de vida (creación en ngAfterViewInit, limpieza
 * en ngOnDestroy) y proyecta las cotas técnicas de 3D a overlay HTML/SVG
 * en cada frame del render loop.
 */
@Component({
  selector: 'app-bridge-scene',
  standalone: true,
  template: `
    <div class="relative h-full w-full overflow-hidden">
      <canvas #canvasRef class="block h-full w-full touch-none"></canvas>
      <svg #svgOverlay class="pointer-events-none absolute inset-0 h-full w-full"></svg>
      <div #labelsOverlay class="pointer-events-none absolute inset-0 h-full w-full"></div>
    </div>
  `,
})
export class BridgeSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('svgOverlay', { static: true }) private svgOverlayRef!: ElementRef<SVGSVGElement>;
  @ViewChild('labelsOverlay', { static: true })
  private labelsOverlayRef!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  protected readonly uiState = inject(UiStateService);

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private orbitCamera!: OrbitCamera;
  private frameId = 0;
  private resizeObserver?: ResizeObserver;
  private readonly meshes: THREE.Mesh[] = [];
  private readonly dimensions: DimensionDom[] = [];
  /** Equipamiento vial (calzada, barandas, luminarias, vehículos…): se oculta en wireframe. */
  private roadEquipment?: THREE.Group;

  constructor() {
    // Estructura sólida ↔ wireframe: reacciona al signal del panel de datos.
    // En wireframe se oculta el equipamiento vial para dejar visibles solo
    // los volúmenes estructurales del análisis (losa, arcos, columnas).
    effect(() => {
      const wireframe = this.uiState.wireframe();
      for (const mesh of this.meshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.wireframe = wireframe;
      }
      if (this.roadEquipment) this.roadEquipment.visible = !wireframe;
    });

    // Visibilidad de cotas técnicas.
    effect(() => {
      const visible = this.uiState.showDimensions();
      const display = visible ? '' : 'none';
      if (this.svgOverlayRef) this.svgOverlayRef.nativeElement.style.display = display;
      if (this.labelsOverlayRef) this.labelsOverlayRef.nativeElement.style.display = display;
    });
  }

  ngAfterViewInit(): void {
    // Todo el render loop corre fuera de Angular: no necesitamos change detection por frame.
    this.zone.runOutsideAngular(() => {
      this.initScene();
      this.buildDimensionOverlay();
      this.handleResize();
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement!);
      this.animate();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.orbitCamera?.dispose();
    this.renderer?.dispose();
    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.bumpMap?.dispose();
          mat.dispose();
        }
      }
    });
  }

  private initScene(): void {
    const canvas = this.canvasRef.nativeElement;
    const host = canvas.parentElement!;

    // Escena diurna: cielo celeste con neblina atmosférica clara al fondo.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bcd9ee');
    this.scene.fog = new THREE.Fog('#cfe3f2', 50, 130);

    this.camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 500);
    this.camera.position.set(28, 20, 32);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.orbitCamera = new OrbitCamera(this.camera, canvas);

    this.setupLights();
    this.buildBridge();
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight('#cfe6ff', '#5d7a52', 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
    sun.position.set(30, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);

    // Luz de relleno azulada sutil (rebote del cielo en las caras en sombra).
    const fill = new THREE.DirectionalLight('#a8cdec', 0.35);
    fill.position.set(-25, 15, -20);
    this.scene.add(fill);
  }

  private buildBridge(): void {
    const concrete = createConcreteMaterial();
    const steel = createSteelMaterial();
    const paintedMetal = createPaintedMetalMaterial();

    // Entorno / "bioma": cielo, terreno ondulado (con terraplenes de acceso),
    // río, árboles, rocas y la autopista que empalma con el puente dan
    // sensación de lugar real en vez de un mockup sobre grilla vacía.
    const sky = createSky();
    const terrain = createTerrain();
    const water = createWater();
    const trees = createTrees();
    const rocks = createRocks();
    const approachRoads = createApproachRoads();

    // Losa base (600 m³) + arcos parabólicos (representan la integral de la
    // curva, 400 m³) = 1000 m³ del tablero, igual al modelo de referencia.
    const base = createBaseBlock(concrete);
    const archRails = createArchRails(concrete);
    const columns = createColumns(steel);

    // Equipamiento vial sobre el tablero: calzada asfaltada con demarcación,
    // aceras, barandas, péndolas arco-tablero, alumbrado y vehículos.
    this.roadEquipment = new THREE.Group();
    this.roadEquipment.name = 'road-equipment';
    this.roadEquipment.add(
      createRoadSurface(),
      createCurbs(concrete),
      createRailings(paintedMetal),
      createHangers(paintedMetal),
      createStreetLamps(paintedMetal),
      createVehicles(),
    );

    this.scene.add(
      sky,
      terrain,
      water,
      trees,
      rocks,
      approachRoads,
      base,
      archRails,
      columns,
      this.roadEquipment,
    );
    this.meshes.push(base);
    for (const child of [...archRails.children, ...columns.children]) {
      if (child instanceof THREE.Mesh) this.meshes.push(child);
    }
  }

  private buildDimensionOverlay(): void {
    const svg = this.svgOverlayRef.nativeElement;
    const labelsHost = this.labelsOverlayRef.nativeElement;

    for (const anchor of getDimensionAnchors()) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', DIM_LINE_CLASS);
      svg.appendChild(line);

      const label = document.createElement('div');
      label.className = DIM_LABEL_CLASS;
      label.textContent = anchor.label;
      labelsHost.appendChild(label);

      this.dimensions.push({ anchor, line, label });
    }
  }

  /** Proyecta cada cota 3D a coordenadas de pantalla; se recalcula cada frame. */
  private updateDimensionOverlay(): void {
    if (!this.uiState.showDimensions()) return;
    const host = this.canvasRef.nativeElement.parentElement!;
    const width = host.clientWidth;
    const height = host.clientHeight;

    for (const { anchor, line, label } of this.dimensions) {
      const start = this.projectToScreen(anchor.start, width, height);
      const end = this.projectToScreen(anchor.end, width, height);

      line.setAttribute('x1', String(start.x));
      line.setAttribute('y1', String(start.y));
      line.setAttribute('x2', String(end.x));
      line.setAttribute('y2', String(end.y));

      label.style.left = `${(start.x + end.x) / 2}px`;
      label.style.top = `${(start.y + end.y) / 2}px`;

      const behindCamera = start.z > 1 || end.z > 1;
      line.style.display = behindCamera ? 'none' : '';
      label.style.display = behindCamera ? 'none' : '';
    }
  }

  private projectToScreen(point: THREE.Vector3, width: number, height: number): THREE.Vector3 {
    const projected = point.clone().project(this.camera);
    return new THREE.Vector3(
      ((projected.x + 1) / 2) * width,
      ((1 - projected.y) / 2) * height,
      projected.z,
    );
  }

  private handleResize(): void {
    const host = this.canvasRef.nativeElement.parentElement!;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    this.svgOverlayRef.nativeElement.setAttribute('width', String(width));
    this.svgOverlayRef.nativeElement.setAttribute('height', String(height));
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    this.orbitCamera.update();
    this.updateDimensionOverlay();
    this.renderer.render(this.scene, this.camera);
  };
}
