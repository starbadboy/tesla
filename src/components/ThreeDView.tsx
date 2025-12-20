
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stage, Html } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Konva from 'konva';
import type { DesignCanvasHandle } from './DesignCanvas';
import { ErrorBoundary } from './ErrorBoundary';

interface ThreeDViewProps {
    stageRef: React.RefObject<DesignCanvasHandle | null>;
    modelPath: string;
    showTexture?: boolean;
}

// Simplified Car that applies texture to specific material
const TexturedCar = ({ stageRef, modelPath, showTexture = true }: { stageRef: React.RefObject<DesignCanvasHandle | null>, modelPath: string, showTexture?: boolean }) => {
    const { scene } = useGLTF(modelPath);
    const textureRef = useRef<THREE.CanvasTexture>(null);
    const [canvasTex] = useState<HTMLCanvasElement>(document.createElement('canvas'));

    useFrame((state) => {
        // Throttling: Update every 3 frames (~20fps)
        if (state.clock.getElapsedTime() % 0.05 < 0.016 && stageRef.current && showTexture) {
            const stage = stageRef.current.getStage();
            if (!stage) return;

            // Safety check for dimensions
            if (stage.width() <= 0 || stage.height() <= 0) return;

            const overlayLayer = stage.findOne('.overlayLayer') as Konva.Layer;
            if (overlayLayer) overlayLayer.hide();

            try {
                const newCanvas = stage.toCanvas({ pixelRatio: 1 });
                // Check if newCanvas has valid dimensions
                if (newCanvas.width === 0 || newCanvas.height === 0) {
                    if (overlayLayer) overlayLayer.show();
                    return;
                }

                if (textureRef.current) {
                    textureRef.current.image = newCanvas;
                    textureRef.current.needsUpdate = true;
                }
            } catch (e) {
                console.error("Failed to update texture", e);
            }

            if (overlayLayer) overlayLayer.show();
        }
    });

    // Apply texture to meshes
    useEffect(() => {
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;

                if (mesh.name === 'kolo' || mesh.name.includes('wheel')) {
                    // ignore tires
                } else {
                    // Apply to body
                    if (mesh.material) {
                        const m = mesh.material as THREE.MeshStandardMaterial;
                        if (showTexture) {
                            m.map = textureRef.current;
                            m.color.setHex(0xffffff); // Force white base color
                        } else {
                            m.map = null;
                            m.color.setHex(0xaaaaaa); // Basic grey when no texture
                        }
                        m.metalness = 0.1;
                        m.roughness = 0.5;
                        m.needsUpdate = true;
                    }
                }
            }
        });
    }, [scene, showTexture]);

    return (
        <group>
            {/* Hidden canvas texture that we update imperatively */}
            <mesh position={[0, 100, 0]}>
                <meshBasicMaterial>
                    <canvasTexture ref={textureRef} attach="map" image={canvasTex} />
                </meshBasicMaterial>
            </mesh>

            <primitive object={scene} scale={[50, 50, 50]} position={[0, -1, 0]} rotation={[0, Math.PI, 0]} />
        </group>
    );
}

const ErrorFallback = ({ error }: { error?: Error }) => (
    <Html center>
        <div className="bg-black/80 text-white p-4 rounded text-center min-w-[200px]">
            <p className="font-bold text-red-400 mb-2">Model Error</p>
            <p className="text-sm">{error?.message || "Failed to load 3D model"}</p>
        </div>
    </Html>
);

export const ThreeDView = ({ stageRef, modelPath, showTexture = true }: ThreeDViewProps) => {
    // Determine if we have a valid model path
    const hasModel = modelPath && modelPath.length > 0;

    return (
        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800">
            <ErrorBoundary fallback={
                <div className="flex items-center justify-center h-full text-white/50">
                    <p>3D View Unavailable</p>
                </div>
            }>
                <Canvas shadows camera={{ position: [5, 2, 5], fov: 50 }}>
                    <OrbitControls makeDefault />

                    {hasModel ? (
                        <Stage environment="city" intensity={0.6}>
                            <ErrorBoundary key={modelPath} fallback={<ErrorFallback />}>
                                <TexturedCar stageRef={stageRef} modelPath={modelPath} showTexture={showTexture} />
                            </ErrorBoundary>
                        </Stage>
                    ) : (
                        <Html center>
                            <div className="bg-black/80 text-white p-4 rounded text-center">
                                <p className="font-bold">No 3D Model</p>
                                <p className="text-xs text-gray-400">Select a different vehicle</p>
                            </div>
                        </Html>
                    )}

                    <gridHelper args={[20, 20, 0x444444, 0x222222]} />
                </Canvas>
            </ErrorBoundary>
        </div>
    );
};
