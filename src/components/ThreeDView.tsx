
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { TRANSLATIONS } from '../translations';


import type { DesignCanvasHandle } from './DesignCanvas';
import { ErrorBoundary } from './ErrorBoundary';
import { CarWheels, CarContactShadow } from './CarWheels';
import '../styles/three-loader.css';

interface ThreeDViewProps {
    stageRef: React.RefObject<DesignCanvasHandle | null>;
    modelPath: string;
    showTexture?: boolean;
    isActive?: boolean;
    onToggleWrap?: (visible: boolean) => void;
    translations?: {
        applyWrap: string;
        removeWrap: string;
    };
    language?: 'en' | 'zh';
    autoRotate?: boolean;
    autoRotateSpeed?: number;
    /** Hide the built-in wrap pill when the host UI owns that control. */
    hideWrapToggle?: boolean;
    /** Clear to transparent instead of the studio's black — used by the render surface. */
    transparent?: boolean;
    /** Factory paint under the wrap, and the whole car when no wrap is shown. */
    paintColor?: string;
    /** Overrides the automatic framing, e.g. a tighter crop for rendered thumbnails. */
    fov?: number;
}

/**
 * Per-model overrides for the S/X GLBs, mirroring how teslawrapgallery.com maps them.
 * Those assets carry no usable material naming for this purpose, so the site pins the
 * mapping by mesh name instead of inferring it, and we follow the same lists.
 */
const UV0_WRAP_MESHES: Record<string, Set<string>> = {
    'ModelS_2021.glb': new Set(['mesh_9_1', 'Hood_Hinge_1', 'Hood_Hinge_2']),
    'ModelS_Plaid_2025.glb': new Set(['mesh_9_1', 'Hood_Hinge_1', 'Hood_Hinge_2']),
    'ModelX_2021.glb': new Set(['mesh_7_1', 'mesh_8_1', 'Hood_Hinge_1', 'Hood_Hinge_2']),
};

/** Meshes that stay black trim on those models however the materials are named. */
const FORCE_TRIM_MESHES: Record<string, Set<string>> = {
    'ModelS_2021.glb': new Set([
        'mesh_0', 'mesh_0_2', 'mesh_0_3',
        'mesh_24_3', 'mesh_30_1', 'mesh_35_3', 'mesh_41_1',
        'mesh_46', 'mesh_47', 'mesh_48', 'mesh_49_1',
        'mesh_125_2', 'mesh_125_3',
        'mesh_128_2', 'mesh_128_3', 'mesh_128_4',
    ]),
    'ModelS_Plaid_2025.glb': new Set([
        'mesh_0', 'mesh_0_2', 'mesh_0_3',
        'mesh_24_3', 'mesh_30_1', 'mesh_35_3', 'mesh_41_1',
        'mesh_46', 'mesh_47', 'mesh_48', 'mesh_49_1',
        'mesh_125_2', 'mesh_125_3',
        'mesh_128_2', 'mesh_128_3', 'mesh_128_4',
    ]),
    'ModelX_2021.glb': new Set([
        'mesh_0_2', 'mesh_0_5',
        'mesh_23_1', 'mesh_30_1', 'mesh_37_1', 'mesh_45_1',
        'mesh_126', 'mesh_126_1', 'mesh_126_2',
        'mesh_129_1', 'mesh_129_2',
    ]),
};

/**
 * Whether a mesh's wrap UVs can be sampled, mirroring teslawrapgallery.com. Tesla
 * collapses the UVs of trim-adjacent paint meshes (A-pillars, roof rails, mirror caps,
 * PaintRough and ExteriorFade accents) to one point *inside* the template as a "tint
 * from wrap" marker: the whole piece takes that one texel. Only a point that lies
 * outside the template (wheel wells, undercarriage) is really unmapped. Measured once
 * per geometry and cached.
 */
function hasMappedWrapUv(geometry: THREE.BufferGeometry, wrapUv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): boolean {
    const cache = geometry.userData as { wrapUvMapped?: boolean };
    if (cache.wrapUvMapped !== undefined) return cache.wrapUvMapped;

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < wrapUv.count; i++) {
        const u = wrapUv.getX(i);
        const v = wrapUv.getY(i);
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    const centerU = (minU + maxU) / 2;
    const centerV = (minV + maxV) / 2;
    const insideTemplate = centerU >= 0 && centerU <= 1 && centerV >= 0 && centerV <= 1;
    cache.wrapUvMapped = area > 0.001 || insideTemplate;
    return cache.wrapUvMapped;
}

const isPaintMaterial = (name?: string) => /paint/i.test(name ?? '');

/**
 * Whether a material is the car's bodywork, and so takes the factory colour.
 *
 * Meshes cannot be told apart by name — GLTFLoader calls them `mesh_0_7` under a parent
 * like `Interior_Body` — but the authored materials name themselves precisely: Paint,
 * PaintRough and Exterior on the body, Fabric, Carpet, Seatbelts, Aluminum and the rest
 * inside. The Cybertruck has no Paint at all; its body is Metal_Dark_Exterior, which is
 * why Exterior counts and why the second test then drops its plastic and rubber trim.
 */
const BODY_MATERIAL = /paint|exterior|^cover/i;
const NOT_BODY_MATERIAL = /plastic|rubber|glass|light|fabric|carpet|leather|seat|interior|trim|chrome|mirror|frunk|tpo|pvc/i;

const isBodyMaterial = (name?: string) =>
    BODY_MATERIAL.test(name ?? '') && !NOT_BODY_MATERIAL.test(name ?? '');

/**
 * GLTFLoader imports a panel's parts as sibling meshes named `mesh_22`, `mesh_22_1`, …
 * under a parent named for the panel, so the parent is the panel identity; standalone
 * nodes keep their own name.
 */
const panelKeyOf = (mesh: THREE.Mesh) =>
    (/^mesh_\d+(_\d+)?$/.test(mesh.name) ? mesh.parent?.name : mesh.name) || mesh.name;

/**
 * Material(s) as authored. Stashed on first read because the base-paint pass swaps
 * materials before the wrap pass runs, which would otherwise lose the original names.
 */
function originalMaterials(mesh: THREE.Mesh): THREE.Material[] {
    const stash = mesh.userData as { origMaterials?: THREE.Material[] };
    if (!stash.origMaterials) {
        stash.origMaterials = Array.isArray(mesh.material) ? [...mesh.material] : [mesh.material];
    }
    return stash.origMaterials;
}

// Simplified Car that applies texture to specific material
/**
 * Assets that are modelled nose-the-other-way. The camera is fixed, so without this the
 * S and X show their tail where every other car shows its face. The wheel anchors would
 * give the forward direction for free, but these are exactly the assets that lack them.
 */
const BACKWARDS_MODELS = ['models_2021', 'modelx_2021', 'models_2025_plaid'];

const facesBackwards = (modelPath: string) => BACKWARDS_MODELS.some(name => modelPath.includes(name));

const TexturedCar = ({ stageRef, modelPath, showTexture = true, isActive = true, transparentStage = false, paintColor = '#000000' }: { stageRef: React.RefObject<DesignCanvasHandle | null>, modelPath: string, showTexture?: boolean, isActive?: boolean, transparentStage?: boolean, paintColor?: string }) => {
    const { scene } = useGLTF(modelPath);
    const modelFile = modelPath.split('/').pop() || '';

    // Create the texture instance once and keep it consistent
    const texture = useMemo(() => {
        const t = new THREE.CanvasTexture(document.createElement('canvas'));
        t.flipY = false;
        t.colorSpace = THREE.SRGBColorSpace; // FIX: Ensure texture is treated as sRGB
        return t;
    }, []);

    const [textureActive, setTextureActive] = useState(showTexture);

    useEffect(() => {
        setTextureActive(showTexture);
    }, [showTexture]);

    // Materials bind the wrap only as this flips, so a view that mounts with a wrap
    // already loaded — the 3D gallery entered from the studio — otherwise shows the car
    // half painted. Cycling once per scene covers mounting and changing car.
    // ponytail: workaround, not the root cause — remove once the material pass rebinds
    // on a texture change of its own accord.
    useEffect(() => {
        if (!showTexture) return;
        setTextureActive(false);
        const settle = window.setTimeout(() => setTextureActive(true), 60);
        return () => window.clearTimeout(settle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene]);

    const updateTexture = useCallback(() => {
        if (stageRef.current && textureActive) {
            try {
                const newCanvas = stageRef.current.getTextureCanvas();
                if (newCanvas && newCanvas.width > 0 && newCanvas.height > 0) {
                    // three allocates immutable GPU storage on the first upload, so a canvas of
                    // another size would land in a corner of the old allocation and stay there.
                    // Dropping the GPU copy makes the next upload allocate at the new size.
                    const current = texture.image as HTMLCanvasElement;
                    if (current.width !== newCanvas.width || current.height !== newCanvas.height) texture.dispose();
                    // eslint-disable-next-line react-hooks/immutability
                    texture.image = newCanvas;
                    texture.needsUpdate = true;
                }
            } catch {
                // console.error("Failed to update texture");
            }
        }
    }, [stageRef, textureActive, texture]);

    // Force update when becoming active
    useEffect(() => {
        if (isActive && textureActive) {
            console.log("3D View became active, forcing texture update");

            // Immediate attempt
            updateTexture();

            // Delayed attempt to allow for layout/rendering to settle
            const timer = setTimeout(() => {
                console.log("3D View delayed texture update");
                updateTexture();
            }, 100);

            // Second delay for safety
            const timer2 = setTimeout(() => {
                updateTexture();
            }, 500);

            return () => {
                clearTimeout(timer);
                clearTimeout(timer2);
            };
        }
    }, [isActive, textureActive, stageRef, texture, updateTexture]);


    // Setup initial material properties for realism (this useEffect remains for base material setup)
    useEffect(() => {
        scene.traverse((child) => {
            // instanceof, not a cast: two copies of @types/three are installed and the
            // traverse callback's Object3D comes from the other one, so a cast between
            // them does not type-check.
            if (child instanceof THREE.Mesh) {
                const mesh = child;
                if (mesh.userData.proceduralWheel) return;

                // Identify parts to paint vs parts to keep as is (glass, lights, wheels)
                const name = mesh.name.toLowerCase();
                const originals = originalMaterials(mesh);
                const materialName = (originals[0]?.name || '').toLowerCase();
                const parentName = mesh.parent?.name.toLowerCase() || '';
                const isPlaidVariant = modelFile === 'ModelS_Plaid_2025.glb' || modelFile === 'ModelX_2021.glb';
                // DEBUG: Log mesh names to find glass
                // DEBUG: Log mesh names and material names to find glass
                if (!(window as unknown as Record<string, boolean>)['logged_meshes_' + name]) {
                    // const matName = (mesh.material as THREE.Material)?.name || 'unknown';
                    // console.log('Found mesh:', name, 'Material:', matName);
                    (window as unknown as Record<string, boolean>)['logged_meshes_' + name] = true;
                }
                /**
                 * Some panes carry the asset's unnamed default material, which is plain
                 * white: the 2025 Model Y's rear quarter windows and roof glass among
                 * them. They used to be painted black, so they read as tinted glass by
                 * accident; once paint was limited to bodywork they turned into white
                 * slabs. Judge them by where they sit instead.
                 */
                const panelName = panelKeyOf(mesh).toLowerCase();
                const unauthored = originals.length > 0 && originals.every(m => !m?.name);
                const glassPanel = /window|glass|roof|windscreen|windshield/.test(panelName);

                const isGlass = materialName.includes('glass') || (unauthored && glassPanel);
                const isLight = name.includes('light') || name.includes('lamp');
                const isWheel = name.includes('wheel') || name.includes('tire') || name.includes('rim') || name.includes('kolo');
                const isInterior = name.includes('interior') || name.includes('seat');
                const isTrim = name.includes('trim') || name.includes('chrome');

                // Hide studio floor/environment if present - expanded list
                const isFloor = name.includes('ground') ||
                    name.includes('plane') ||
                    name.includes('studio') ||
                    name.includes('backdrop') ||
                    name.includes('floor') ||
                    name.includes('shadow') ||
                    name.includes('podium') ||
                    name.includes('platform') ||
                    name.includes('base') ||
                    name.includes('environment');

                if (isFloor) {
                    mesh.visible = false;
                    return;
                }

                if (isPlaidVariant && (parentName === 'fascia_front' || parentName === 'fascia_rear')) {
                    mesh.visible = false;
                    return;
                }

                if (!isPlaidVariant && (parentName === 'fascia_front_p3' || parentName === 'fascia_rear_p3')) {
                    mesh.visible = false;
                    return;
                }

                const shouldHideHelper =
                    parentName.includes('projection') ||
                    name.includes('projection') ||
                    parentName.includes('plates') ||
                    name.includes('plate_eu') ||
                    name.includes('plate_us') ||
                    parentName.includes('sensor') ||
                    name.includes('sensor');

                if (shouldHideHelper) {
                    mesh.visible = false;
                    return;
                }

                if (isGlass) {
                    const glassMaterial = new THREE.MeshStandardMaterial({
                        color: 0x222222,
                        metalness: 0.9,
                        roughness: 0.1,
                        transparent: true,
                        opacity: 0.5,
                    });
                    glassMaterial.name = 'Glass';
                    mesh.material = glassMaterial;
                } else if (isWheel) {
                    const m = new THREE.MeshStandardMaterial({
                        color: 0x111111,
                        roughness: 0.6,
                        metalness: 0.8,
                    });
                    mesh.material = m;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                } else if (isLight) {
                    const m = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff,
                        transmission: 0.9,
                        roughness: 0.1,
                        metalness: 0.1,
                        clearcoat: 1.0,
                    });
                    mesh.material = m;
                } else if (unauthored) {
                    // Not glass and not named: keep it dark rather than let the default
                    // white show, and out of the paint colour since it is not bodywork.
                    const m = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.6, metalness: 0.2 });
                    m.name = 'Unnamed';
                    mesh.material = m;
                } else if (!isInterior && !isTrim && originals.some(m => isBodyMaterial(m?.name))) {
                    // Bodywork: takes the factory colour.
                    const oldMat = originals.find(m => isPaintMaterial(m?.name)) ?? originals[0];

                    // Create a realistic car paint material (PhysicalMaterial) - Black Base
                    const newMat = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color(paintColor),
                        metalness: 0.1,
                        roughness: 0.1, // Smooth finish
                        clearcoat: 1.0, // High clearcoat for car paint look
                        clearcoatRoughness: 0.03, // Very polished clearcoat
                        envMapIntensity: 1.0,
                    });

                    if (oldMat instanceof THREE.MeshStandardMaterial) {
                        newMat.map = oldMat.map;
                    }

                    // Named so it can be told apart from the authored materials, which is
                    // how "does the factory colour land only on bodywork?" gets checked.
                    newMat.name = 'FactoryPaint';
                    mesh.material = newMat;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
            }
        });
    }, [scene, modelFile, paintColor]);

    // Apply texture to meshes
    useEffect(() => {
        console.log("Applying texture to meshes with smart detection...", { textureActive });
        const wrappedParts: string[] = [];

        // Check if texture is actually valid
        const isTextureValid = textureActive && texture;

        // The wrap template is laid out in a second UV set. Only fall back to uv0
        // when the model ships no wrap UVs at all — otherwise meshes outside the
        // template (roof rails, pillars, caps) would sample arbitrary bits of it.
        let modelHasWrapUv = false;
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry?.attributes.uv1) modelHasWrapUv = true;
        });

        scene.traverse((child) => {
            // instanceof, not a cast: two copies of @types/three are installed and the
            // traverse callback's Object3D comes from the other one, so a cast between
            // them does not type-check.
            if (child instanceof THREE.Mesh) {
                const mesh = child;
                if (mesh.userData.proceduralWheel) return;
                const name = mesh.name.toLowerCase();
                const originals = originalMaterials(mesh);
                const materialName = (originals[0]?.name || '').toLowerCase();

                // Smart detection logic...
                const isGlass = materialName.includes('glass');
                const isLight = name.includes('light') || name.includes('lamp') || name.includes('led');
                const isWheel = name.includes('wheel') || name.includes('tire') || name.includes('rim') || name.includes('kolo') || name.includes('caliper') || name.includes('brake');
                const isInterior = name.includes('interior') || name.includes('seat') || name.includes('steering') || name.includes('screen') || name.includes('floor') || name.includes('dashboard');
                const isTrim = name.includes('trim') || name.includes('chrome') || name.includes('badge') || name.includes('logo') || name.includes('lettering') || name.includes('license') || name.includes('plate') || name.includes('grille');
                const isMisc = name.includes('camera') || name.includes('sensor') || name.includes('wiper') || name.includes('mirror_glass');

                // A few S/X meshes carry the wrap layout in uv0, not the second set.
                const wrapUv = UV0_WRAP_MESHES[modelFile]?.has(mesh.name)
                    ? mesh.geometry.attributes.uv ?? mesh.geometry.attributes.uv1
                    : mesh.geometry.attributes.uv1 ?? (modelHasWrapUv ? null : mesh.geometry.attributes.uv);
                const shouldWrap = !isGlass && !isLight && !isWheel && !isInterior && !isTrim && !isMisc
                    && !FORCE_TRIM_MESHES[modelFile]?.has(mesh.name)
                    && originals.some(m => isBodyMaterial(m?.name)) && !!wrapUv
                    && hasMappedWrapUv(mesh.geometry, wrapUv);

                if (shouldWrap) {
                    wrappedParts.push(name);

                    // Normalize attributes: Tesla models seem to load as 'uv1' for the wrap layer.
                    // We use a custom attribute 'wrapUv' to avoid collision with standard 'uv2' in shaders.
                    mesh.geometry.setAttribute('wrapUv', wrapUv);

                    const newMat = new THREE.MeshPhysicalMaterial({
                        // Shows through wherever the wrap art is transparent.
                        color: new THREE.Color(paintColor),
                        roughness: 0.3,  // Very smooth
                        metalness: 0.3,   // Higher metalness for "metallic wrap" feel
                        clearcoat: 0.8,   // Max clearcoat for "wet" look
                        clearcoatRoughness: 0.05, // Sharp clearcoat reflections
                        // envMapIntensity: 0.1, // Strong reflections
                    });

                    // If Wrap is Active, we inject custom shader logic to map it using UVset 2 (or 1)
                    if (isTextureValid) {
                        // Ensure we use the texture
                        // Ensure we use the texture
                        // We use onBeforeCompile to inject the logic
                        newMat.onBeforeCompile = (shader) => {
                            shader.uniforms.uTex = { value: texture };

                            // Inject vertex shader logic to pass the custom UV set
                            shader.vertexShader = `
                                varying vec2 vWrapUv;
                                attribute vec2 wrapUv; 
                            ` + shader.vertexShader;

                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <uv_vertex>',
                                `#include <uv_vertex>
                                 vWrapUv = wrapUv;
                                 `
                            );

                            // Clean entry point
                            shader.vertexShader = shader.vertexShader.replace(
                                'void main() {',
                                'void main() { \n'
                            );


                            // Inject fragment shader logic
                            shader.fragmentShader = `
                                uniform sampler2D uTex;
                                varying vec2 vWrapUv;
                            ` + shader.fragmentShader;

                            shader.fragmentShader = shader.fragmentShader.replace(
                                '#include <map_fragment>',
                                `
                                vec4 wrapColor = texture2D(uTex, vWrapUv);
                                
                                // With NoToneMapping and SRGBColorSpace set on texture, we don't need manual gamma correction.
                                // The browser/ThreeJS should handle the texture lookups correctly now.

                                // Use alpha channel to blend between wrap and base paint
                                // Transparent areas (alpha=0) show base paint color (diffuseColor)
                                // Opaque areas (alpha=1) show wrap color
                                diffuseColor.rgb = mix(diffuseColor.rgb, wrapColor.rgb, wrapColor.a);
                                `
                            );
                        };

                        // We need to tell ThreeJS to include uv2 attributes. 
                        // Setting lightMap or aoMap usually forces it, or proper defines.
                        // Setting .defines = { 'USE_UV2': '' } works if the shader chunks respect it, 
                        // but built-in chunks usually look for map/lightMap presence.
                        // Manually adding 'attribute vec2 uv2' in shader string works IF the geometry has it.
                    }

                    mesh.material = newMat;
                    newMat.needsUpdate = true;
                }
            }
        });
        // console.log("Wrapped parts:", wrappedParts);
    }, [scene, textureActive, texture, paintColor]);

    useFrame((state) => {
        // Only update loop when active to save perf
        if (!isActive) return;

        // Throttling: Update every 3 frames (~20fps)
        if (state.clock.getElapsedTime() % 0.05 < 0.016) {
            updateTexture();
        }
    });

    return (
        <group>
            {/* Wheels mount inside the scene so they inherit its scale and offset. */}
            <primitive object={scene} scale={2} position={[0, -1, 0]}>
                <CarWheels scene={scene} />
                {!transparentStage && <CarContactShadow scene={scene} />}
            </primitive>
        </group>
    );
};

const ErrorFallback = ({ error, language = 'en' }: { error?: Error, language?: 'en' | 'zh' }) => {
    const t = TRANSLATIONS[language];
    return (
        <Html center>
            <div className="bg-black/80 text-white p-4 rounded text-center min-w-[200px]">
                <p className="font-bold text-red-400 mb-2">{t.modelError}</p>
                <p className="text-sm">{error?.message || t.failedToLoad3DModel}</p>
            </div>
        </Html>
    );
};

/**
 * Perspective FOV is vertical, so a portrait viewport loses horizontal framing and
 * crops the car's nose and tail. Widen it when the stage is taller than it is wide.
 */
function FitFraming({ override, modelPath }: { override?: number; modelPath: string }) {
    const { camera, size } = useThree();
    useEffect(() => {
        if (!(camera instanceof THREE.PerspectiveCamera)) return;
        const wanted = override ?? (size.height > size.width ? 62 : 45);
        if (camera.fov === wanted) return;
        camera.fov = wanted;
        camera.updateProjectionMatrix();
    }, [camera, size, override]);

    // Backwards assets are viewed from the mirrored corner, so every car shows its face
    // with the nose to the left. R3F reads the Canvas camera prop once at creation, so
    // switching cars has to move the camera here or the second car keeps the first's view.
    useEffect(() => {
        camera.position.set(facesBackwards(modelPath) ? 8 : -8, 2, -9);
    }, [camera, modelPath]);

    return null;
}

export const ThreeDView = ({ stageRef, modelPath, showTexture = true, isActive = true, onToggleWrap, language = 'en', autoRotate = false, autoRotateSpeed = 1.0, hideWrapToggle = false, transparent = false, paintColor = '#000000', fov }: ThreeDViewProps) => {
    // Determine if we have a valid model path
    const hasModel = modelPath && modelPath.length > 0;
    const t = TRANSLATIONS[language];

    // State for toggling wrap on/off
    const [isWrapApplied, setIsWrapApplied] = useState(showTexture);

    // Sync with parent's showTexture prop when it changes
    useEffect(() => {
        setIsWrapApplied(showTexture);
    }, [showTexture]);

    // A GLB is tens of megabytes; without this the stage is just black while it
    // downloads and there is no way to tell loading from broken. useProgress reads
    // three's loading manager, so it works out here in the DOM. It counts files, not
    // bytes, so the bar sweeps instead of showing a percentage stuck at zero.
    const { active: loadingModel } = useProgress();

    const toggleWrap = () => {
        const newState = !isWrapApplied;
        setIsWrapApplied(newState);
        onToggleWrap?.(newState);
    };

    return (
        <div className="w-full h-full relative" style={{
            background: transparent ? 'transparent' : 'linear-gradient(to bottom, #17171a, #0c0c0e)'
        }}>
            {hasModel && loadingModel && (
                <div className="tdv-loading">
                    <div className="tdv-loading-label">{t.loadingModel}</div>
                    <div className="tdv-loading-track"><div className="tdv-loading-bar" /></div>
                </div>
            )}

            <ErrorBoundary fallback={
                <div className="flex items-center justify-center h-full text-white/50">
                    <p>{t.viewUnavailable}</p>
                </div>
            }>
                <Canvas
                    shadows
                    camera={{ position: [-8, 2, -9], fov: 45, near: 0.01, far: 2000 }}
                    gl={{
                        toneMapping: THREE.ACESFilmicToneMapping,
                        outputColorSpace: THREE.SRGBColorSpace,
                        alpha: transparent,
                        preserveDrawingBuffer: transparent,
                    }}
                    onCreated={({ gl }) => {
                        gl.toneMappingExposure = 1.6;
                    }}
                >
                    {!transparent && <color attach="background" args={['#0c0c0e']} />}
                    <FitFraming override={fov} modelPath={modelPath} />
                    {/* Tesla Gallery-style OrbitControls */}
                    <OrbitControls
                        makeDefault
                        target={[0, 0.6, 0]}
                        enableDamping
                        dampingFactor={0.05}
                        minDistance={3}
                        maxDistance={15}
                        minPolarAngle={0}
                        maxPolarAngle={Math.PI * 0.565} // ~101.5 degrees
                        autoRotate={autoRotate}
                        autoRotateSpeed={autoRotateSpeed}
                    />

                    {/* Tesla Gallery Studio Lighting - 5 Light Setup */}
                    {/* Ambient: Base illumination */}
                    <ambientLight intensity={1.2} color="#ffffff" />

                    {/* Key Light: Main light from front-right-top */}
                    <directionalLight
                        position={[5, 8, 5]}
                        intensity={1.8}
                        color="#ffffff"
                        castShadow
                        shadow-mapSize={[2048, 2048]}
                        shadow-camera-far={50}
                        shadow-camera-left={-10}
                        shadow-camera-right={10}
                        shadow-camera-top={10}
                        shadow-camera-bottom={-10}
                    />

                    {/* Fill Light: Fills shadows from back-left */}
                    <directionalLight
                        position={[-5, 4, -3]}
                        intensity={0.8}
                        color="#ffffff"
                    />

                    {/* Rim Light: Highlights on rear */}
                    <directionalLight
                        position={[0, 2, -8]}
                        intensity={1.0}
                        color="#ffffff"
                    />

                    {/* Bottom Light: Subtle upward bounce light */}
                    <directionalLight
                        position={[0, -3, 0]}
                        intensity={0.4}
                        color="#ffffff"
                    />

                    {/* Ground shadow plane — omitted on a transparent render surface. */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow visible={!transparent}>
                        <planeGeometry args={[50, 50]} />
                        <shadowMaterial transparent opacity={0.3} />
                    </mesh>

                    {hasModel ? (
                        <ErrorBoundary key={`${modelPath}-${isWrapApplied}`} fallback={<ErrorFallback language={language} />}>
                            {/* Removed Stage to use custom Environment and lighting control */}
                            <group position={[0, 0, 0]}>
                                <TexturedCar stageRef={stageRef} modelPath={modelPath} showTexture={isWrapApplied} isActive={isActive} transparentStage={transparent} paintColor={paintColor} />
                            </group>
                        </ErrorBoundary>
                    ) : (
                        <Html center>
                            <div className="bg-black/80 text-white p-4 rounded text-center">
                                <p className="font-bold">{t.no3DModel}</p>
                                <p className="text-xs text-gray-400">{t.selectDifferentVehicle}</p>
                            </div>
                        </Html>
                    )}
                </Canvas>
            </ErrorBoundary >

            {/* Apply/Remove Wrap Button */}
            {
                hasModel && !hideWrapToggle && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '24px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                        }}
                    >
                        <button
                            onClick={toggleWrap}
                            className="group"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                backgroundColor: isWrapApplied
                                    ? 'rgba(20, 20, 20, 0.8)'
                                    : 'rgba(255, 255, 255, 0.9)',
                                backdropFilter: 'blur(8px)',
                                border: `1px solid ${isWrapApplied ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: '30px',
                                color: isWrapApplied ? 'white' : 'black',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isWrapApplied ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                            }}>
                                <span style={{ fontSize: '10px' }}>
                                    {isWrapApplied ? '✕' : '✓'}
                                </span>
                            </div>

                            {/* Label */}
                            <span>
                                {isWrapApplied
                                    ? (t.removeWrap)
                                    : (t.applyWrap)}
                            </span>
                        </button>
                    </div>
                )
            }
        </div >
    );
};
