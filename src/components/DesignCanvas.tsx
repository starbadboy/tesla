import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Rect } from 'react-konva';
import useImage from 'use-image';
import { processTemplateMask } from '../utils/imageProcessor';
import Konva from 'konva';

export interface DesignCanvasHandle {
    exportImage: () => void;
}

export interface LayerTransform {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
}

interface DesignCanvasProps {
    modelPath: string;
    layers: Record<string, string | null>;
    transforms: Record<string, LayerTransform>;
    onTransformChange: (id: string, newTransform: LayerTransform) => void;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onExport: (stage: Konva.Stage) => void;
}

const TextureImage = ({
    imgPath,
    isSelected,
    onSelect,
    onChange,
    transform
}: {
    imgPath: string;
    isSelected: boolean;
    onSelect: () => void;
    onChange: (t: LayerTransform) => void;
    transform: LayerTransform;
}) => {
    const [image] = useImage(imgPath);
    const shapeRef = useRef<Konva.Image>(null);
    const trRef = useRef<Konva.Transformer>(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    return (
        <>
            <KonvaImage
                onClick={onSelect}
                onTap={onSelect}
                ref={shapeRef}
                image={image}
                draggable
                x={transform.x}
                y={transform.y}
                rotation={transform.rotation}
                scaleX={transform.scaleX}
                scaleY={transform.scaleY}
                opacity={transform.opacity}
                onDragEnd={(e) => {
                    onChange({
                        ...transform,
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    const node = shapeRef.current;
                    if (!node) return;

                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    onChange({
                        ...transform,
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        scaleX: scaleX,
                        scaleY: scaleY
                    });
                }}
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    anchorSize={25}
                    rotateAnchorOffset={40}
                    padding={10}
                    boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                        }
                        return newBox;
                    }}
                />
            )}
        </>
    );
};

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(({
    modelPath,
    layers,
    transforms,
    onTransformChange,
    selectedId,
    onSelect
}, ref) => {
    const [processedOverlay, setProcessedOverlay] = useState<string | null>(null);
    const [overlayImage] = useImage(processedOverlay || '');

    // Internal ref to the Stage
    const stageRef = useRef<Konva.Stage>(null);

    // Scale state
    const [scale, setScale] = useState(1);
    const [dimensions, setDimensions] = useState({ width: 2048, height: 2048 }); // Default high-res

    useImperativeHandle(ref, () => ({
        exportImage: () => {
            const stage = stageRef.current;
            if (stage) {
                // Clear selection before exporting
                onSelect(null);

                // Allow state update to clear selection (next tick)
                setTimeout(() => {
                    const TARGET_SIZE = 1024;
                    const pixelRatio = TARGET_SIZE / (dimensions.width * scale);

                    const contentX = (stage.width() - dimensions.width * scale) / 2;
                    const contentY = (stage.height() - dimensions.height * scale) / 2;
                    const contentW = dimensions.width * scale;
                    const contentH = dimensions.height * scale;

                    const uri = stage.toDataURL({
                        x: contentX,
                        y: contentY,
                        width: contentW,
                        height: contentH,
                        pixelRatio: pixelRatio,
                        mimeType: 'image/png'
                    });

                    // Rotate the image 90 degrees clockwise
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.height;
                        canvas.height = img.width;

                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.translate(canvas.width, 0);
                            ctx.rotate(90 * Math.PI / 180);
                            ctx.drawImage(img, 0, 0);

                            const rotatedUri = canvas.toDataURL('image/png');

                            const link = document.createElement('a');
                            link.download = `design-tesla-1024.png`;
                            link.href = rotatedUri;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }
                    };
                    img.src = uri;
                }, 100);
            }
        }
    }));

    // Process the car mask whenever the model changes
    useEffect(() => {
        let isMounted = true;
        const loadAndProcess = async () => {
            try {
                const result = await processTemplateMask(modelPath);
                if (isMounted) setProcessedOverlay(result);
            } catch (e) {
                console.error("Failed to process mask", e);
            }
        }
        loadAndProcess();
        return () => { isMounted = false; };
    }, [modelPath]);

    // Update dimensions when overlay loads
    useEffect(() => {
        if (overlayImage) {
            setDimensions({
                width: overlayImage.width,
                height: overlayImage.height
            });
        }
    }, [overlayImage]);

    // Layout state
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle responsive scaling and sizing using ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setStageSize({ width, height });

                const scaleX = width / dimensions.width;
                const scaleY = height / dimensions.height;
                const fitScale = Math.min(scaleX, scaleY) * 0.9;

                setScale(fitScale);
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [dimensions]);

    const checkDeselect = (e: any) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            onSelect(null);
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-transparent overflow-hidden flex items-center justify-center">
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                scale={{ x: scale, y: scale }}
                x={(stageSize.width - dimensions.width * scale) / 2}
                y={(stageSize.height - dimensions.height * scale) / 2}
                onMouseDown={checkDeselect}
                onTouchStart={checkDeselect}
                ref={stageRef}
            >
                <Layer>
                    <Rect width={dimensions.width} height={dimensions.height} fill="#ffffff" />

                    {Object.entries(layers).map(([part, path]) => {
                        const transform = transforms[part] || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
                        return path && (
                            <TextureImage
                                key={part}
                                imgPath={path}
                                isSelected={selectedId === part}
                                onSelect={() => onSelect(part)}
                                onChange={(newTransform) => onTransformChange(part, newTransform)}
                                transform={transform}
                            />
                        );
                    })}
                </Layer>

                <Layer listening={false}>
                    {processedOverlay && (
                        <KonvaImage
                            image={overlayImage}
                            width={dimensions.width}
                            height={dimensions.height}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
});
