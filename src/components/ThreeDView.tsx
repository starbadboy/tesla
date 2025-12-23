
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Environment, ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import type { DesignCanvasHandle } from './DesignCanvas';
import { ErrorBoundary } from './ErrorBoundary';

interface ThreeDViewProps {
    stageRef: React.RefObject<DesignCanvasHandle | null>;
    modelPath: string;
    showTexture?: boolean;
    isActive?: boolean;
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

                // Hide studio floor/environment if present
                if (name.includes('ground') || name.includes('plane') || name.includes('studio') || name.includes('backdrop')) {
                    mesh.visible = false;
                    return;
                }

                if (isGlass) {
                    // High quality physical glass
                    // High quality physical glass - Matching Reference Site
                    const m = new THREE.MeshPhysicalMaterial({
                        color: 0x111111, // Darker base for reflections
                        transparent: true,
                        opacity: 0.5,
                        roughness: 0.1,
                        metalness: 0.9, // High metalness for strong reflections
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.0,
                        envMapIntensity: 1.5,
                        side: THREE.DoubleSide,
                        depthWrite: false, // Helps with transparency sorting
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

                    // Create a realistic car paint material (PhysicalMaterial)
                    const newMat = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color(0xffffff),
                        metalness: 0.6,
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
                        color: 0xffffff, // White base paint
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

export const ThreeDView = ({ stageRef, modelPath, showTexture = true, isActive = true }: ThreeDViewProps) => {
    // Determine if we have a valid model path
    const hasModel = modelPath && modelPath.length > 0;

    return (
        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800">
            <ErrorBoundary fallback={
                <div className="flex items-center justify-center h-full text-white/50">
                    <p>3D View Unavailable</p>
                </div>
            }>
                <Canvas shadows camera={{ position: [4, 1.5, 4], fov: 45 }}>
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} />

                    {/* Realistic Environment Lighting - Studio/City feel */}
                    <Environment preset="city" />
                    <ambientLight intensity={0.7} />
                    <spotLight position={[10, 15, 10]} angle={0.25} penumbra={1} intensity={50} castShadow shadow-bias={-0.0001} />
                    <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" position={[0, -1, 0]} />

                    {hasModel ? (
                        <ErrorBoundary key={modelPath} fallback={<ErrorFallback />}>
                            {/* Removed Stage to use custom Environment and lighting control */}
                            <group position={[0, 0, 0]}>
                                <TexturedCar stageRef={stageRef} modelPath={modelPath} showTexture={showTexture} isActive={isActive} />
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
        </div>
    );
};
