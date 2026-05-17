import { useEffect, useRef, useState } from 'react';
import { type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';
import { CAR_MODELS } from './constants';
import { TRANSLATIONS } from './translations';
import { generateImage } from './utils/gemini';

import { ShareModal } from './components/ShareModal';
import { Gallery } from './components/Gallery';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SEO_COPY, SITE_IMAGE, SITE_URL } from './seo';

import { TeslaStudio } from './components/TeslaStudio/TeslaStudio';
import { IconClose } from './components/TeslaStudio/icons';

function App() {
  const [currentModelName, setCurrentModelName] = useState('Model 3 (2024 Base)');
  const [appMode, setAppMode] = useState<'car' | 'plate' | 'sound'>('car');

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
  const [aiError, setAiError] = useState<string | null>(null);

  // Layer State
  const [layerTransforms, setLayerTransforms] = useState<Record<string, LayerTransform>>({});
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Share/Gallery
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImageBlob, setShareImageBlob] = useState<string | null>(null);
  const [isWrapVisible, setIsWrapVisible] = useState(true);
  const [galleryRefreshTrigger, setGalleryRefreshTrigger] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const canvasRef = useRef<DesignCanvasHandle>(null);

  const seo = SEO_COPY[language];

  // Puter availability
  useEffect(() => {
    const checkPuter = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as unknown as { puter?: { ai?: unknown } };
      if (w.puter && w.puter.ai) setIsPuterLoaded(true);
    };
    checkPuter();
    const interval = window.setInterval(checkPuter, 500);
    return () => window.clearInterval(interval);
  }, []);

  // SEO metadata
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = seo.title;

    const upsertMeta = (
      selector: string,
      attribute: 'content' | 'href',
      value: string,
      create: () => HTMLElement,
    ) => {
      let element = document.head.querySelector<HTMLElement>(selector);
      if (!element) {
        element = create();
        document.head.appendChild(element);
      }
      element.setAttribute(attribute, value);
    };

    upsertMeta('meta[name="description"]', 'content', seo.description, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      return meta;
    });
    upsertMeta('meta[property="og:title"]', 'content', seo.title, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      return meta;
    });
    upsertMeta('meta[property="og:description"]', 'content', seo.description, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      return meta;
    });
    upsertMeta('meta[name="twitter:title"]', 'content', seo.title, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:title');
      return meta;
    });
    upsertMeta('meta[name="twitter:description"]', 'content', seo.description, () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:description');
      return meta;
    });
    upsertMeta('link[rel="canonical"]', 'href', SITE_URL, () => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      return link;
    });

    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: seo.faq.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    };
    const scriptId = 'faq-json-ld';
    let faqScript = document.getElementById(scriptId);
    if (!faqScript) {
      faqScript = document.createElement('script');
      faqScript.id = scriptId;
      faqScript.setAttribute('type', 'application/ld+json');
      document.head.appendChild(faqScript);
    }
    faqScript.textContent = JSON.stringify(faqJsonLd);
  }, [language, seo]);

  // Reset wraps when switching models or app mode
  useEffect(() => {
    setSingleLayer(null);
    setLayerTransforms({});
    setSelectedLayerId(null);
    setIsWrapVisible(false);
  }, [currentModelName, appMode]);

  const currentModelPath = CAR_MODELS[currentModelName];

  const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGenerateImage = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    setAiError(null);
    try {
      const modelBase64 = await urlToBase64(currentModelPath);
      const imageUrl = await generateImage(
        aiPrompt,
        modelBase64,
        currentModelName,
        aiProvider,
        'gpt-image-1.5',
      );
      setSingleLayer(imageUrl);
      setLayerTransforms(prev => ({
        ...prev,
        'Full Wrap': prev['Full Wrap'] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      }));
      setSelectedLayerId('Full Wrap');
      setIsWrapVisible(true);
    } catch (error) {
      console.error(error);
      setAiError((error as Error).message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    canvasRef.current?.exportImage();
  };

  const handleOpenShareModal = async () => {
    if (appMode === 'sound') {
      setShareImageBlob(null);
      setIsShareModalOpen(true);
      return;
    }
    if (canvasRef.current) {
      const blob = await canvasRef.current.getExportBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        setShareImageBlob(url);
        setIsShareModalOpen(true);
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'zh' : 'en'));
  };

  const handleLoadCommunityWrap = async (url: string) => {
    setIsWrapVisible(true);
    if (url.includes('.r2.dev/')) {
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSingleLayer(blobUrl);
        setLayerTransforms(prev => ({
          ...prev,
          'Full Wrap': prev['Full Wrap'] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        }));
        setSelectedLayerId('Full Wrap');
        return;
      } catch (e) {
        console.error('Failed to proxy image, falling back to direct URL', e);
      }
    }
    setSingleLayer(url);
    setLayerTransforms(prev => ({
      ...prev,
      'Full Wrap': prev['Full Wrap'] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    }));
    setSelectedLayerId('Full Wrap');
  };

  const t = TRANSLATIONS[language];

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        {/* SEO-only content; hidden from sighted users */}
        <section className="sr-only" aria-labelledby="seo-heading">
          <h1 id="seo-heading">{seo.heading}</h1>
          <p>{seo.intro}</p>
          <h2>Features</h2>
          <ul>
            {seo.features.map(feature => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <h2>Supported Tesla design tools</h2>
          <p>
            Tesla Wrap Studio supports Tesla wrap design, 3D wrap preview, AI wrap pattern generation,
            community wrap sharing, custom license plate artwork, and custom Tesla lock sound sharing.
          </p>
          <img src={SITE_IMAGE} alt="Tesla Wrap Studio 3D wrap preview" />
          <h2>Frequently asked questions</h2>
          {seo.faq.map(item => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </section>

        <TeslaStudio
          language={language}
          onToggleLanguage={toggleLanguage}
          appMode={appMode}
          onAppMode={setAppMode}
          currentModelName={currentModelName}
          onModelChange={setCurrentModelName}
          singleLayer={singleLayer}
          onSingleLayerChange={setSingleLayer}
          selectedLayerId={selectedLayerId}
          onSelectedLayerIdChange={setSelectedLayerId}
          layerTransforms={layerTransforms}
          onLayerTransformsChange={setLayerTransforms}
          isWrapVisible={isWrapVisible}
          onIsWrapVisibleChange={setIsWrapVisible}
          aiPrompt={aiPrompt}
          onAiPromptChange={setAiPrompt}
          aiProvider={aiProvider}
          onAiProviderChange={setAiProvider}
          isGenerating={isGenerating}
          isPuterLoaded={isPuterLoaded}
          aiError={aiError}
          onGenerate={handleGenerateImage}
          canvasRef={canvasRef}
          onShare={handleOpenShareModal}
          onExport={handleExport}
          onOpenGallery={() => setIsGalleryOpen(true)}
          onLoadCommunityWrap={handleLoadCommunityWrap}
          communityRefreshTrigger={galleryRefreshTrigger}
        />

        {isGalleryOpen && (
          <div className="tsl-modal-backdrop" role="dialog" aria-modal="true">
            <div className="tsl-modal-card">
              <div className="tsl-modal-head">
                <span>{t.community.toUpperCase()} · {currentModelName}</span>
                <button
                  type="button"
                  className="tsl-icon-btn"
                  onClick={() => setIsGalleryOpen(false)}
                  aria-label="Close gallery"
                >
                  <IconClose size={16} />
                </button>
              </div>
              <div className="tsl-modal-body">
                <Gallery
                  selectedModel={currentModelName}
                  refreshTrigger={galleryRefreshTrigger}
                  onLoadWrap={async (url) => {
                    await handleLoadCommunityWrap(url);
                    setIsGalleryOpen(false);
                  }}
                  language={language}
                  viewMode="all"
                  type={appMode}
                />
              </div>
            </div>
          </div>
        )}

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onShareSuccess={() => setGalleryRefreshTrigger(prev => prev + 1)}
          imageUrl={shareImageBlob}
          language={language}
          type={appMode}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
