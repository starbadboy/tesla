import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Tesla's configurator assets ship wheel-less: the car GLBs carry empty
 * `Wheel_LF_Spatial`-style anchors and the real wheels are attached at runtime. Without
 * them the car floats over four black holes.
 *
 * These wheels are built from the anchors themselves rather than guessed offsets — the
 * anchor's height above the ground plane is the wheel radius, and its position gives
 * wheelbase and track — so they land correctly on any model that ships the anchors.
 */

// Assets disagree on the rear-left: Poppyseed says Wheel_LR, Bayberry says Wheel_RL.
const ANCHOR_PATTERN = /^Wheel_[LR][LRF]_Spatial$/;

/** Tread width and rim diameter relative to the rolling radius (235/45 R18 proportions). */
const WIDTH_RATIO = 0.7;
const RIM_RATIO = 0.66;
const SPOKE_COUNT = 5;

// A wheel is small on screen, so it needs contrast more than detail: a black tyre
// band, a dark rim face, and light spokes that catch the studio lights.
const TYRE = { color: '#0d0d10', roughness: 0.95, metalness: 0.02 };
const SIDEWALL = { color: '#15151a', roughness: 0.9, metalness: 0.03 };
const RIM_FACE = { color: '#23262b', roughness: 0.45, metalness: 0.7 };
const SPOKE = { color: '#c3c8ce', roughness: 0.25, metalness: 0.95 };
const HUB = { color: '#15161a', roughness: 0.4, metalness: 0.6 };
const DISC = { color: '#3a3d42', roughness: 0.5, metalness: 0.8 };

export interface CarWheelsProps {
    /**
     * The loaded GLB scene. Wheels mount as its children, inheriting its transform.
     * Typed structurally: two copies of @types/three are installed and drei's Object3D
     * is not the same type as ours.
     */
    scene: object;
}

interface Placement {
    key: string;
    position: [number, number, number];
    radius: number;
    /** Axle direction in scene space, so the wheel is never oriented by guesswork. */
    quaternion: [number, number, number, number];
}

/** Marks the whole wheel so ThreeDView's paint and wrap passes skip it. */
const markProcedural = (group: THREE.Object3D) => {
    group.traverse(object => { object.userData.proceduralWheel = true; });
};

export function CarWheels({ scene }: CarWheelsProps) {
    const placements = useMemo<Placement[]>(() => {
        // One cast: two copies of @types/three are installed, so drei's Object3D and ours
        // are different types even though there is a single three module at runtime.
        const root = scene as THREE.Object3D;
        const anchors = new Map<string, THREE.Vector3>();
        root.traverse(child => {
            if (!ANCHOR_PATTERN.test(child.name)) return;
            child.updateWorldMatrix(true, false);
            const world = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
            anchors.set(child.name, root.worldToLocal(world.clone()));
        });
        if (anchors.size === 0) return [];

        // The axle runs from a left hub to its right counterpart. Reading it off the
        // anchors avoids assuming which axis the asset calls "across the car".
        const pair = [
            ['Wheel_LF_Spatial', 'Wheel_RF_Spatial'],
            ['Wheel_LR_Spatial', 'Wheel_RR_Spatial'],
            ['Wheel_RL_Spatial', 'Wheel_RR_Spatial'],
        ]
            .map(([left, right]) => [anchors.get(left), anchors.get(right)] as const)
            .find(([left, right]) => left && right);
        const axle = pair
            ? new THREE.Vector3().subVectors(pair[1]!, pair[0]!).normalize()
            : new THREE.Vector3(0, 0, 1);
        // Centre of the hubs along the axle, so each wheel knows which way is outward.
        const centre = new THREE.Vector3();
        for (const local of anchors.values()) centre.add(local);
        centre.divideScalar(anchors.size);

        const up = new THREE.Vector3(0, 1, 0);
        return [...anchors.entries()].map(([key, local]) => {
            // The face carries the spokes, so it has to point away from the car — one
            // shared axle direction pointed it inward on the near side.
            const outward = new THREE.Vector3().subVectors(local, centre).dot(axle) >= 0
                ? axle.clone()
                : axle.clone().negate();
            const rotation = new THREE.Quaternion().setFromUnitVectors(up, outward);
            return {
                key,
                position: [local.x, local.y, local.z] as [number, number, number],
                // The hub sits one radius above the ground the car rests on.
                radius: Math.abs(local.y),
                quaternion: [rotation.x, rotation.y, rotation.z, rotation.w] as [number, number, number, number],
            };
        });
    }, [scene]);

    if (placements.length === 0) return null;

    return (
        <>
            {placements.map(({ key, position, radius, quaternion }) => {
                const width = radius * WIDTH_RATIO;
                const rim = radius * RIM_RATIO;
                return (
                    // Cylinders stand on Y by default; the quaternion lays them on the axle.
                    <group key={key} position={position} quaternion={quaternion} onUpdate={markProcedural}>
                        <mesh castShadow>
                            <cylinderGeometry args={[radius, radius, width, 48, 1, true]} />
                            <meshStandardMaterial {...TYRE} />
                        </mesh>

                        <mesh position={[0, width / 2 - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[rim * 0.98, radius, 48]} />
                            <meshStandardMaterial {...SIDEWALL} side={THREE.DoubleSide} />
                        </mesh>
                        <mesh position={[0, -width / 2 + 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[rim * 0.98, radius, 48]} />
                            <meshStandardMaterial {...SIDEWALL} side={THREE.DoubleSide} />
                        </mesh>

                        <mesh>
                            <cylinderGeometry args={[rim, rim, width * 0.96, 40]} />
                            <meshStandardMaterial {...RIM_FACE} />
                        </mesh>

                        {/* Polished lip around the rim edge */}
                        <mesh position={[0, width * 0.485, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[rim * 0.88, rim, 40]} />
                            <meshStandardMaterial {...SPOKE} side={THREE.DoubleSide} />
                        </mesh>

                        {Array.from({ length: SPOKE_COUNT }, (_, i) => (
                            <mesh
                                key={i}
                                position={[0, width * 0.487, 0]}
                                rotation={[0, (i * Math.PI * 2) / SPOKE_COUNT, 0]}
                            >
                                <boxGeometry args={[rim * 0.2, 0.01, rim * 1.62]} />
                                <meshStandardMaterial {...SPOKE} />
                            </mesh>
                        ))}

                        <mesh position={[0, width * 0.5, 0]}>
                            <cylinderGeometry args={[rim * 0.34, rim * 0.34, 0.016, 24]} />
                            <meshStandardMaterial {...HUB} />
                        </mesh>

                        <mesh>
                            <cylinderGeometry args={[rim * 0.72, rim * 0.72, width * 0.3, 28]} />
                            <meshStandardMaterial {...DISC} />
                        </mesh>
                    </group>
                );
            })}
        </>
    );
}
