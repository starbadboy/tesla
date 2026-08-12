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

object.traverse((child) => {
  if (!child.isMesh) return;

  child.castShadow = true;
  child.receiveShadow = true;

  if (child.geometry?.attributes?.uv && !child.geometry.attributes.uv1) {
    child.geometry.setAttribute('uv1', child.geometry.attributes.uv);
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
