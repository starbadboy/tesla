
import { useRef, useState } from 'react';
import { DesignCanvas, type DesignCanvasHandle } from './components/DesignCanvas';
import { CAR_MODELS } from './constants';
import { Upload, Download, Trash2, Layers, RotateCw, Globe, Menu, HelpCircle } from 'lucide-react';
import { TRANSLATIONS } from './translations';
import { Sidebar, SidebarSection } from './components/Layout/Sidebar';
import { Button } from './components/ui/Button';
import { Select } from './components/ui/Select';

import { cn } from './utils/cn';

function App() {
  const [currentModelName, setCurrentModelName] = useState(Object.keys(CAR_MODELS)[0]);
  const [uploadMode, setUploadMode] = useState<'single' | 'multi'>('single');
  const [singleLayer, setSingleLayer] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');

  const t = TRANSLATIONS[language];

  const canvasRef = useRef<DesignCanvasHandle>(null);

  // Layers state for multiple parts
  const [multiLayers, setMultiLayers] = useState<Record<string, string | null>>({
    'Front': null,
    'Rear': null,
    'Left': null,
    'Right': null
  });

  const currentModelPath = CAR_MODELS[currentModelName];

  const handleSingleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setSingleLayer(url);
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

      e.target.value = '';
    }
  };

  const handleExport = () => {
    canvasRef.current?.exportImage();
  };

  const handleDeleteSingle = () => {
    setSingleLayer(null);
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

  // Determine what to pass to canvas
  const activeLayers = uploadMode === 'single'
    ? (singleLayer ? { 'Full Wrap': singleLayer } : {})
    : multiLayers;

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen w-full md:w-screen bg-background font-serif md:overflow-hidden">
      {/* Main Canvas Area */}
      {/* Framed by whitespace as per design spec "Dramatic Negative Space" */}
      <div className="flex-none h-[50vh] w-full md:h-full md:w-auto md:flex-1 relative flex items-center justify-center bg-gray-50 p-6 md:p-12 border-b-4 md:border-b-0 border-foreground">
        <div className="w-full h-full border border-foreground relative bg-white">
          <DesignCanvas
            ref={canvasRef}
            modelPath={currentModelPath}
            layers={activeLayers}
            onExport={() => { }}
          />


        </div>
      </div>

      {/* Right Control Panel (Sidebar) */}
      <Sidebar
        title="Design Studio"
        icon={
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg" alt="Tesla" className="h-4 w-auto invert dark:invert-0" />
        }
        actions={
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="px-2" title="Switch Language">
            <Globe size={18} strokeWidth={1} />
          </Button>
        }
      >
        {/* Section 1: Model Selection */}
        <SidebarSection title={t.modelSelection} icon={<Menu />}>
          <Select
            value={currentModelName}
            onChange={(e) => setCurrentModelName(e.target.value)}
          >
            {Object.keys(CAR_MODELS).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </Select>
        </SidebarSection>

        {/* Section 2: Layers */}
        <SidebarSection title={t.textureLayers} icon={<Layers />}>
          {/* Mode Toggle */}
          <div className="flex border border-foreground divide-x divide-foreground">
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
    </div >
  )
}

export default App
