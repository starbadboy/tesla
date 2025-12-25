
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useState } from 'react';


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
}

// Simplified Car that applies texture to specific material
const TexturedCar = ({ stageRef, modelPath, showTexture = true, isActive = true }: { stageRef: React.RefObject<DesignCanvasHandle | null>, modelPath: string, showTexture?: boolean, isActive?: boolean }) => {
    const { scene } = useGLTF(modelPath);

    // Create the texture instance once and keep it consistent
    const texture = useMemo(() => {
        const t = new THREE.CanvasTexture(document.createElement('canvas'));
        t.flipY = false;
        return t;
    }, []);

    const [textureActive, setTextureActive] = useState(showTexture);

    useEffect(() => {
        setTextureActive(showTexture);
    }, [showTexture]);

    const updateTexture = () => {
        if (stageRef.current && textureActive) {
            try {
                const newCanvas = stageRef.current.getTextureCanvas();
                if (newCanvas && newCanvas.width > 0 && newCanvas.height > 0) {
                    // eslint-disable-next-line react-hooks/immutability
                    texture.image = newCanvas;
                    texture.needsUpdate = true;
                }
            } catch (e) {
                // console.error("Failed to update texture", e);
            }
        }
    };

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
    }, [isActive, textureActive, stageRef, texture]);


    // Setup initial material properties for realism (this useEffect remains for base material setup)
    useEffect(() => {
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;

                // Identify parts to paint vs parts to keep as is (glass, lights, wheels)
                const name = mesh.name.toLowerCase();
                // DEBUG: Log mesh names to find glass
                // DEBUG: Log mesh names and material names to find glass
                if (!(window as any)['logged_meshes_' + name]) {
                    // const matName = (mesh.material as THREE.Material)?.name || 'unknown';
                    // console.log('Found mesh:', name, 'Material:', matName);
                    (window as any)['logged_meshes_' + name] = true;
                }
                const isGlass = name.includes('glass') || name.includes('window') || name.includes('windshield');
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

                if (isGlass) {
                    // DEBUG: Log all glass mesh names to identify patterns
                    console.log('🪟 GLASS MESH FOUND:', name);

                    // Determine if this is a FRONT window (windshield/front side) vs OTHER windows
                    // Front windows: transparent. Other windows (rear, roof): dark/opaque

                    // === FRONT GLASS PATTERNS (should be TRANSPARENT) ===
                    // Common naming conventions across Tesla models (Model S, 3, X, Y, Cybertruck)
                    const isFrontWindshield =
                        name.includes('windshield') ||
                        name.includes('windscreen') ||
                        name.includes('voorruit') ||           // Dutch for windshield
                        name.includes('frontglass') ||
                        name.includes('front_glass') ||
                        name.includes('glass_front') ||
                        (name.includes('glass') && name.includes('front') && !name.includes('rear'));

                    // Front side windows (driver/passenger door windows)
                    const isFrontSideWindow =
                        (name.includes('window') && name.includes('front')) ||
                        (name.includes('glass') && name.includes('door') && name.includes('front')) ||
                        name.includes('door_f_glass') ||
                        name.includes('door_front_glass') ||
                        name.includes('front_door_glass') ||
                        name.includes('a_pillar_glass') ||
                        name.includes('front_side_glass') ||
                        name.includes('front_side_window') ||
                        // Pattern: glass_fl (front left), glass_fr (front right)
                        (name.includes('glass') && (name.includes('_fl') || name.includes('_fr') || name.includes('fl_') || name.includes('fr_')));

                    const isFrontWindow = isFrontWindshield || isFrontSideWindow;

                    // === REAR/ROOF GLASS PATTERNS (should be DARK/OPAQUE) ===
                    const isRearOrRoofGlass =
                        name.includes('rear') ||
                        name.includes('back') ||
                        name.includes('roof') ||
                        name.includes('top') ||
                        name.includes('quarter') ||
                        name.includes('c_pillar') ||
                        name.includes('b_pillar') ||
                        name.includes('achter') ||             // Dutch for rear
                        name.includes('panoram') ||            // Panoramic roof
                        name.includes('sunroof') ||
                        name.includes('skylight') ||
                        // Pattern: glass_rl (rear left), glass_rr (rear right)
                        (name.includes('glass') && (name.includes('_rl') || name.includes('_rr') || name.includes('rl_') || name.includes('rr_')));

                    // Log classification for debugging
                    if (isFrontWindow && !isRearOrRoofGlass) {
                        console.log('  → Classified as FRONT (transparent):', name);
                    } else {
                        console.log('  → Classified as REAR/ROOF (dark):', name);
                    }

                    if (isFrontWindow && !isRearOrRoofGlass) {
                        // Front windshield and front side windows - TRANSPARENT glass
                        const m = new THREE.MeshPhysicalMaterial({
                            color: 0x88ccff,             // Slight blue tint like real automotive glass
                            transparent: true,
                            opacity: 0.25,               // Very transparent for front
                            roughness: 0.0,              // Perfectly smooth
                            metalness: 0.0,
                            transmission: 0.85,          // High light transmission
                            thickness: 0.5,
                            envMapIntensity: 1.5,
                            clearcoat: 1.0,
                            clearcoatRoughness: 0.0,
                            ior: 1.5,                    // Glass refraction index
                            side: THREE.DoubleSide,
                            depthWrite: false,           // Better transparency blending
                        });
                        mesh.material = m;
                        mesh.renderOrder = 1;            // Render after opaque objects
                    } else {
                        // Rear windows, roof glass, other glass - DARK/OPAQUE (privacy glass)
                        const m = new THREE.MeshPhysicalMaterial({
                            color: 0x0a0a0a,             // Very dark, almost black
                            transparent: true,
                            opacity: 0.92,               // Almost fully opaque
                            roughness: 0.05,
                            metalness: 0.1,
                            transmission: 0.05,          // Very low light transmission
                            thickness: 1.0,
                            envMapIntensity: 0.6,
                            clearcoat: 0.8,
                            clearcoatRoughness: 0.1,
                            side: THREE.FrontSide,
                            depthWrite: true,
                        });
                        mesh.material = m;
                    }
                    mesh.castShadow = true;
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
                } else if (!isInterior && !isTrim) {
                    // This is likely the body paint
                    const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

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
    }, [scene]);

    // Apply texture to meshes
    useEffect(() => {
        console.log("Applying texture to meshes with smart detection...", { textureActive });
        const wrappedParts: string[] = [];

        // Check if texture is actually valid
        const isTextureValid = textureActive && texture;

        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const name = mesh.name.toLowerCase();

                // Smart detection logic...
                const isGlass = name.includes('glass') || name.includes('window') || name.includes('windshield');
                const isLight = name.includes('light') || name.includes('lamp') || name.includes('led');
                const isWheel = name.includes('wheel') || name.includes('tire') || name.includes('rim') || name.includes('kolo') || name.includes('caliper') || name.includes('brake');
                const isInterior = name.includes('interior') || name.includes('seat') || name.includes('steering') || name.includes('screen') || name.includes('floor') || name.includes('dashboard');
                const isTrim = name.includes('trim') || name.includes('chrome') || name.includes('badge') || name.includes('logo') || name.includes('lettering') || name.includes('license') || name.includes('plate') || name.includes('grille');
                const isMisc = name.includes('camera') || name.includes('sensor') || name.includes('wiper') || name.includes('mirror_glass');

                const shouldWrap = !isGlass && !isLight && !isWheel && !isInterior && !isTrim && !isMisc;

                if (shouldWrap) {
                    wrappedParts.push(name);

                    // Normalize attributes: Tesla models seem to load as 'uv1' for the wrap layer, but Three.js likes 'uv2'
                    if (mesh.geometry.attributes.uv1 && !mesh.geometry.attributes.uv2) {
                        mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv1);
                    }

                    const newMat = new THREE.MeshPhysicalMaterial({
                        color: 0x000000, // Black base paint (for areas where wrap is white/transparent)
                        roughness: 0.4,
                        metalness: 0.0,
                        clearcoat: 0.3,
                        clearcoatRoughness: 0.1,
                    });

                    // If Wrap is Active, we inject custom shader logic to map it using UVset 2 (or 1)
                    if (isTextureValid) {
                        // Ensure we use the texture
                        // We use onBeforeCompile to inject the logic
                        newMat.onBeforeCompile = (shader) => {
                            shader.uniforms.uTex = { value: texture };

                            // Inject vertex shader logic to pass the second UV set
                            // Found 'uv1' in geometry attributes, so we use that.
                            shader.vertexShader = `
                                varying vec2 vWrapUv;
                                attribute vec2 uv2; 
                            ` + shader.vertexShader;

                            shader.vertexShader = shader.vertexShader.replace(
                                '#include <uv_vertex>',
                                `#include <uv_vertex>
                                 // Use uv2
                                 vWrapUv = uv2;
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
                    mesh.material.needsUpdate = true;
                }
            }
        });
        // console.log("Wrapped parts:", wrappedParts);
    }, [scene, textureActive, texture]);

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

const ErrorFallback = ({ error }: { error?: Error }) => (
    <Html center>
        <div className="bg-black/80 text-white p-4 rounded text-center min-w-[200px]">
            <p className="font-bold text-red-400 mb-2">Model Error</p>
            <p className="text-sm">{error?.message || "Failed to load 3D model"}</p>
        </div>
    </Html>
);

export const ThreeDView = ({ stageRef, modelPath, showTexture = true, isActive = true, onToggleWrap, translations }: ThreeDViewProps) => {
    // Determine if we have a valid model path
    const hasModel = modelPath && modelPath.length > 0;

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
        <div className="w-full h-full relative" style={{ background: 'linear-gradient(to bottom, #e8e8e8, #d0d0d0)' }}>
            <ErrorBoundary fallback={
                <div className="flex items-center justify-center h-full text-white/50">
                    <p>3D View Unavailable</p>
                </div>
            }>
                <Canvas
                    shadows
                    camera={{ position: [-5, 2, -9], fov: 45, near: 0.01, far: 2000 }}
                    scene={{ background: new THREE.Color('#e0e0e0') }}
                    gl={{
                        toneMapping: THREE.ACESFilmicToneMapping,
                        toneMappingExposure: 1.0,
                        outputColorSpace: THREE.SRGBColorSpace,
                    }}
                >
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
                    />



                    {/* Tesla Gallery Studio Lighting - 5 Light Setup */}
                    {/* Ambient: Base illumination */}
                    <ambientLight intensity={0.5} color="#ffffff" />

                    {/* Key Light: Main light from front-right-top */}
                    <directionalLight
                        position={[5, 8, 5]}
                        intensity={1.0}
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
                        intensity={0.4}
                        color="#ffffff"
                    />

                    {/* Rim Light: Highlights on rear */}
                    <directionalLight
                        position={[0, 2, -8]}
                        intensity={0.5}
                        color="#ffffff"
                    />

                    {/* Bottom Light: Subtle upward bounce light */}
                    <directionalLight
                        position={[0, -3, 0]}
                        intensity={0.2}
                        color="#ffffff"
                    />

                    {/* Ground shadow plane */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
                        <planeGeometry args={[50, 50]} />
                        <shadowMaterial transparent opacity={0.3} />
                    </mesh>

                    {hasModel ? (
                        <ErrorBoundary key={`${modelPath}-${isWrapApplied}`} fallback={<ErrorFallback />}>
                            {/* Removed Stage to use custom Environment and lighting control */}
                            <group position={[0, 0, 0]}>
                                <TexturedCar stageRef={stageRef} modelPath={modelPath} showTexture={isWrapApplied} isActive={isActive} />
                            </group>
                        </ErrorBoundary>
                    ) : (
                        <Html center>
                            <div className="bg-black/80 text-white p-4 rounded text-center">
                                <p className="font-bold">No 3D Model</p>
                                <p className="text-xs text-gray-400">Select a different vehicle</p>
                            </div>
                        </Html>
                    )}
                </Canvas>
            </ErrorBoundary>

            {/* Apply/Remove Wrap Button */}
            {hasModel && (
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
                                ? (translations?.removeWrap || 'Remove Wrap')
                                : (translations?.applyWrap || 'Apply Wrap')}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};
