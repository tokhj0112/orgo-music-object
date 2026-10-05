import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const host = document.querySelector("[data-hero-3d]");

if (host && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const art = host.closest(".hero-art");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  const modelRoot = new THREE.Group();
  const pointer = new THREE.Vector2();
  const target = new THREE.Vector2();
  const clock = new THREE.Clock();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe9eef9, 0x161412, 2.6));

  const keyLight = new THREE.DirectionalLight(0xfff0dc, 3.6);
  keyLight.position.set(3, 5, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xc6d7ff, 2.1);
  fillLight.position.set(-5, 1, 3);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffbd6e, 16, 0, 2);
  rimLight.position.set(1.5, 2, -3);
  scene.add(rimLight);
  scene.add(modelRoot);

  function fitRenderer() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  new ResizeObserver(fitRenderer).observe(host);
  fitRenderer();

  art?.addEventListener("pointermove", (event) => {
    const bounds = art.getBoundingClientRect();
    target.x = THREE.MathUtils.clamp(
      ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
      -1,
      1,
    );
    target.y = THREE.MathUtils.clamp(
      ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
      -1,
      1,
    );
  });

  art?.addEventListener("pointerleave", () => target.set(0, 0));

  new GLTFLoader().load(
    host.dataset.model,
    (gltf) => {
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const largestSide = Math.max(size.x, size.y, size.z);

      model.position.sub(center);
      modelRoot.add(model);
      modelRoot.rotation.set(-0.12, -0.32, 0);
      camera.position.set(largestSide * 0.8, largestSide * 0.42, largestSide * 3.35);
      camera.lookAt(0, 0, 0);
      host.classList.add("is-ready");
    },
    undefined,
    () => host.classList.add("has-error"),
  );

  function render() {
    const elapsed = clock.getElapsedTime();
    pointer.lerp(target, 0.065);

    modelRoot.rotation.y = THREE.MathUtils.lerp(
      modelRoot.rotation.y,
      -0.32 + pointer.x * 0.42 + Math.sin(elapsed * 0.32) * 0.055,
      0.055,
    );
    modelRoot.rotation.x = THREE.MathUtils.lerp(
      modelRoot.rotation.x,
      -0.12 - pointer.y * 0.16,
      0.055,
    );
    modelRoot.position.y = Math.sin(elapsed * 1.05) * 0.035;

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  render();
}
