/**
 * The model viewer: a three.js scene for kernel GLB output, a status line, an error overlay, the
 * parameter form and analysis reports, mounted into any container element. Transport-agnostic:
 * `tscad dev` feeds it from a WebSocket, the docs playground from a Web Worker running the wasm
 * kernel. Styles come from `@tscad/viewer/style.css` and are scoped to the container.
 */

import type { ParametersJsonSchema } from '@tscad/modeling';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { linkLocations } from './links';
import { createParameterForm } from './parameter-form';
import type { Editor } from './protocol';
import { formatReport, type Reports } from './report';
import { valuesFromQuery, valuesToQuery } from './url-parameters';

export type { Reports } from './report';

export type Theme = 'auto' | 'light' | 'dark';

export type ViewerOptions = {
  /** Receives a complete set of parameter values whenever the user (or the URL) changes them. */
  onParams: (values: Record<string, unknown>) => void;
  /** `auto` (default) follows the system setting. */
  theme?: Theme;
  /** Keep parameter values in the page URL's query, and apply them from it on load (default: true). */
  urlSync?: boolean;
};

export type Viewer = {
  /** Replaces the shown model (kernel GLB). Clears no error: call `clearError` first if appropriate. */
  showModel(glb: ArrayBuffer): Promise<void>;
  setStatus(html: string): void;
  /** Shows `message` above the last good model; source locations link to `editor` if given. */
  showError(message: string, editor?: Editor): void;
  clearError(): void;
  /** Updates the parameter form (empty schema: hidden) and, with `urlSync`, the page URL. */
  showParameters(schema: ParametersJsonSchema, values: Record<string, unknown>): void;
  /** Shows analysis plugin reports by plugin name (none: hidden). */
  showAnalysis(reports: Reports): void;
  setTheme(theme: Theme): void;
  /** Stops rendering and removes the viewer from its container. */
  dispose(): void;
};

const MARKUP = `
  <pre class="tscad-error"></pre>
  <aside class="tscad-sidebar">
    <section class="tscad-parameters" hidden>
      <header>Parameters <button class="reset" type="button" title="Reset all parameters to their defaults">Reset</button></header>
      <div class="fields"></div>
    </section>
    <section class="tscad-analysis" hidden>
      <header>Analysis</header>
      <div class="reports"></div>
    </section>
  </aside>
  <div class="tscad-status"></div>`;

export function createViewer(
  container: HTMLElement,
  { onParams, theme = 'auto', urlSync = true }: ViewerOptions,
): Viewer {
  const root = document.createElement('div');
  root.className = 'tscad-viewer';
  root.innerHTML = MARKUP;
  container.append(root);
  const part = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const statusElement = part('.tscad-status');
  const errorElement = part('.tscad-error');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  // ==================== scene ====================

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  root.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  // CAD models are Z-up; the kernel writes its GLB in the model's own coordinates.
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1e6);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xff_ff_ff, 0x88_90_a0, 2));
  const sun = new THREE.DirectionalLight(0xff_ff_ff, 1.6);
  camera.add(sun); // a headlight: shading follows the view
  sun.position.set(1, 2, 3);
  scene.add(camera);

  let grid: THREE.GridHelper | undefined;
  let model: THREE.Object3D | undefined;
  // New models are framed until the user moves the camera; double-click frames again.
  let cameraMoved = false;
  controls.addEventListener('start', () => (cameraMoved = true));
  renderer.domElement.addEventListener('dblclick', () => {
    cameraMoved = false;
    if (model) frame(model);
  });

  const edgeMaterials = new Set<THREE.LineBasicMaterial>();
  const isDark = () => (theme === 'auto' ? systemDark.matches : theme === 'dark');
  function applyTheme() {
    root.dataset.theme = isDark() ? 'dark' : 'light';
    scene.background = new THREE.Color(isDark() ? 0x16_18_1d : 0xf4_f5_f7);
    for (const line of edgeMaterials) line.color.set(isDark() ? 0x0b_0c_0f : 0x1d_23_30);
  }
  systemDark.addEventListener('change', applyTheme);

  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = root;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(root);
  applyTheme();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  // ==================== model loading ====================

  const loader = new GLTFLoader();

  async function showModel(glb: ArrayBuffer) {
    const gltf = await loader.parseAsync(glb, '');
    const next = gltf.scene;
    next.traverse((object) => {
      // The kernel adds the B-rep edges as a line primitive; draw them as crisp outlines.
      if (object instanceof THREE.LineSegments) {
        const material = new THREE.LineBasicMaterial();
        edgeMaterials.add(material);
        object.material = material;
        object.renderOrder = 1;
      } else if (object instanceof THREE.Mesh) {
        const material = object.material as THREE.MeshStandardMaterial;
        material.side = THREE.DoubleSide;
        // Push faces back slightly so edges on them don't z-fight.
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1;
        material.polygonOffsetUnits = 1;
      }
    });
    if (model) {
      scene.remove(model);
      disposeObject(model);
    }
    model = next;
    scene.add(model);
    applyTheme();
    if (!cameraMoved) frame(model);
  }

  /** Points the camera at the model from the classic isometric-ish direction and fits it. */
  function frame(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 1e-3);
    const distance = (1.25 * radius) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)); // 25% margin
    camera.position
      .copy(center)
      .add(new THREE.Vector3(1, -1.2, 0.9).normalize().multiplyScalar(distance));
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);

    // A grid on the build plate (z = min), sized to the model with "nice" cell sizes.
    if (grid) scene.remove(grid);
    const extent = Math.max(size.x, size.y) * 1.5;
    const step = 10 ** Math.floor(Math.log10(extent / 10));
    const cells = Math.ceil(extent / step / 2) * 2;
    grid = new THREE.GridHelper(cells * step, cells, 0x88_90_a0, 0x88_90_a0);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    grid.rotation.x = Math.PI / 2;
    grid.position.set(center.x, center.y, box.min.z);
    scene.add(grid);
  }

  function disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        for (const material of [child.material].flat()) {
          edgeMaterials.delete(material);
          material.dispose();
        }
      }
    });
  }

  // ==================== parameters and analysis ====================

  const form = createParameterForm(part('.tscad-parameters'), onParams);
  // Parameters in the page URL (from a bookmark or shared link) are applied once per page load.
  let urlApplied = !urlSync;

  const analysisElement = part('.tscad-analysis');
  function showAnalysis(reports: Reports) {
    const list = analysisElement.querySelector('.reports')!;
    list.replaceChildren(
      ...Object.entries(reports).map(([name, report]) => {
        const { rows, warnings, error } = formatReport(report);
        const element = document.createElement('div');
        element.className = 'report';
        element.append(textElement('h3', name));
        if (error) element.append(textElement('p', error, 'failure'));
        if (rows.length > 0) {
          const list = document.createElement('dl');
          for (const [label, value] of rows)
            list.append(textElement('dt', label), textElement('dd', value));
          element.append(list);
        }
        for (const warning of warnings) element.append(textElement('p', warning, 'warning'));
        if (!error && warnings.length === 0) element.append(textElement('p', 'No warnings', 'ok'));
        return element;
      }),
    );
    analysisElement.hidden = Object.keys(reports).length === 0;
  }

  return {
    showModel,
    showAnalysis,
    setStatus: (html) => (statusElement.innerHTML = html),
    showError: (message, editor) => (errorElement.innerHTML = linkLocations(message, editor)),
    clearError: () => (errorElement.textContent = ''),
    showParameters(schema, values) {
      if (!urlApplied && Object.keys(schema.properties ?? {}).length > 0) {
        urlApplied = true;
        const merged = { ...values, ...valuesFromQuery(schema, location.search) };
        if (JSON.stringify(merged) !== JSON.stringify(values)) {
          form.update(schema, merged);
          onParams(merged);
          return;
        }
      }
      form.update(schema, values);
      if (urlSync) {
        const query = valuesToQuery(schema, values);
        history.replaceState(
          undefined,
          '',
          `${location.pathname}${query ? `?${query}` : ''}${location.hash}`,
        );
      }
    },
    setTheme(next) {
      theme = next;
      applyTheme();
    },
    dispose() {
      renderer.setAnimationLoop(null); // eslint-disable-line unicorn/no-null -- three's API
      resizeObserver.disconnect();
      systemDark.removeEventListener('change', applyTheme);
      controls.dispose();
      if (model) disposeObject(model);
      renderer.dispose();
      root.remove();
    },
  };
}

function textElement(tag: string, text: string, className?: string) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
