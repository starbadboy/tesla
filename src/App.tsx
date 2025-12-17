
import { useRef, useState } from 'react';
import { DesignCanvas, type DesignCanvasHandle } from './components/DesignCanvas';
import { CAR_MODELS } from './constants';
import { Upload, Download, Trash2, Layers, RotateCw, Spline, Menu, Info, Globe } from 'lucide-react';
import { TRANSLATIONS } from './translations';

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
    <div className="flex h-screen w-screen bg-background text-white overflow-hidden font-sans">
      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-[#2b2b2b] flex items-center justify-center">
        <DesignCanvas
          ref={canvasRef}
          modelPath={currentModelPath}
          layers={activeLayers}
          onExport={() => { }}
        />


      </div>

      {/* Right Control Panel */}
      <div className="w-80 bg-control border-l border-gray-700 flex flex-col shadow-2xl z-10">

        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Spline size={20} className="text-primary" />
            {t.configurator}
          </h2>
          <button
            onClick={toggleLanguage}
            className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white"
            title="Switch Language"
          >
            <Globe size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Section 1: Model Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t.modelSelection}
            </label>
            <div className="relative">
              <select
                value={currentModelName}
                onChange={(e) => setCurrentModelName(e.target.value)}
                className="w-full bg-[#444] text-white border border-gray-600 rounded-md p-3 appearance-none focus:outline-none focus:border-primary transition"
              >
                {Object.keys(CAR_MODELS).map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                <Menu size={16} />
              </div>
            </div>
          </div>

          <hr className="border-gray-700" />

          {/* Section 2: Layers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} /> {t.textureLayers}
              </label>

              {/* Mode Toggle */}
              <div className="flex bg-black/30 rounded-lg p-1">
                <button
                  onClick={() => setUploadMode('single')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${uploadMode === 'single' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t.standard}
                </button>
                <button
                  onClick={() => setUploadMode('multi')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${uploadMode === 'multi' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t.pro}
                </button>
              </div>
            </div>

            {uploadMode === 'single' ? (
              // Single Mode UI
              <div className="grid grid-cols-1 gap-3">
                {singleLayer ? (
                  <div className="relative group">
                    <img src={singleLayer} className="w-full h-32 object-cover rounded-md border border-gray-600" />
                    <button
                      onClick={handleDeleteSingle}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-md"
                    >
                      <Trash2 size={24} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center justify-center gap-2 p-8 bg-primary hover:bg-primary-hover transition rounded-md font-medium text-sm border-2 border-transparent hover:border-white/20">
                    <Upload size={18} />
                    {t.importWrap}
                    <input type="file" className="hidden" accept="image/*" onChange={handleSingleUpload} />
                  </label>
                )}
              </div>
            ) : (
              // Multi Mode Grid UI
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(multiLayers).map(part => (
                  <div key={part} className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase font-bold">{part}</span>
                    {multiLayers[part] ? (
                      <div className="relative group">
                        <img src={multiLayers[part]!} className="w-full h-24 object-cover rounded-md border border-gray-600" />
                        <button
                          onClick={() => handleDeleteMulti(part)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition rounded-md"
                        >
                          <Trash2 size={20} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center h-24 bg-[#3a3a3a] hover:bg-[#444] border-2 border-dashed border-gray-600 hover:border-gray-500 transition rounded-md font-medium text-sm text-gray-500">
                        <Upload size={20} className="mb-1" />
                        <span className="text-xs">{t.upload}</span>
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
          </div>

          <hr className="border-gray-700" />

          {/* Section 3: Instructions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <RotateCw size={14} /> {t.controls}
            </label>
            <p className="text-sm text-gray-400 leading-relaxed">
              {t.controlSteps.map((step, i) => (
                <span key={i} className="block">• {step}</span>
              ))}
            </p>
          </div>

          <hr className="border-gray-700" />

          {/* Section 4: Installation */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Info size={14} /> {t.installation}
            </label>
            <ul className="text-xs text-gray-400 leading-relaxed space-y-2 pl-1">
              {t.installSteps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-gray-700 bg-[#252525]">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 p-4 bg-white text-black hover:bg-gray-200 font-bold rounded-md transition shadow-lg"
          >
            <Download size={20} />
            {t.export}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
