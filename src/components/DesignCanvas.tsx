import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Rect } from 'react-konva';
import useImage from 'use-image';
import { processTemplateMask } from '../utils/imageProcessor';
import Konva from 'konva';

export interface DesignCanvasHandle {
    exportImage: () => void;
}

interface DesignCanvasProps {
    modelPath: string;
    layers: Record<string, string | null>;
    onExport: (stage: Konva.Stage) => void;
}

const TextureImage = ({ imgPath, isSelected, onSelect, onChange }: any) => {
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
                x={100}
                y={100}
                onDragEnd={(e) => {
                    onChange({
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={() => {
                    // transformer is changing scale and rotation and abs pos,
                    // so we will reset scale to 100% and update width and height
                    const node = shapeRef.current;
                    if (!node) return;

                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // generally better to store scale, but for simplicity here just keeping node state
                    onChange({
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
                    boundBoxFunc={(oldBox, newBox) => {
                        // limit resize
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

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(({ modelPath, layers }, ref) => {
    const [processedOverlay, setProcessedOverlay] = useState<string | null>(null);
    const [overlayImage] = useImage(processedOverlay || '');
    const [selectedId, setSelectedId] = useState<string | null>(null);

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
                setSelectedId(null);

                // Allow state update to clear selection (next tick)
                setTimeout(() => {
                    const TARGET_SIZE = 1024;

                    // We need to crop only the content area.
                    // The Stage itself is window-sized (e.g. 1920x1080), but the content is centered.
                    // The content is positioned at x, y with size (dimensions.width * scale).
                    // BUT, simpler logic:
                    // We know the source content is dimensions.width (2048).
                    // We want output to be 1024.

                    // 1. Calculate pixelRatio needed to get from *current on-screen scale* to 1024.
                    // Current content size on screen = dimensions.width * scale.
                    // Desired size = 1024.
                    // Ratio = 1024 / (dimensions.width * scale).
                    const pixelRatio = TARGET_SIZE / (dimensions.width * scale);

                    // 2. Define the crop area. This is in the *STAGE'S* coordinate space (viewport space).
                    // We want to capture exactly where the content is.
                    // x, y calculation from render:
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

                // Calculate scale to fit "contain"
                // We want to fit the 2048x2048 (dimensions) into w x h
                const scaleX = width / dimensions.width;
                const scaleY = height / dimensions.height;
                const fitScale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin

                setScale(fitScale);
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [dimensions]);

    const checkDeselect = (e: any) => {
        // deselect when clicked on empty area (Stage or Background Rect)
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            setSelectedId(null);
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-transparent overflow-hidden flex items-center justify-center">
            {/* 
                We center the Stage using flexbox. 
                The Stage itself is sized to the window (viewport).
                However, we scale the CONTENT using stage.scale.
            */}
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                scale={{ x: scale, y: scale }}
                // Center the content within the stage
                x={(stageSize.width - dimensions.width * scale) / 2}
                y={(stageSize.height - dimensions.height * scale) / 2}
                onMouseDown={checkDeselect}
                onTouchStart={checkDeselect}
                ref={stageRef}
            >
                <Layer>
                    {/* Background Color Fill */}
                    <Rect width={dimensions.width} height={dimensions.height} fill="#ffffff" />

                    {/* Render all active layers */}
                    {Object.entries(layers).map(([part, path]) => (
                        path && (
                            <TextureImage
                                key={part}
                                imgPath={path}
                                isSelected={selectedId === part}
                                onSelect={() => setSelectedId(part)}
                                onChange={() => { }}
                            />
                        )
                    ))}
                </Layer>

                {/* Overlay Layer - Top */}
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
