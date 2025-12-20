import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Rect, Line } from 'react-konva';
import useImage from 'use-image';
import { processTemplateMask } from '../utils/imageProcessor';
import Konva from 'konva';

export interface DesignCanvasHandle {
    exportImage: () => void;
    clearLines: () => void;
    getStage: () => Konva.Stage | null;
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
    mode: 'select' | 'draw';
    brushColor: string;
    brushSize: number;
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
    onSelect,
    mode,
    brushColor,
    brushSize
}, ref) => {
    const [processedOverlay, setProcessedOverlay] = useState<string | null>(null);
    const [overlayImage] = useImage(processedOverlay || '');

    // Drawing state
    const [lines, setLines] = useState<any[]>([]);
    const isDrawing = useRef(false);

    // Internal ref to the Stage
    const stageRef = useRef<Konva.Stage>(null);

    // Scale state
    const [scale, setScale] = useState(1);
    const [dimensions, setDimensions] = useState({ width: 2048, height: 2048 }); // Default high-res

    useImperativeHandle(ref, () => ({
        clearLines: () => {
            setLines([]);
        },
        getStage: () => stageRef.current,
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

                    const link = document.createElement('a');
                    link.download = `design-tesla-1024.png`;
                    link.href = uri;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
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

    const handleMouseDown = (e: any) => {
        if (mode === 'draw') {
            isDrawing.current = true;
            const pos = e.target.getStage().getPointerPosition();
            // Transform pointer position to local stage coordinates (accounting for scale/centering)
            // But wait, the Line is inside the Stage -> Layer. 
            // The Layer has no transform. The Stage has scale and offset.
            // We need to inverse form the stage transform.
            const stage = e.target.getStage();
            const transform = stage.getAbsoluteTransform().copy();
            transform.invert();
            const point = transform.point(pos);

            setLines([...lines, { tool: 'pen', points: [point.x, point.y], color: brushColor, size: brushSize }]);
        } else {
            // Check deselect
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) {
                onSelect(null);
            }
        }
    };

    const handleMouseMove = (e: any) => {
        if (mode === 'draw' && isDrawing.current) {
            const stage = e.target.getStage();
            const point = stage.getRelativePointerPosition();

            let lastLine = lines[lines.length - 1];
            // add point
            lastLine.points = lastLine.points.concat([point.x, point.y]);

            // replace last
            lines.splice(lines.length - 1, 1, lastLine);
            setLines(lines.concat());
        }
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-transparent overflow-hidden flex items-center justify-center">
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                scale={{ x: scale, y: scale }}
                x={(stageSize.width - dimensions.width * scale) / 2}
                y={(stageSize.height - dimensions.height * scale) / 2}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
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

                {/* Drawing Layer */}
                <Layer>
                    {lines.map((line, i) => (
                        <Line
                            key={i}
                            points={line.points}
                            stroke={line.color}
                            strokeWidth={line.size}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            globalCompositeOperation={
                                line.tool === 'eraser' ? 'destination-out' : 'source-over'
                            }
                        />
                    ))}
                </Layer>

                <Layer name="overlayLayer" listening={false}>
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
