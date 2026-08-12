import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const [, , objPathArg, mtlPathArg, outputPathArg] = process.argv;

if (!objPathArg || !mtlPathArg || !outputPathArg) {
  console.error('Usage: node scripts/convert-obj-to-glb.mjs <vehicle.obj> <vehicle.mtl> <output.glb>');
  process.exit(1);
}

globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    }, (error) => {
      this.error = error;
      this.onerror?.(error);
    });
  }
};

const objPath = resolve(objPathArg);
const mtlPath = resolve(mtlPathArg);
const outputPath = resolve(outputPathArg);

const mtlText = await readFile(mtlPath, 'utf8');
const objText = await readFile(objPath, 'utf8');

const materialCreator = new MTLLoader()
  .setPath(`${dirname(mtlPath)}/`)
  .parse(mtlText, `${dirname(mtlPath)}/`);

materialCreator.preload();

const object = new OBJLoader()
  .setMaterials(materialCreator)
  .parse(objText);

object.name = 'Model3_Performance_2024';

const flippedUvs = new WeakSet();

object.traverse((child) => {
  if (!child.isMesh) return;

  child.castShadow = true;
  child.receiveShadow = true;

  // OBJ measures v from the bottom, glTF from the top. Without the flip the wrap
  // template lands upside down on the car (hood art on the bumper, mirrored text).
  // Keyed on the attribute, since meshes can share one: flipping twice undoes it.
  const uv = child.geometry?.attributes?.uv;
  if (uv && !flippedUvs.has(uv)) {
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    uv.needsUpdate = true;
    flippedUvs.add(uv);
  }

  if (uv && !child.geometry.attributes.uv1) {
    child.geometry.setAttribute('uv1', uv);
  }

  const materialName = Array.isArray(child.material)
    ? child.material[0]?.name
    : child.material?.name;

  if (!materialName) return;

  const lowerName = materialName.toLowerCase();
  if (lowerName.includes('glass')) {
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    child.material = materials.map((material) => {
      const glass = new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.5,
      });
      glass.name = material.name;
      return glass;
    });
  }
});

const exporter = new GLTFExporter();

const glb = await new Promise((resolveExport, rejectExport) => {
  exporter.parse(
    object,
    resolveExport,
    rejectExport,
    {
      binary: true,
      trs: false,
      onlyVisible: true,
    },
  );
});

await writeFile(outputPath, Buffer.from(glb));
console.log(`Wrote ${outputPath}`);
