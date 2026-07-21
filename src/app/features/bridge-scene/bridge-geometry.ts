import * as THREE from 'three';

/**
 * Funciones puras de construcción de geometría three.js a partir de los
 * datos exactos del análisis de Cálculo II. No dependen de Angular ni
 * mantienen estado: reciben materiales y devuelven Object3D listos para
 * añadirse a la escena.
 *
 * Convención de ejes: X = largo del puente (30 m), Z = ancho (10 m),
 * Y = altura (vertical, "up" en three.js).
 */

export const BRIDGE_LENGTH_X = 30;
export const BRIDGE_WIDTH_Z = 10;
export const CURVE_HEIGHT = 2;
export const BASE_THICKNESS = 2;

export const COLUMN_RADIUS = 0.5;
export const COLUMN_HEIGHT = 5;
export const COLUMN_EDGE_OFFSET = 2;
export const COLUMN_FOOTING_RADIUS = COLUMN_RADIUS * 1.9;
export const COLUMN_FOOTING_HEIGHT = 0.6;

/** Nivel del suelo / lámina de agua. */
export const GROUND_Y = 0;
/** Cota inferior del bloque base (apoyada sobre las columnas). */
export const BASE_BOTTOM_Y = COLUMN_HEIGHT;
/** Cota superior del bloque base = inicio de la curva parabólica del tablero. */
export const BASE_TOP_Y = BASE_BOTTOM_Y + BASE_THICKNESS;

/**
 * Perfil parabólico del tablero: f(x) = 2 · (1 − ((x−15)/15)²), x ∈ [0, 30].
 * Esta es la curva cuya área bajo la curva, multiplicada por el ancho (10 m),
 * da el volumen de 400 m³ mediante la integral doble ∫₀³⁰∫₀¹⁰ f(x) dy dx.
 */
export function parabolicProfile(x: number): number {
  const t = (x - 15) / 15;
  return 2 * (1 - t * t);
}

/** Genera una textura procedural de ruido (canvas 2D) para simular poros del concreto. */
function createConcreteNoiseTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9c9a94';
  ctx.fillRect(0, 0, size, size);

  // Ruido de grano fino: motea la base gris para romper la planicidad del material.
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    data[i] = clamp255(data[i] + noise);
    data[i + 1] = clamp255(data[i + 1] + noise);
    data[i + 2] = clamp255(data[i + 2] + noise);
  }
  ctx.putImageData(imageData, 0, 0);

  // Poros/manchas: pequeños círculos oscuros dispersos, típicos del concreto vaciado.
  for (let i = 0; i < 220; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = Math.random() * 1.6 + 0.3;
    const shade = Math.random() * 40;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, v));
}

/** Textura de bump con estrías horizontales para simular varilla corrugada. */
function createSteelBumpTexture(): THREE.CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < height; y++) {
    const stripe = 0.5 + 0.5 * Math.sin((y / height) * Math.PI * 40);
    const shade = Math.floor(120 + stripe * 100);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, width, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  return texture;
}

/** Material PBR de concreto: rugoso, no metálico, con textura de poros procedural. */
export function createConcreteMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createConcreteNoiseTexture(),
    color: new THREE.Color('#b9b6ac'),
    roughness: 0.88,
    metalness: 0.02,
  });
}

/** Material PBR de acero corrugado: metálico, tinte cálido, con bump de estrías. */
export function createSteelMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C9A876'),
    roughness: 0.3,
    metalness: 0.7,
    bumpMap: createSteelBumpTexture(),
    bumpScale: 0.015,
  });
}

/**
 * Construye el bloque base del tablero (30 × 2 × 10 m), cuyo volumen
 * (largo × espesor × ancho = 600 m³) corresponde a la parte "prismática"
 * del volumen total del puente.
 */
export function createBaseBlock(material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(BRIDGE_LENGTH_X, BASE_THICKNESS, BRIDGE_WIDTH_Z);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, BASE_BOTTOM_Y + BASE_THICKNESS / 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'base-block';
  return mesh;
}

/** Radio de los arcos parabólicos (vigas curvas), en metros. */
export const ARCH_RAIL_RADIUS = 0.22;

/**
 * Construye los dos arcos parabólicos que corren a lo largo de cada borde
 * del tablero (siguiendo f(x)), igual que el modelo de referencia en
 * GeoGebra: una losa plana con dos vigas curvas encima, en vez de una masa
 * sólida arqueada. El volumen que "representan" estos arcos es el mismo que
 * la integral doble ∫₀³⁰∫₀¹⁰ f(x) dy dx = 400 m³ — aquí se visualizan como
 * las dos vigas límite (en y=0 e y=10) de esa superficie f(x), consistente
 * con cómo se graficó en el documento de referencia.
 */
export function createArchRails(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arch-rails';

  const halfZ = BRIDGE_WIDTH_Z / 2;
  const segments = 48;

  for (const z of [-halfZ, halfZ]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * BRIDGE_LENGTH_X;
      const worldX = x - BRIDGE_LENGTH_X / 2;
      points.push(new THREE.Vector3(worldX, BASE_TOP_Y + parabolicProfile(x), z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, segments, ARCH_RAIL_RADIUS, 10, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/**
 * Construye las 4 columnas cilíndricas de soporte (r = 0.5 m, h = 5 m),
 * cada una con volumen ∫∫_D h dA = h · π r² = 1.25π ≈ 3.93 m³ (D = círculo
 * de radio r), más una zapata ensanchada donde apoyan en el suelo.
 */
export function createColumns(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'columns';

  const columnGeometry = new THREE.CylinderGeometry(
    COLUMN_RADIUS,
    COLUMN_RADIUS,
    COLUMN_HEIGHT,
    24,
  );
  const footingGeometry = new THREE.CylinderGeometry(
    COLUMN_FOOTING_RADIUS,
    COLUMN_FOOTING_RADIUS * 1.15,
    COLUMN_FOOTING_HEIGHT,
    24,
  );

  const halfX = BRIDGE_LENGTH_X / 2 - COLUMN_EDGE_OFFSET;
  const halfZ = BRIDGE_WIDTH_Z / 2 - COLUMN_EDGE_OFFSET;
  const positions: Array<[number, number]> = [
    [-halfX, -halfZ],
    [-halfX, halfZ],
    [halfX, -halfZ],
    [halfX, halfZ],
  ];

  for (const [x, z] of positions) {
    const column = new THREE.Mesh(columnGeometry, material);
    column.position.set(x, GROUND_Y + COLUMN_HEIGHT / 2, z);
    column.castShadow = true;
    column.receiveShadow = true;

    const footing = new THREE.Mesh(footingGeometry, material);
    footing.position.set(x, GROUND_Y + COLUMN_FOOTING_HEIGHT / 2, z);
    footing.castShadow = true;
    footing.receiveShadow = true;

    group.add(column, footing);
  }

  return group;
}

export const TERRAIN_SIZE = 140;
/** Radio, centrado en el puente, que se mantiene plano para las zapatas de las columnas. */
const TERRAIN_FLAT_RADIUS = 18;
const TERRAIN_ROLLING_RADIUS = 60;
/** Media anchura (en X) de la banda de río que pasa bajo el puente. */
const RIVER_HALF_WIDTH = 9;
/** Ancho de la orilla en la que el cauce sube suavemente hasta el terreno normal. */
const RIVER_BANK_WIDTH = 3;
/** Profundidad del lecho del río respecto a y=0, siempre por debajo del agua. */
const RIVER_BED_DEPTH = -1.15;

/** X (valor absoluto, mundo) donde arranca el terraplén de acceso: el extremo del tablero. */
const RAMP_START_X = BRIDGE_LENGTH_X / 2;
/** X donde el terraplén ya bajó al nivel del terreno natural. */
const RAMP_END_X = 48;
/** Media anchura de la corona (parte plana superior) del terraplén. */
const RAMP_TOP_HALF_WIDTH = 5.5;
/** Pendiente lateral del terraplén: avance horizontal por metro de caída. */
const RAMP_SIDE_SLOPE = 1.5;
/** Cota de la corona del terraplén donde empalma con el tablero (= BASE_TOP_Y). */
const RAMP_CREST_Y = COLUMN_HEIGHT + BASE_THICKNESS;

/**
 * Altura del terraplén de acceso en (localX, localY). La corona empalma con
 * el tablero a 7 m en |x|=15 y desciende suavemente hasta el terreno natural
 * en |x|=48; los taludes laterales caen con pendiente ~1.5H:1V. Devuelve
 * -Infinity fuera del corredor de la vía.
 */
function embankmentHeight(localX: number, localY: number): number {
  const along = Math.abs(localX);
  if (along < RAMP_START_X - 0.6) return -Infinity;

  const t = Math.min(1, Math.max(0, (along - RAMP_START_X) / (RAMP_END_X - RAMP_START_X)));
  const smooth = t * t * (3 - 2 * t);
  const crest = RAMP_CREST_Y * (1 - smooth);
  if (crest <= 0) return -Infinity;

  const lateral = Math.abs(localY);
  if (lateral <= RAMP_TOP_HALF_WIDTH) return crest;
  return crest - (lateral - RAMP_TOP_HALF_WIDTH) / RAMP_SIDE_SLOPE;
}

/**
 * Relieve pseudo-aleatorio (suma de senoides, sin dependencias) del terreno,
 * en coordenadas locales del plano (antes de rotarlo a horizontal). Se
 * mantiene en 0 cerca del puente (zapatas de columnas) y ondula hacia los
 * bordes para dar sensación de campo real en vez de una grilla plana.
 */
function terrainNoise(localX: number, localY: number): number {
  const d = Math.sqrt(localX * localX + localY * localY);
  const falloff = Math.min(
    1,
    Math.max(0, (d - TERRAIN_FLAT_RADIUS) / (TERRAIN_ROLLING_RADIUS - TERRAIN_FLAT_RADIUS)),
  );
  const wave =
    Math.sin(localX * 0.16) * Math.cos(localY * 0.21) * 1.3 +
    Math.sin(localX * 0.05 + localY * 0.08) * 2.1 +
    Math.cos(localY * 0.12) * 1.0;
  let height = wave * falloff;

  // Cauce del río: talla un canal a lo largo de Z (localX ~ mundo X) para que
  // el puente, que atraviesa en X, realmente cruce por encima del agua en
  // vez de flotar sobre pasto plano. Las orillas se funden con el terreno
  // normal mediante una interpolación suave (smoothstep).
  const distFromRiver = Math.abs(localX);
  if (distFromRiver < RIVER_HALF_WIDTH + RIVER_BANK_WIDTH) {
    const t = Math.max(0, (distFromRiver - RIVER_HALF_WIDTH) / RIVER_BANK_WIDTH);
    const smooth = t * t * (3 - 2 * t);
    height = THREE.MathUtils.lerp(RIVER_BED_DEPTH, height, smooth);
  }

  // Terraplenes de acceso: el terreno se eleva hasta empalmar con los
  // extremos del tablero (a 7 m), de modo que la vía llegue al puente en
  // vez de dejarlo flotando aislado sobre el campo.
  return Math.max(height, embankmentHeight(localX, localY));
}

/** Altura del terreno bajo un punto en coordenadas de mundo (x, z). */
export function getTerrainHeightAtWorld(worldX: number, worldZ: number): number {
  return terrainNoise(worldX, -worldZ);
}

/** Plano de terreno con relieve ondulado y textura procedural (césped/tierra). */
export function createTerrain(): THREE.Mesh {
  const segments = 100;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3d5c35';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const shade = 50 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgba(${shade + 15},${shade + 55},${shade + 12},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments);
  const position = geometry.attributes['position'];
  for (let i = 0; i < position.count; i++) {
    const localX = position.getX(i);
    const localY = position.getY(i);
    position.setZ(i, terrainNoise(localX, localY));
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = GROUND_Y;
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/**
 * Lámina de agua del río que pasa bajo el puente: una franja angosta a lo
 * largo de Z (perpendicular al tablero, que se extiende en X), para que el
 * puente efectivamente "cruce" sobre ella en vez de correr en paralelo.
 */
export function createWater(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(RIVER_HALF_WIDTH * 2, TERRAIN_SIZE * 0.75, 40, 120);
  const position = geometry.attributes['position'];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    // Ondulación suave de la superficie del agua (estática, no animada).
    const ripple = Math.sin(x * 0.6 + y * 0.15) * 0.03 + Math.sin(y * 0.3) * 0.02;
    position.setZ(i, ripple);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d6a96'),
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.82,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = GROUND_Y - 0.35;
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}

/**
 * Cúpula de cielo diurno con degradado (canvas procedural): azul intenso en
 * el cénit que se aclara hacia el horizonte, dando profundidad atmosférica.
 * Se desactivan mipmaps porque una textura de gradiente muy angosta con
 * mipmaps generaba bandas Moiré al envolverla en una esfera.
 */
export function createSky(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sky';

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#3a86c9');
  gradient.addColorStop(0.55, '#83b9e4');
  gradient.addColorStop(1, '#ddedf8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const domeGeometry = new THREE.SphereGeometry(220, 32, 16);
  const domeMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    fog: false,
  });
  const dome = new THREE.Mesh(domeGeometry, domeMaterial);
  group.add(dome);

  return group;
}

/** ¿El punto (x,z) cae en zona "libre" (fuera del río, columnas y corredor de la autopista)? */
function isClearOfBridge(x: number, z: number): boolean {
  if (Math.abs(x) < RIVER_HALF_WIDTH + 2) return false;
  // Corredor de la vía (terraplenes + carretera) a lo largo de todo el eje X.
  if (Math.abs(z) < RAMP_TOP_HALF_WIDTH + RAMP_CREST_Y * RAMP_SIDE_SLOPE + 2) return false;
  return Math.hypot(x, z) > TERRAIN_FLAT_RADIUS;
}

/** Simple RNG determinístico (mulberry32) para que la vegetación no cambie en cada recarga. */
function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Árboles de bajo poligonaje (tronco + copa) instanciados en ambas orillas
 * del río, evitando el corredor del puente. Da sensación de "bioma" real.
 */
export function createTrees(count = 46): THREE.Group {
  const group = new THREE.Group();
  group.name = 'trees';
  const rng = createRng(1337);

  const trunkGeometry = new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6);
  const foliageGeometry = new THREE.ConeGeometry(0.95, 2.3, 7);
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: '#5a4028',
    roughness: 0.95,
    metalness: 0,
  });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: '#2f6b3c',
    roughness: 0.85,
    metalness: 0,
  });

  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const foliage = new THREE.InstancedMesh(foliageGeometry, foliageMaterial, count);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  foliage.castShadow = true;
  foliage.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const half = TERRAIN_SIZE / 2 - 6;
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 20) {
    attempts++;
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    if (!isClearOfBridge(x, z)) continue;

    const scale = 0.7 + rng() * 0.7;
    const rotationY = rng() * Math.PI * 2;
    const groundY = getTerrainHeightAtWorld(x, z);

    dummy.position.set(x, groundY + 0.8 * scale, z);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(x, groundY + 2.05 * scale, z);
    dummy.updateMatrix();
    foliage.setMatrixAt(placed, dummy.matrix);

    placed++;
  }

  trunks.count = placed;
  foliage.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  foliage.instanceMatrix.needsUpdate = true;

  group.add(trunks, foliage);
  return group;
}

/** Rocas de bajo poligonaje dispersas en las orillas, cerca del agua. */
export function createRocks(count = 22): THREE.InstancedMesh {
  const rng = createRng(4242);
  const geometry = new THREE.IcosahedronGeometry(0.4, 0);
  const material = new THREE.MeshStandardMaterial({ color: '#5b5b57', roughness: 0.95 });
  const rocks = new THREE.InstancedMesh(geometry, material, count);
  rocks.castShadow = true;
  rocks.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 20) {
    attempts++;
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (RIVER_HALF_WIDTH + 1 + rng() * 4);
    const z = (rng() * 2 - 1) * (TERRAIN_SIZE / 2 - 8);
    const groundY = getTerrainHeightAtWorld(x, z);
    const scale = 0.5 + rng() * 1.1;

    dummy.position.set(x, groundY + 0.15 * scale, z);
    dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    rocks.setMatrixAt(placed, dummy.matrix);
    placed++;
  }

  rocks.count = placed;
  rocks.instanceMatrix.needsUpdate = true;
  rocks.name = 'rocks';
  return rocks;
}

/** Ancho de la calzada asfaltada sobre el tablero (m); deja 1 m de acera a cada lado. */
export const ROAD_WIDTH_Z = 8;
/** Espesor de la carpeta asfáltica (m). */
const ROAD_THICKNESS = 0.1;
/** Altura del sardinel/acera sobre el tablero (m). */
const CURB_HEIGHT = 0.25;
/** Ancho de cada acera lateral (m). */
const CURB_WIDTH = 1;

/**
 * Textura procedural de asfalto con señalización vial pintada: línea central
 * amarilla discontinua y líneas de borde blancas continuas. Se repite solo a
 * lo largo del eje X (largo del puente) para que los segmentos de la línea
 * central se conviertan en la demarcación discontinua típica.
 */
function createAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2b2b2f';
  ctx.fillRect(0, 0, size, size);

  // Grano del asfalto: puntos claros/oscuros dispersos.
  for (let i = 0; i < 2600; i++) {
    const shade = 30 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 4},0.55)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }

  // Líneas de borde blancas continuas (v ≈ bordes de la calzada).
  ctx.fillStyle = 'rgba(228,228,220,0.9)';
  ctx.fillRect(0, 14, size, 5);
  ctx.fillRect(0, size - 19, size, 5);

  // Línea central amarilla discontinua: un tile = 5 m → dash de ~3 m.
  ctx.fillStyle = 'rgba(230,190,70,0.95)';
  ctx.fillRect(0, size / 2 - 3, size * 0.55, 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(BRIDGE_LENGTH_X / 5, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Carpeta asfáltica sobre el tablero, con demarcación vial pintada. Es lo que
 * convierte el bloque de concreto en un puente *vehicular* reconocible.
 */
export function createRoadSurface(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(BRIDGE_LENGTH_X, ROAD_THICKNESS, ROAD_WIDTH_Z);
  const material = new THREE.MeshStandardMaterial({
    map: createAsphaltTexture(),
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, BASE_TOP_Y + ROAD_THICKNESS / 2, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'road-surface';
  return mesh;
}

/**
 * Carreteras de acceso: dos cintas de asfalto que salen de los extremos del
 * tablero, bajan por la corona de los terraplenes y siguen el relieve del
 * terreno hasta el borde del mapa. Cada vértice se apoya sobre la altura
 * real del terreno (que ya incluye el terraplén) más un pequeño offset.
 */
export function createApproachRoads(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'approach-roads';

  const roadStart = BRIDGE_LENGTH_X / 2;
  const roadEnd = TERRAIN_SIZE / 2 - 4;
  const length = roadEnd - roadStart;
  const texture = createAsphaltTexture();
  texture.repeat.set(length / 5, 1);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.95,
    metalness: 0,
  });

  for (const side of [-1, 1]) {
    // Plano en coordenadas locales (x → mundo X, y → −mundo Z), igual que el
    // terreno: se deforma en Z local (altura) y luego se rota a horizontal.
    const geometry = new THREE.PlaneGeometry(length, ROAD_WIDTH_Z, 72, 4);
    const centerX = side * (roadStart + length / 2);
    const position = geometry.attributes['position'];
    for (let i = 0; i < position.count; i++) {
      const worldX = centerX + position.getX(i);
      const worldZ = -position.getY(i);
      position.setZ(i, getTerrainHeightAtWorld(worldX, worldZ) + 0.09);
    }
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.x = centerX;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/** Aceras/sardineles de concreto a ambos lados de la calzada. */
export function createCurbs(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'curbs';
  const geometry = new THREE.BoxGeometry(BRIDGE_LENGTH_X, CURB_HEIGHT, CURB_WIDTH);
  const zCenter = ROAD_WIDTH_Z / 2 + CURB_WIDTH / 2;
  for (const z of [-zCenter, zCenter]) {
    const curb = new THREE.Mesh(geometry, material);
    curb.position.set(0, BASE_TOP_Y + CURB_HEIGHT / 2, z);
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  }
  return group;
}

/** Material de metal pintado gris (barandas y postes), distinto del acero corrugado. */
export function createPaintedMetalMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9aa3ab'),
    roughness: 0.45,
    metalness: 0.6,
  });
}

/**
 * Barandas de seguridad peatonal sobre las aceras: postes verticales cada
 * 3 m y dos largueros horizontales continuos a cada lado del puente.
 */
export function createRailings(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'railings';

  const postHeight = 1.05;
  const postGeometry = new THREE.CylinderGeometry(0.045, 0.045, postHeight, 8);
  const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, BRIDGE_LENGTH_X, 8);
  railGeometry.rotateZ(Math.PI / 2);

  const zRail = ROAD_WIDTH_Z / 2 + CURB_WIDTH * 0.75;
  const baseY = BASE_TOP_Y + CURB_HEIGHT;

  for (const z of [-zRail, zRail]) {
    for (let x = -BRIDGE_LENGTH_X / 2; x <= BRIDGE_LENGTH_X / 2; x += 3) {
      const post = new THREE.Mesh(postGeometry, material);
      post.position.set(x, baseY + postHeight / 2, z);
      post.castShadow = true;
      group.add(post);
    }
    for (const railY of [baseY + postHeight, baseY + postHeight * 0.55]) {
      const rail = new THREE.Mesh(railGeometry, material);
      rail.position.set(0, railY, z);
      rail.castShadow = true;
      group.add(rail);
    }
  }

  return group;
}

/**
 * Péndolas: tirantes verticales que conectan cada arco parabólico con el
 * tablero, como en un puente de arco real. Van cada 2.5 m donde el arco
 * tiene altura suficiente sobre la losa.
 */
export function createHangers(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'hangers';

  const halfZ = BRIDGE_WIDTH_Z / 2;
  for (const z of [-halfZ, halfZ]) {
    for (let x = 2.5; x < BRIDGE_LENGTH_X; x += 2.5) {
      const height = parabolicProfile(x);
      if (height < 0.5) continue;
      const geometry = new THREE.CylinderGeometry(0.06, 0.06, height, 8);
      const hanger = new THREE.Mesh(geometry, material);
      hanger.position.set(x - BRIDGE_LENGTH_X / 2, BASE_TOP_Y + height / 2, z);
      hanger.castShadow = true;
      group.add(hanger);
    }
  }

  return group;
}

/**
 * Postes de alumbrado público sobre las aceras, con luminaria emisiva y una
 * luz puntual cálida real (sin sombras, para no duplicar shadow maps). De
 * noche son los que "venden" la escena como un puente en servicio.
 */
export function createStreetLamps(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'street-lamps';

  const poleHeight = 3.6;
  const poleGeometry = new THREE.CylinderGeometry(0.06, 0.09, poleHeight, 8);
  const armGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8);
  armGeometry.rotateX(Math.PI / 2);
  const headGeometry = new THREE.CapsuleGeometry(0.09, 0.28, 4, 8);
  headGeometry.rotateX(Math.PI / 2);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: '#fff3d6',
    emissive: new THREE.Color('#ffcf7d'),
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });

  const zLamp = ROAD_WIDTH_Z / 2 + CURB_WIDTH / 2;
  const baseY = BASE_TOP_Y + CURB_HEIGHT;
  const positions: Array<[number, number]> = [
    [-10, -zLamp],
    [10, -zLamp],
    [-10, zLamp],
    [10, zLamp],
  ];

  for (const [x, z] of positions) {
    // El brazo y la luminaria se inclinan hacia el centro de la calzada.
    const towardRoad = -Math.sign(z);

    const pole = new THREE.Mesh(poleGeometry, material);
    pole.position.set(x, baseY + poleHeight / 2, z);
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(armGeometry, material);
    arm.position.set(x, baseY + poleHeight, z + towardRoad * 0.45);
    group.add(arm);

    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(x, baseY + poleHeight, z + towardRoad * 0.9);
    group.add(head);

    // De día la luminaria apenas aporta un brillo cálido sutil bajo el cabezal.
    const light = new THREE.PointLight('#ffc978', 3, 10, 2);
    light.position.set(x, baseY + poleHeight - 0.25, z + towardRoad * 0.9);
    group.add(light);
  }

  return group;
}

/** Construye un auto low-poly (carrocería + cabina + 4 ruedas) mirando hacia +X. */
function createCar(bodyColor: string): THREE.Group {
  const car = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.35,
    metalness: 0.4,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#1d2c38',
    roughness: 0.15,
    metalness: 0.2,
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#181818', roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.65, 1.65), bodyMaterial);
  body.position.y = 0.62;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.45), glassMaterial);
  cabin.position.set(-0.25, 1.2, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 14);
  wheelGeometry.rotateX(Math.PI / 2);
  for (const [wx, wz] of [
    [1.15, 0.85],
    [1.15, -0.85],
    [-1.15, 0.85],
    [-1.15, -0.85],
  ]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(wx, 0.32, wz);
    wheel.castShadow = true;
    car.add(wheel);
  }

  return car;
}

/**
 * Dos vehículos cruzando el puente, uno por cada carril y en sentidos
 * opuestos. Son atrezzo (estáticos): dan escala humana y justifican el
 * nombre "puente vehicular".
 */
export function createVehicles(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'vehicles';

  const roadY = BASE_TOP_Y + ROAD_THICKNESS;

  const carA = createCar('#a83232');
  carA.position.set(-6, roadY, 2);
  group.add(carA);

  const carB = createCar('#2f5d8a');
  carB.position.set(7, roadY, -2);
  carB.rotation.y = Math.PI;
  group.add(carB);

  return group;
}

/** Puntos ancla (en espacio mundo) usados para proyectar las cotas técnicas 3D→2D. */
export interface DimensionAnchor {
  id: string;
  label: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
}

export function getDimensionAnchors(): DimensionAnchor[] {
  const halfX = BRIDGE_LENGTH_X / 2;
  const halfZ = BRIDGE_WIDTH_Z / 2;
  const colX = halfX - COLUMN_EDGE_OFFSET;

  return [
    {
      id: 'largo',
      label: `Largo 30 m`,
      start: new THREE.Vector3(-halfX, BASE_TOP_Y + 0.3, halfZ + 1.5),
      end: new THREE.Vector3(halfX, BASE_TOP_Y + 0.3, halfZ + 1.5),
    },
    {
      id: 'ancho',
      label: `Ancho 10 m`,
      start: new THREE.Vector3(-halfX - 1.5, BASE_TOP_Y + 0.3, -halfZ),
      end: new THREE.Vector3(-halfX - 1.5, BASE_TOP_Y + 0.3, halfZ),
    },
    {
      id: 'curva',
      label: `Altura curva 2 m`,
      start: new THREE.Vector3(0, BASE_TOP_Y, halfZ + 0.5),
      end: new THREE.Vector3(0, BASE_TOP_Y + CURVE_HEIGHT, halfZ + 0.5),
    },
    {
      id: 'columna',
      label: `Columna ⌀1 m · h 5 m`,
      start: new THREE.Vector3(colX, GROUND_Y, -halfZ - 1.5),
      end: new THREE.Vector3(colX, GROUND_Y + COLUMN_HEIGHT, -halfZ - 1.5),
    },
  ];
}
