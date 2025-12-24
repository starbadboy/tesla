
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useState } from 'react';


import type { DesignCanvasHandle } from './DesignCanvas';
import { ErrorBoundary } from './ErrorBoundary';

interface ThreeDViewProps {
    stageRef: React.RefObject<DesignCanvasHandle | null>;
    modelPath: string;
    showTexture?: boolean;
    isActive?: boolean;
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
                    // Tesla Gallery Style Glass - MeshStandardMaterial with high metalness
                    const m = new THREE.MeshStandardMaterial({
                        color: 0x222222, // Dark charcoal/gray tint
                        transparent: true,
                        opacity: 0.5, // 50% transparency
                        roughness: 0.1, // Very smooth for sharp reflections
                        metalness: 0.9, // High metalness for reflectivity
                        envMapIntensity: 1.0,
                        side: THREE.FrontSide,
                        depthWrite: true,
                    });
                    mesh.material = m;
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
                        roughness: 0.2,
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
                        roughness: 0.2, // Smooth finish
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
                        roughness: 0.2,
                        metalness: 0.1,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.05,
                        envMapIntensity: 1.0,
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
                                
                                // Tesla Gallery Logic: "Transparency" for White areas (R>0.95, G>0.95, B>0.95)
                                // If the wrap pixel is white, we show the base material color (diffuseColor)
                                
                                float isWhite = step(0.95, wrapColor.r) * step(0.95, wrapColor.g) * step(0.95, wrapColor.b);
                                
                                // If isWhite is 1.0, we use diffuseColor (Base Paint). 
                                // If isWhite is 0.0, we use wrapColor.
                                
                                diffuseColor.rgb = mix(wrapColor.rgb, diffuseColor.rgb, isWhite);
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

export const ThreeDView = ({ stageRef, modelPath, showTexture = true, isActive = true, translations }: ThreeDViewProps) => {
    // Determine if we have a valid model path
    const hasModel = modelPath && modelPath.length > 0;

    // State for toggling wrap on/off
    const [isWrapApplied, setIsWrapApplied] = useState(showTexture);

    // Sync with parent's showTexture prop when it changes
    useEffect(() => {
        setIsWrapApplied(showTexture);
    }, [showTexture]);

    const toggleWrap = () => {
        setIsWrapApplied(prev => !prev);
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

                    {/* Environment map for reflections (not lighting) */}
                    <Environment preset="studio" background={false} />

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
                        <ErrorBoundary key={modelPath} fallback={<ErrorFallback />}>
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
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '14px 28px',
                            backgroundColor: isWrapApplied
                                ? 'rgba(239, 68, 68, 0.9)'
                                : 'rgba(34, 197, 94, 0.9)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '50px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: isWrapApplied
                                ? '0 8px 32px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)'
                                : '0 8px 32px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = isWrapApplied
                                ? '0 12px 40px rgba(239, 68, 68, 0.5), 0 6px 16px rgba(0, 0, 0, 0.25)'
                                : '0 12px 40px rgba(34, 197, 94, 0.5), 0 6px 16px rgba(0, 0, 0, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = isWrapApplied
                                ? '0 8px 32px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)'
                                : '0 8px 32px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)';
                        }}
                    >
                        {/* Icon */}
                        <span style={{ fontSize: '18px' }}>
                            {isWrapApplied ? '✕' : '✓'}
                        </span>
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
