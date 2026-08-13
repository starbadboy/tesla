
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { TRANSLATIONS } from '../translations';


import type { DesignCanvasHandle } from './DesignCanvas';
import { ErrorBoundary } from './ErrorBoundary';

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

const isPaintMaterial = (name?: string) => /paint/i.test(name ?? '');

/**
 * Only a plain "Paint"/"CarPaint" names a panel's main skin. The "Fade" and "Rough"
 * variants are small accents: the classic Model Y tailgate is 1950 verts of
 * "ExteriorFade" skin next to a 52-vert "PaintFade", and the classic Model 3 rear
 * doors are all "Exterior" beside a thin "PaintRough".
 */
const isPrimaryPaint = (name?: string) =>
    isPaintMaterial(name) && !/rough|fade/i.test(name ?? '');

/**
 * How much of a panel the paint-named mesh must cover before its "Exterior" sibling
 * is read as trim. Guards against models that name a sliver "Paint" while the real
 * skin sits under another name — leaving a panel unwrapped is far worse than
 * wrapping a strip of trim.
 */
const MIN_PAINT_SHARE = 0.2;

/**
 * Tesla splits a panel across materials — "Paint" for the skin, "Exterior" for the
 * black trim beside it (B-pillar, window surrounds, wheel arches). GLTFLoader imports
 * those as sibling meshes named `mesh_22`, `mesh_22_1`, … under a parent named for the
 * panel, so the parent is the panel identity; standalone nodes keep their own name.
 */
const panelKeyOf = (mesh: THREE.Mesh) =>
    (/^mesh_\d+(_\d+)?$/.test(mesh.name) ? mesh.parent?.name : mesh.name) || mesh.name;

/** Panels whose painted skin is named as such — there "Exterior" is trim. */
function paintedPanels(scene: { traverse(callback: (object: unknown) => void): void }): Set<string> {
    const sizes = new Map<string, { biggest: number; paint: number }>();
    scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const verts = child.geometry?.attributes.position?.count ?? 0;
        const key = panelKeyOf(child);
        const seen = sizes.get(key) ?? { biggest: 0, paint: 0 };
        const isPaint = originalMaterials(child).some(m => isPrimaryPaint(m?.name));
        sizes.set(key, {
            biggest: Math.max(seen.biggest, verts),
            paint: isPaint ? Math.max(seen.paint, verts) : seen.paint,
        });
    });

    const panels = new Set<string>();
    for (const [key, { biggest, paint }] of sizes) {
        if (paint > 0 && paint >= MIN_PAINT_SHARE * biggest) panels.add(key);
    }
    return panels;
}

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
const TexturedCar = ({ stageRef, modelPath, showTexture = true, isActive = true }: { stageRef: React.RefObject<DesignCanvasHandle | null>, modelPath: string, showTexture?: boolean, isActive?: boolean }) => {
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

    const updateTexture = useCallback(() => {
        if (stageRef.current && textureActive) {
            try {
                const newCanvas = stageRef.current.getTextureCanvas();
                if (newCanvas && newCanvas.width > 0 && newCanvas.height > 0) {
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


    const painted = useMemo(() => paintedPanels(scene), [scene]);

    /** True when the mesh is a panel's painted skin rather than the trim beside it. */
    const takesPaint = useCallback((mesh: THREE.Mesh) => {
        if (!painted.has(panelKeyOf(mesh))) return true;
        return originalMaterials(mesh).some(m => isPaintMaterial(m?.name));
    }, [painted]);

    // Setup initial material properties for realism (this useEffect remains for base material setup)
    useEffect(() => {
        scene.traverse((child) => {
            // instanceof, not a cast: two copies of @types/three are installed and the
            // traverse callback's Object3D comes from the other one, so a cast between
            // them does not type-check.
            if (child instanceof THREE.Mesh) {
                const mesh = child;

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
                const isGlass = materialName.includes('glass');
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
                } else if (!isInterior && !isTrim && takesPaint(mesh)) {
                    // This is likely the body paint
                    const oldMat = originals.find(m => isPaintMaterial(m?.name)) ?? originals[0];

                    // Create a realistic car paint material (PhysicalMaterial) - Black Base
                    const newMat = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color(0x000000), // Black base car color
                        metalness: 0.1,
                        roughness: 0.1, // Smooth finish
                        clearcoat: 1.0, // High clearcoat for car paint look
                        clearcoatRoughness: 0.03, // Very polished clearcoat
                        envMapIntensity: 1.0,
                    });

                    if (oldMat instanceof THREE.MeshStandardMaterial) {
                        newMat.map = oldMat.map;
                    }

                    mesh.material = newMat;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
            }
        });
    }, [scene, modelFile, takesPaint]);

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
                    && takesPaint(mesh) && !!wrapUv;

                if (shouldWrap) {
                    wrappedParts.push(name);

                    // Normalize attributes: Tesla models seem to load as 'uv1' for the wrap layer.
                    // We use a custom attribute 'wrapUv' to avoid collision with standard 'uv2' in shaders.
                    mesh.geometry.setAttribute('wrapUv', wrapUv);

                    const newMat = new THREE.MeshPhysicalMaterial({
                        color: 0x000000, // Black base paint
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
    }, [scene, textureActive, texture, takesPaint]);

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
            <primitive object={scene} scale={2} position={[0, -1, 0]} />
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
function FitFraming() {
    const { camera, size } = useThree();
    useEffect(() => {
        if (!(camera instanceof THREE.PerspectiveCamera)) return;
        const wanted = size.height > size.width ? 62 : 45;
        if (camera.fov === wanted) return;
        camera.fov = wanted;
        camera.updateProjectionMatrix();
    }, [camera, size]);
    return null;
}

export const ThreeDView = ({ stageRef, modelPath, showTexture = true, isActive = true, onToggleWrap, language = 'en', autoRotate = false, autoRotateSpeed = 1.0, hideWrapToggle = false }: ThreeDViewProps) => {
    // Determine if we have a valid model path
    const hasModel = modelPath && modelPath.length > 0;
    const t = TRANSLATIONS[language];

    // State for toggling wrap on/off
    const [isWrapApplied, setIsWrapApplied] = useState(showTexture);

    // Sync with parent's showTexture prop when it changes
    useEffect(() => {
        setIsWrapApplied(showTexture);
    }, [showTexture]);

    const toggleWrap = () => {
        const newState = !isWrapApplied;
        setIsWrapApplied(newState);
        onToggleWrap?.(newState);
    };

    return (
        <div className="w-full h-full relative" style={{
            background: 'linear-gradient(to bottom, #17171a, #0c0c0e)'
        }}>
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
                    }}
                    onCreated={({ gl }) => {
                        gl.toneMappingExposure = 1.6;
                    }}
                >
                    <color attach="background" args={['#0c0c0e']} />
                    <FitFraming />
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

                    {/* Ground shadow plane */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
                        <planeGeometry args={[50, 50]} />
                        <shadowMaterial transparent opacity={0.3} />
                    </mesh>

                    {hasModel ? (
                        <ErrorBoundary key={`${modelPath}-${isWrapApplied}`} fallback={<ErrorFallback language={language} />}>
                            {/* Removed Stage to use custom Environment and lighting control */}
                            <group position={[0, 0, 0]}>
                                <TexturedCar stageRef={stageRef} modelPath={modelPath} showTexture={isWrapApplied} isActive={isActive} />
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
