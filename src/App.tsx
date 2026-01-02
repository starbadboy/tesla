
import { useRef, useState, useEffect } from 'react';
import { DesignCanvas, type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';
import { CAR_MODELS, CAR_3D_MODELS } from './constants';
import { Upload, Download, Trash2, Layers, RotateCw, Globe, Menu, HelpCircle, Sparkles, Settings, Eye, Maximize, Lock, Unlock, PenTool, Eraser } from 'lucide-react';
import { TRANSLATIONS } from './translations';
import { Sidebar, SidebarSection } from './components/Layout/Sidebar';
import { Button } from './components/ui/Button';
import { Select } from './components/ui/Select';
import { generateImage } from './utils/gemini';

import { cn } from './utils/cn';
import { ThreeDView } from './components/ThreeDView';
import { Box, Plus } from 'lucide-react';
import { ShareModal } from './components/ShareModal';
import { Gallery } from './components/Gallery';
import { BuyMeCoffee } from './components/BuyMeCoffee';
import { AuthProvider } from './contexts/AuthContext';
import { UserMenu } from './components/Auth/UserMenu';

function App() {
  const [currentModelName, setCurrentModelName] = useState("Model 3 (2024 Base)");
  const [uploadMode, setUploadMode] = useState<'single' | 'multi'>('single');
  const [singleLayer, setSingleLayer] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language || navigator.languages?.[0];
      return browserLang?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }
    return 'en';
  });

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPuterLoaded, setIsPuterLoaded] = useState(false);
  const [aiProvider, setAiProvider] = useState<'puter' | 'openai' | 'gemini'>('puter');

  // ... (existing code)

  const handleGenerateImage = async () => {
    if (!aiPrompt) {
      alert("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      // Fetch current model image for img2img context
      const modelBase64 = await urlToBase64(currentModelPath);

      // Pass selected provider to generateImage
      const imageUrl = await generateImage(aiPrompt, modelBase64, currentModelName, aiProvider, "gpt-image-1.5");

      if (uploadMode === 'single') {
        setSingleLayer(imageUrl);
      } else {
        setUploadMode('single');
        setSingleLayer(imageUrl);
      }
    } catch (error) {
      alert(t.error + ": " + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ... (inside return statement/JSX)


  const [layerTransforms, setLayerTransforms] = useState<Record<string, LayerTransform>>({});
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [uniformScale, setUniformScale] = useState(true);

  // Drawing State
  const [interactionMode, setInteractionMode] = useState<'select' | 'draw'>('select');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  const [is3DView, setIs3DView] = useState(false);

  // Share State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImageBlob, setShareImageBlob] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'studio' | 'community' | 'garage'>('studio'); // 'studio' | 'community' | 'garage'
  const [isWrapVisible, setIsWrapVisible] = useState(true); // Control wrap visibility for 3D view
  const [galleryRefreshTrigger, setGalleryRefreshTrigger] = useState(0); // Increment to refresh gallery

  const t = TRANSLATIONS[language];

  useEffect(() => {
    // Check for Puter.js availability
    const checkPuter = () => {
      if (window.puter && window.puter.ai) {
        setIsPuterLoaded(true);
      }
    };

    checkPuter();
    const interval = setInterval(checkPuter, 500);
    return () => clearInterval(interval);

  }, []);

  // Reset wraps and state when switching models
  useEffect(() => {
    setSingleLayer(null);
    setMultiLayers({
      'Front': null,
      'Rear': null,
      'Left': null,
      'Right': null
    });
    setLayerTransforms({});
    setSelectedLayerId(null);
    setIsWrapVisible(false); // Reset to show base car paint
  }, [currentModelName]);

  const canvasRef = useRef<DesignCanvasHandle>(null);

  // Force 3D view when in community or garage mode
  useEffect(() => {
    if (sidebarMode === 'community' || sidebarMode === 'garage') {
      setIs3DView(true);
    }
  }, [sidebarMode]);

  // Layers state for multiple parts
  const [multiLayers, setMultiLayers] = useState<Record<string, string | null>>({
    'Front': null,
    'Rear': null,
    'Left': null,
    'Right': null
  });

  const currentModelPath = CAR_MODELS[currentModelName];
  const has3DModel = Boolean(CAR_3D_MODELS[currentModelName]);
  const effectiveIs3DView = is3DView && has3DModel;

  const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSingleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setSingleLayer(url);
      setLayerTransforms(prev => ({
        ...prev,
        'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }
      }));
      setSelectedLayerId('Full Wrap');
      setIsWrapVisible(true);
      e.target.value = '';
    }
  };

  const handleMultiUpload = (part: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);

      setMultiLayers(prev => ({
        ...prev,
        [part]: url
      }));
      setLayerTransforms(prev => ({
        ...prev,
        [part]: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }
      }));
      setSelectedLayerId(part);
      setIsWrapVisible(true);

      e.target.value = '';
    }
  };



  const handleExport = () => {
    canvasRef.current?.exportImage();
  };

  const handleOpenShareModal = async () => {
    if (canvasRef.current) {
      const blob = await canvasRef.current.getExportBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        setShareImageBlob(url);
        setIsShareModalOpen(true);
      } else {
        alert("Failed to capture wrap image. Please try again.");
      }
    }
  };

  const handleDeleteSingle = () => {
    setSingleLayer(null);
    setSelectedLayerId(null);
  };

  const handleDeleteMulti = (part: string) => {
    setMultiLayers(prev => ({
      ...prev,
      [part]: null
    }));
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const handleTransformChange = (id: string, newTransform: LayerTransform) => {
    setLayerTransforms(prev => ({
      ...prev,
      [id]: newTransform
    }));
  };

  const selectedTransform = selectedLayerId ? (layerTransforms[selectedLayerId] || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }) : null;

  const updateSelectedProperty = (changes: Partial<LayerTransform>) => {
    if (!selectedLayerId) return;
    setLayerTransforms(prev => {
      const current = prev[selectedLayerId] || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
      return {
        ...prev,
        [selectedLayerId]: { ...current, ...changes }
      };
    });
  };

  const handleClearDrawing = () => {
    canvasRef.current?.clearLines();
  };

  // Determine what to pass to canvas
  const activeLayers = uploadMode === 'single'
    ? (singleLayer ? { 'Full Wrap': singleLayer } : {})
    : multiLayers;

  return (
    <AuthProvider>
      <div className="flex flex-col md:flex-row min-h-screen md:h-screen w-full md:w-screen bg-background font-serif md:overflow-hidden">
        {/* Main Canvas Area */}
        {/* Framed by whitespace as per design spec "Dramatic Negative Space" */}
        <div className="flex-none h-[50vh] w-full md:h-full md:w-auto md:flex-1 relative flex items-center justify-center bg-gray-50 p-6 md:p-12 border-b-4 md:border-b-0 border-foreground">
          <BuyMeCoffee />
          <div className="w-full h-full border border-foreground relative bg-white overflow-hidden">
            <>
              <div className={cn("w-full h-full transition-opacity duration-300", effectiveIs3DView ? "absolute top-0 left-0 opacity-0 pointer-events-none z-0" : "relative z-10")}>
                <DesignCanvas
                  ref={canvasRef}
                  modelPath={currentModelPath}
                  layers={activeLayers}
                  transforms={layerTransforms}
                  onTransformChange={handleTransformChange}
                  selectedId={selectedLayerId}
                  onSelect={setSelectedLayerId}
                  onExport={() => { }}
                  mode={interactionMode}
                  brushColor={brushColor}
                  brushSize={brushSize}
                />
              </div>
              <div className={cn("w-full h-full absolute top-0 left-0 transition-opacity duration-300", effectiveIs3DView ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0")}>
                <ThreeDView
                  stageRef={canvasRef}
                  modelPath={CAR_3D_MODELS[currentModelName]}
                  isActive={effectiveIs3DView}
                  showTexture={isWrapVisible}
                  onToggleWrap={setIsWrapVisible}
                  language={language}
                />
              </div>
            </>
          </div>
        </div>

        {/* Right Control Panel (Sidebar) */}
        <Sidebar
          title="Design Studio"
          icon={
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg" alt="Tesla" className="h-4 w-auto invert dark:invert-0" />
          }
          actions={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={toggleLanguage} className="px-2" title="Switch Language">
                <Globe size={18} strokeWidth={1} />
              </Button>
              <UserMenu
                language={language}
                onOpenGarage={() => {
                  setSidebarMode('garage');
                  setIs3DView(true);
                }}
              />
            </div>
          }
        >
          {/* Mode Toggle at the Top */}
          <div className="flex border border-foreground divide-x divide-foreground mb-6">
            <button
              onClick={() => setSidebarMode('studio')}
              className={cn(
                "flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
                sidebarMode === 'studio' ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
              )}
            >
              {t.studio}
            </button>
            <button
              onClick={() => {
                setSidebarMode('community');
                setIs3DView(true); // Switch to 3D view immediately
              }}
              className={cn(
                "flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1",
                (sidebarMode === 'community' || sidebarMode === 'garage') ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
              )}
            >
              {sidebarMode === 'garage' ? 'Garage' : t.community} {(sidebarMode === 'community') && <span className="bg-blue-100 text-blue-600 text-[9px] px-1.5 rounded-full ml-1">{t.new}</span>}
            </button>
          </div>

          {(sidebarMode === 'community' || sidebarMode === 'garage') ? (
            <div className="flex flex-col h-full -mx-4 overflow-hidden">
              {/* Added Model Selection for Community Mode as requested */}
              <div className="px-4 mb-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">{t.modelSelection}</label>
                <Select
                  value={currentModelName}
                  onChange={(e) => setCurrentModelName(e.target.value)}
                >
                  {Object.keys(CAR_MODELS).map(model => (
                    <option key={model} value={model}>{(t as any)[model] || model}</option>
                  ))}
                </Select>
              </div>

              <div className="px-4 mb-4">
                <Button
                  onClick={handleOpenShareModal}
                  fullWidth
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                >
                  <Plus size={16} className="mr-1" /> {t.shareYourWrap}
                </Button>
              </div>

              <div className="flex-1 overflow-hidden">
                <Gallery
                  selectedModel={currentModelName}
                  refreshTrigger={galleryRefreshTrigger}
                  onLoadWrap={(url) => {
                    setSingleLayer(url);
                    setUploadMode('single'); // Switch to single mode
                    setIsWrapVisible(true); // Force wrap visibility when loading a new wrap
                    // Don't switch back to studio, let them browse
                  }}
                  language={language}
                  viewMode={sidebarMode === 'garage' ? 'garage' : 'all'}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Section 1: Model Selection */}
              <SidebarSection title={t.modelSelection} icon={<Menu />}>
                <div className="mb-4 flex border border-foreground divide-x divide-foreground">
                  <button
                    onClick={() => setIs3DView(false)}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2",
                      !is3DView ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
                    )}
                  >
                    {t.design}
                  </button>
                  <button
                    onClick={() => setIs3DView(true)}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2",
                      is3DView ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
                    )}
                  >
                    <Box size={14} /> {t.preview3d}
                  </button>
                </div>

                {/* Toggle removed as per request, default off for now */}

                <Select
                  value={currentModelName}
                  onChange={(e) => setCurrentModelName(e.target.value)}
                >
                  {Object.keys(CAR_MODELS).map(model => (
                    <option key={model} value={model}>{(t as any)[model] || model}</option>
                  ))}
                </Select>
              </SidebarSection>



              {/* Gallery / Community Section or integrated into Texture Layers */}
              <SidebarSection title="Wraps" icon={<Layers />}>
                {/* Existing Studio/Upload UI */}
                {/* Mode Toggle */}
                <div className="flex border border-foreground divide-x divide-foreground mb-4">
                  <button
                    onClick={() => setUploadMode('single')}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
                      uploadMode === 'single' ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
                    )}
                  >
                    {t.standard}
                  </button>
                  <button
                    onClick={() => setUploadMode('multi')}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
                      uploadMode === 'multi' ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
                    )}
                  >
                    {t.pro}
                  </button>
                </div>

                {uploadMode === 'single' ? (
                  // Single Mode UI
                  <div className="space-y-4">
                    {singleLayer ? (
                      <div className="relative group border border-foreground">
                        <img src={singleLayer} className="w-full h-32 object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
                        <button
                          onClick={handleDeleteSingle}
                          className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
                        >
                          <Trash2 size={24} strokeWidth={1} className="text-black" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center gap-2 p-12 border-2 border-dashed border-gray-300 hover:border-foreground transition-all duration-300 group">
                        <Upload size={24} strokeWidth={1} className="text-gray-400 group-hover:text-foreground transition-colors" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-foreground transition-colors">{t.importWrap}</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleSingleUpload} />
                      </label>
                    )}
                  </div>
                ) : (
                  // Multi Mode Grid UI
                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(multiLayers).map(part => (
                      <div key={part} className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{part}</span>
                        {multiLayers[part] ? (
                          <div className="relative group border border-foreground aspect-square">
                            <img src={multiLayers[part]!} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
                            <button
                              onClick={() => handleDeleteMulti(part)}
                              className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
                            >
                              <Trash2 size={20} strokeWidth={1} className="text-black" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 hover:border-foreground transition-all duration-300 group">
                            <Upload size={16} strokeWidth={1} className="mb-1 text-gray-400 group-hover:text-foreground" />
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleMultiUpload(part, e)}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SidebarSection>

              <SidebarSection title={t.drawing} icon={<PenTool />}>
                <div className="space-y-4">
                  {/* Mode Toggle */}
                  <div className="flex border border-foreground divide-x divide-foreground">
                    <button
                      onClick={() => setInteractionMode('select')}
                      className={cn(
                        "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
                        interactionMode === 'select' ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
                      )}
                    >
                      {t.selectMode}
                    </button>
                    <button
                      onClick={() => setInteractionMode('draw')}
                      className={cn(
                        "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
                        interactionMode === 'draw' ? "bg-foreground text-background" : "bg-transparent text-foreground hover:bg-gray-100"
                      )}
                    >
                      {t.drawMode}
                    </button>
                  </div>

                  {interactionMode === 'draw' && (
                    <>
                      {/* Brush Color */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
                          <span>{t.brushColor}</span>
                        </div>
                        <div className="flex gap-2">
                          {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'].map(color => (
                            <button
                              key={color}
                              onClick={() => setBrushColor(color)}
                              className={cn(
                                "w-6 h-6 rounded-full border border-gray-300",
                                brushColor === color ? "ring-2 ring-offset-2 ring-foreground" : ""
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            className="w-6 h-6 rounded-full overflow-hidden border-0 p-0"
                          />
                        </div>
                      </div>

                      {/* Brush Size */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
                          <span>{t.brushSize}</span>
                          <span>{brushSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-foreground"
                        />
                      </div>
                    </>
                  )}

                  <Button
                    onClick={handleClearDrawing}
                    variant="outline"
                    fullWidth
                    size="sm"
                  >
                    <Eraser size={16} className="mr-2" />
                    {t.clearDrawing}
                  </Button>
                </div>
              </SidebarSection>

              {/* Section: Properties */}
              {selectedLayerId && selectedTransform && (
                <SidebarSection title={t.properties} icon={<Settings />}>
                  <div className="space-y-6">
                    {/* Opacity */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
                        <span className="flex items-center gap-1"><Eye size={12} /> {t.opacity}</span>
                        <span>{Math.round(selectedTransform.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selectedTransform.opacity}
                        onChange={(e) => updateSelectedProperty({ opacity: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-foreground"
                      />
                    </div>

                    {/* Rotation */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
                        <span className="flex items-center gap-1"><RotateCw size={12} /> {t.rotation}</span>
                        <span>{Math.round(selectedTransform.rotation)}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={(selectedTransform.rotation % 360 + 360) % 360}
                        onChange={(e) => updateSelectedProperty({ rotation: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-foreground"
                      />
                    </div>

                    {/* Scale */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
                        <span className="flex items-center gap-1"><Maximize size={12} /> {t.scale}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setUniformScale(!uniformScale)}
                            className="p-1 hover:bg-gray-100 rounded text-foreground transition-colors"
                            title={t.uniformScale}
                          >
                            {uniformScale ? <Lock size={12} /> : <Unlock size={12} />}
                          </button>
                          <span>{Math.round(selectedTransform.scaleX * 100)}%</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.01"
                        value={selectedTransform.scaleX}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (uniformScale) {
                            updateSelectedProperty({ scaleX: val, scaleY: val });
                          } else {
                            updateSelectedProperty({ scaleX: val });
                          }
                        }}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-foreground"
                      />
                    </div>
                  </div>
                </SidebarSection>
              )}

              {/* Section: AI Generation */}
              <SidebarSection title={t.aiGeneration} icon={<Sparkles />}>
                <div className="space-y-3">
                  {/* Provider Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.modelProvider}</label>
                    <Select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as 'puter' | 'openai' | 'gemini')}
                    >
                      <option value="puter">{t.computerAI}</option>
                      <option value="openai">{t.openai}</option>
                      <option value="gemini">Gemini (Google)</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t.prompt}</label>
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full text-sm border-b border-gray-300 focus:border-black outline-none py-1 bg-transparent placeholder:text-gray-300 transition-colors"
                      placeholder={t.prompt}
                    />
                  </div>
                  <Button
                    onClick={handleGenerateImage}
                    disabled={isGenerating || !aiPrompt || (aiProvider === 'puter' && !isPuterLoaded)}
                    fullWidth
                    size="sm"
                  >
                    {isGenerating ? t.generating : (aiProvider === 'puter' && !isPuterLoaded ? t.connecting : t.generate)}
                  </Button>
                </div>
              </SidebarSection>

              {/* Section 3: Instructions */}
              <SidebarSection title={t.controls} icon={<RotateCw />}>
                <ul className="space-y-2">
                  {t.controlSteps.map((step, i) => (
                    <li key={i} className="text-sm font-serif text-gray-600 pl-4 border-l border-foreground/20">
                      {step}
                    </li>
                  ))}
                </ul>
              </SidebarSection>

              {/* Section 4: Installation */}
              <SidebarSection title={t.installation} icon={<HelpCircle />}>
                <ul className="space-y-2">
                  {t.installSteps.map((step, i) => (
                    <li key={i} className="text-sm font-serif text-gray-600 pl-4 border-l border-foreground/20">
                      {step}
                    </li>
                  ))}
                </ul>
              </SidebarSection>
            </>
          )}
          {/* Footer actions */}
          <div className="pt-6 mt-auto">
            <Button
              onClick={handleExport}
              fullWidth
              size="lg"
              className="group"
            >
              <Download size={20} strokeWidth={1.5} className="mr-2 group-hover:scale-110 transition-transform" />
              {t.export}
            </Button>
          </div>
        </Sidebar>

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onShareSuccess={() => setGalleryRefreshTrigger(prev => prev + 1)}
          imageUrl={shareImageBlob}
          language={language}
        />
      </div >
    </AuthProvider>
  )
}

export default App
