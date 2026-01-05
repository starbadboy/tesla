import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Rect, Line } from 'react-konva';
import useImage from 'use-image';
import { processTemplateMask, compressBlob } from '../utils/imageProcessor';
import Konva from 'konva';

export interface DesignCanvasHandle {
    exportImage: () => void;
    getExportBlob: () => Promise<Blob | null>;
    clearLines: () => void;
    getStage: () => Konva.Stage | null;
    getTextureCanvas: () => HTMLCanvasElement | null;
}

export interface LayerTransform {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
}

interface DrawnLine {
    tool: string;
    points: number[];
    color: string;
    size: number;
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
    transform,
    isInteractable = true
}: {
    imgPath: string;
    isSelected: boolean;
    onSelect: () => void;
    onChange: (t: LayerTransform) => void;
    transform: LayerTransform;
    isInteractable?: boolean;
}) => {
    const [image] = useImage(imgPath, 'anonymous');
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
                onClick={isInteractable ? onSelect : undefined}
                onTap={isInteractable ? onSelect : undefined}
                ref={shapeRef}
                image={image}
                draggable={isInteractable}
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
            {isSelected && isInteractable && (
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
    const [overlays, setOverlays] = useState<{ mask: string | null, lines: string | null }>({ mask: null, lines: null });
    const [maskImage] = useImage(overlays.mask || '', 'anonymous');
    const [linesImage] = useImage(overlays.lines || '', 'anonymous');

    // Drawing state
    const [lines, setLines] = useState<DrawnLine[]>([]);
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
        getTextureCanvas: () => {
            const stage = stageRef.current;
            if (!stage) return null;

            // 1. Hide Overlays and UI
            const maskNode = stage.findOne('.maskImage');
            const linesNode = stage.findOne('.linesImage');
            const transformers = stage.find('Transformer');

            if (maskNode) maskNode.hide();
            if (linesNode) linesNode.hide();
            transformers.forEach(t => t.hide());

            try {
                // Calculate crop based on dimensions and scale
                const contentX = (stage.width() - dimensions.width * scale) / 2;
                const contentY = (stage.height() - dimensions.height * scale) / 2;
                const contentW = dimensions.width * scale;
                const contentH = dimensions.height * scale;

                const pixelRatio = 1 / scale;

                const baseCanvas = stage.toCanvas({
                    x: contentX,
                    y: contentY,
                    width: contentW,
                    height: contentH,
                    pixelRatio: pixelRatio
                });

                // Restore visibility
                if (maskNode) maskNode.show();
                if (linesNode) linesNode.show();
                transformers.forEach(t => t.show());

                // 2. Apply mask to create transparency for areas outside the template
                if (overlays.mask) {
                    const resultCanvas = document.createElement('canvas');
                    resultCanvas.width = baseCanvas.width;
                    resultCanvas.height = baseCanvas.height;
                    const ctx = resultCanvas.getContext('2d');
                    if (!ctx) return baseCanvas;

                    // Draw the base design
                    ctx.drawImage(baseCanvas, 0, 0);

                    // Create a temporary canvas to load the mask
                    const maskImg = new Image();
                    maskImg.crossOrigin = "Anonymous";

                    // Check if mask is already loaded (from maskImage state)
                    if (maskImage) {
                        // Apply mask with destination-out to cut holes for exterior
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.drawImage(maskImage, 0, 0, resultCanvas.width, resultCanvas.height);
                        return resultCanvas;
                    }
                }

                return baseCanvas;
            } catch (e) {
                console.error("Error generating texture canvas:", e);
                // Restore visibility in case of error
                if (maskNode) maskNode.show();
                if (linesNode) linesNode.show();
                transformers.forEach(t => t.show());
                return null;
            }
        },
        exportImage: () => {
            const stage = stageRef.current;
            if (stage) {
                // Clear selection before exporting
                onSelect(null);

                // Allow state update to clear selection
                setTimeout(() => {
                    // 1. Hide Overlays (Mask & Lines) so we capture only the user's design
                    const maskNode = stage.findOne('.maskImage');
                    const linesNode = stage.findOne('.linesImage');
                    if (maskNode) maskNode.hide();
                    if (linesNode) linesNode.hide();

                    const TARGET_SIZE = 1024;
                    // Calculate crop based on dimensions and scale, same as before
                    const contentX = (stage.width() - dimensions.width * scale) / 2;
                    const contentY = (stage.height() - dimensions.height * scale) / 2;
                    const contentW = dimensions.width * scale;
                    const contentH = dimensions.height * scale;
                    // Scale to target size
                    const pixelRatio = TARGET_SIZE / contentW;

                    // Get Base Image (User Design + White Rect, NO Overlays)
                    const baseUri = stage.toDataURL({
                        x: contentX,
                        y: contentY,
                        width: contentW,
                        height: contentH,
                        pixelRatio: pixelRatio,
                        mimeType: 'image/png'
                    });

                    // Restore Overlays
                    if (maskNode) maskNode.show();
                    if (linesNode) linesNode.show();

                    // 2. Post-Process: Apply Mask to make exterior transparent
                    const img = new Image();
                    img.onload = () => {
                        const cvs = document.createElement('canvas');
                        cvs.width = img.width;
                        cvs.height = img.height;
                        const ctx = cvs.getContext('2d');
                        if (!ctx) return;

                        // Draw Base Design
                        ctx.drawImage(img, 0, 0);

                        const finalizeExport = (blob: Blob | null) => {
                            if (!blob) return;
                            compressBlob(blob, 1).then(compressedBlob => {
                                const url = URL.createObjectURL(compressedBlob);
                                const link = document.createElement('a');
                                link.download = `design-tesla-1024.png`;
                                link.href = url;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                            });
                        };

                        // Draw Mask with Destination-Out (Cut hole for exterior)
                        if (overlays.mask) {
                            const maskImg = new Image();
                            maskImg.crossOrigin = "Anonymous";
                            maskImg.onload = () => {
                                ctx.globalCompositeOperation = 'destination-out';
                                // Draw mask stretch to fit
                                ctx.drawImage(maskImg, 0, 0, cvs.width, cvs.height);

                                cvs.toBlob(finalizeExport, 'image/png');
                            };
                            maskImg.src = overlays.mask;
                        } else {
                            // Fallback if no mask
                            cvs.toBlob(finalizeExport, 'image/png');
                        }
                    };
                    img.src = baseUri;
                }, 100);
            }
        },
        getExportBlob: () => {
            return new Promise((resolve) => {
                const stage = stageRef.current;
                if (!stage) {
                    resolve(null);
                    return;
                }

                // Clear selection before exporting
                onSelect(null);

                // Allow state update to clear selection
                setTimeout(() => {
                    const maskNode = stage.findOne('.maskImage');
                    const linesNode = stage.findOne('.linesImage');
                    if (maskNode) maskNode.hide();
                    if (linesNode) linesNode.hide();

                    const TARGET_SIZE = 1024;
                    const contentX = (stage.width() - dimensions.width * scale) / 2;
                    const contentY = (stage.height() - dimensions.height * scale) / 2;
                    const contentW = dimensions.width * scale;
                    const contentH = dimensions.height * scale;
                    const pixelRatio = TARGET_SIZE / contentW;

                    const baseUri = stage.toDataURL({
                        x: contentX,
                        y: contentY,
                        width: contentW,
                        height: contentH,
                        pixelRatio: pixelRatio,
                        mimeType: 'image/png'
                    });

                    if (maskNode) maskNode.show();
                    if (linesNode) linesNode.show();

                    const img = new Image();
                    img.onload = () => {
                        const cvs = document.createElement('canvas');
                        cvs.width = img.width;
                        cvs.height = img.height;
                        const ctx = cvs.getContext('2d');
                        if (!ctx) {
                            resolve(null);
                            return;
                        }

                        ctx.drawImage(img, 0, 0);

                        const finalizeBlob = (blob: Blob | null) => {
                            if (!blob) {
                                resolve(null);
                                return;
                            }
                            compressBlob(blob, 1).then(resolve);
                        };

                        if (overlays.mask) {
                            const maskImg = new Image();
                            maskImg.crossOrigin = "Anonymous";
                            maskImg.onload = () => {
                                ctx.globalCompositeOperation = 'destination-out';
                                ctx.drawImage(maskImg, 0, 0, cvs.width, cvs.height);
                                cvs.toBlob(finalizeBlob, 'image/png');
                            };
                            maskImg.onerror = () => resolve(null);
                            maskImg.src = overlays.mask;
                        } else {
                            cvs.toBlob(finalizeBlob, 'image/png');
                        }
                    };
                    img.src = baseUri;
                }, 100);
            });
        }
    }));

    // Process the car mask whenever the model changes
    useEffect(() => {
        let isMounted = true;
        const loadAndProcess = async () => {
            try {

                const result = await processTemplateMask(modelPath);
                if (isMounted) setOverlays(result);
            } catch (e) {
                console.error("Failed to process mask", e);
            }
        }
        loadAndProcess();
        return () => { isMounted = false; };
    }, [modelPath]);

    // Update dimensions when overlay loads
    useEffect(() => {
        if (maskImage) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDimensions(prev => {
                if (prev.width === maskImage.width && prev.height === maskImage.height) return prev;
                return {
                    width: maskImage.width,
                    height: maskImage.height
                };
            });
        }
    }, [maskImage]);

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

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (mode === 'draw') {
            const stage = e.target.getStage();
            const pos = stage?.getPointerPosition();

            if (!stage || !pos) return;

            isDrawing.current = true;
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

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (mode === 'draw' && isDrawing.current) {
            const stage = e.target.getStage();
            if (!stage) return;

            const point = stage.getRelativePointerPosition();
            if (!point) return;

            const newLines = [...lines];
            const lastLine = { ...newLines[newLines.length - 1] };

            // add point
            lastLine.points = lastLine.points.concat([point.x, point.y]);

            // replace last
            newLines[newLines.length - 1] = lastLine;
            setLines(newLines);
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
                                isInteractable={mode === 'select'}
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
                    {overlays.mask && maskImage && (
                        <KonvaImage
                            name="maskImage"
                            image={maskImage}
                            width={dimensions.width}
                            height={dimensions.height}
                        />
                    )}
                    {overlays.lines && linesImage && (
                        <KonvaImage
                            name="linesImage"
                            image={linesImage}
                            width={dimensions.width}
                            height={dimensions.height}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
});
