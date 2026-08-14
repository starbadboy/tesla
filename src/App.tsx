import { useEffect, useRef, useState } from 'react';
import { type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';

import { ShareModal } from './components/ShareModal';
import { WrapGallery } from './components/WrapGallery/WrapGallery';
import { Gallery3D } from './components/Gallery3D/Gallery3D';
import { WrapEditor } from './components/WrapEditor/WrapEditor';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SEO_COPY, SITE_IMAGE, SITE_URL } from './seo';

import { WrapStudio } from './components/WrapStudio/WrapStudio';

/**
 * A newly loaded sheet starts from a clean transform. DesignCanvas fits each image to
 * the canvas, so carrying the previous transform over shrank the next wrap — picking a
 * community wrap after an upload rendered it mis-mapped.
 */
const FRESH_LAYER = { 'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } };

function App() {
  const [currentModelName, setCurrentModelName] = useState('Model 3 (2024 Base)');

  const [singleLayer, setSingleLayer] = useState<string | null>(null);
  const [loadedWrapName, setLoadedWrapName] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language || navigator.languages?.[0];
      return browserLang?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }
    return 'en';
  });

  // Layer State
  const [layerTransforms, setLayerTransforms] = useState<Record<string, LayerTransform>>({});
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Share/Gallery
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImageBlob, setShareImageBlob] = useState<string | null>(null);
  const [isWrapVisible, setIsWrapVisible] = useState(true);
  const [galleryRefreshTrigger, setGalleryRefreshTrigger] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [is3DGalleryOpen, setIs3DGalleryOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [galleryView, setGalleryView] = useState<'community' | 'garage'>('community');

  const canvasRef = useRef<DesignCanvasHandle>(null);

  const seo = SEO_COPY[language];

  // ThreeDView binds a newly loaded wrap to its materials only when showTexture cycles —
  // the texture uploads and the shader compiles, yet the car keeps its previous state
  // until that transition rebuilds them. Driving it here covers every surface: the studio
  // and the editor each used to carry their own copy, and the 3D gallery had none, which
  // is why a wrap picked outside came in half applied.
  // ponytail: workaround, not the root cause — remove once ThreeDView rebinds on its own.
  useEffect(() => {
    if (!singleLayer) return;
    setIsWrapVisible(false);
    const settle = window.setTimeout(() => setIsWrapVisible(true), 60);
    return () => window.clearTimeout(settle);
  }, [singleLayer]);

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

  // Switching the car by hand drops the wrap: templates are per-model, so the
  // current texture would land on the wrong panels. Loading a wrap for another
  // model switches the car without this reset — see handleLoadCommunityWrap.
  const handleModelChange = (name: string) => {
    if (name === currentModelName) return;
    setCurrentModelName(name);
    setLoadedWrapName(null);
    setSingleLayer(null);
    setLayerTransforms({});
    setSelectedLayerId(null);
    setIsWrapVisible(false);
  };

  const handleRemoveWrap = () => {
    setSingleLayer(null);
    setLoadedWrapName(null);
    setLayerTransforms({});
    setSelectedLayerId(null);
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
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'zh' : 'en'));
  };

  const handleLoadCommunityWrap = async (
    url: string,
    wrap?: { model?: string; name?: string },
  ) => {
    // A wrap is drawn against one model's template, so bring the car along with it.
    if (wrap?.model && wrap.model !== currentModelName) {
      setCurrentModelName(wrap.model);
    }
    setLoadedWrapName(wrap?.name ?? null);
    setIsWrapVisible(true);
    if (url.includes('.r2.dev/')) {
      try {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSingleLayer(blobUrl);
        setLayerTransforms(FRESH_LAYER);
        setSelectedLayerId('Full Wrap');
        return;
      } catch (e) {
        console.error('Failed to proxy image, falling back to direct URL', e);
      }
    }
    setSingleLayer(url);
    setLayerTransforms(FRESH_LAYER);
    setSelectedLayerId('Full Wrap');
  };

  // The studio and gallery are black-only, so Tailwind-styled pieces (auth modal,
  // comments) follow suit instead of the OS setting.
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
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
          <h2>What Tesla Studio does</h2>
          <p>
            Tesla Studio supports 3D wrap preview on Model 3, Model S, Model X, Model Y and Cybertruck,
            uploading your own full-wrap sheet, browsing and downloading community wraps, and sharing your
            own designs.
          </p>
          <img src={SITE_IMAGE} alt="Tesla Studio 3D wrap preview" />
          <h2>Frequently asked questions</h2>
          {seo.faq.map(item => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </section>

        <WrapStudio
          language={language}
          onToggleLanguage={toggleLanguage}
          currentModelName={currentModelName}
          onModelChange={handleModelChange}
          singleLayer={singleLayer}
          loadedWrapName={loadedWrapName}
          selectedLayerId={selectedLayerId}
          onSelectedLayerIdChange={setSelectedLayerId}
          layerTransforms={layerTransforms}
          onLayerTransformsChange={setLayerTransforms}
          isWrapVisible={isWrapVisible}
          onIsWrapVisibleChange={setIsWrapVisible}
          canvasRef={canvasRef}
          onShare={handleOpenShareModal}
          onExport={handleExport}
          onOpenGallery={() => { setGalleryView('community'); setIsGalleryOpen(true); }}
          onOpenGarage={() => { setGalleryView('garage'); setIsGalleryOpen(true); }}
          onOpen3DGallery={() => setIs3DGalleryOpen(true)}
          onOpenEditor={() => setIsEditorOpen(true)}
          suspended={isEditorOpen || is3DGalleryOpen}
          onLoadCommunityWrap={handleLoadCommunityWrap}
          communityRefreshTrigger={galleryRefreshTrigger}
        />

        {isEditorOpen && (
          <WrapEditor
            language={language}
            currentModelName={currentModelName}
            onModelChange={handleModelChange}
            singleLayer={singleLayer}
            loadedWrapName={loadedWrapName}
            layerTransforms={layerTransforms}
            onLayerTransformsChange={setLayerTransforms}
            selectedLayerId={selectedLayerId}
            onSelectedLayerIdChange={setSelectedLayerId}
            isWrapVisible={isWrapVisible}
            onIsWrapVisibleChange={setIsWrapVisible}
            canvasRef={canvasRef}
            onLoadWrap={handleLoadCommunityWrap}
            onRemoveWrap={handleRemoveWrap}
            onExport={handleExport}
            onShare={handleOpenShareModal}
            onClose={() => setIsEditorOpen(false)}
          />
        )}

        {is3DGalleryOpen && (
          <Gallery3D
            language={language}
            currentModelName={currentModelName}
            onModelChange={handleModelChange}
            singleLayer={singleLayer}
            loadedWrapName={loadedWrapName}
            isWrapVisible={isWrapVisible}
            onIsWrapVisibleChange={setIsWrapVisible}
            canvasRef={canvasRef}
            layerTransforms={layerTransforms}
            onLayerTransformsChange={setLayerTransforms}
            selectedLayerId={selectedLayerId}
            onSelectedLayerIdChange={setSelectedLayerId}
            onLoadCommunityWrap={handleLoadCommunityWrap}
            onClose={() => setIs3DGalleryOpen(false)}
            refreshTrigger={galleryRefreshTrigger}
          />
        )}

        {isGalleryOpen && (
          <WrapGallery
            type="car"
            selectedModel={currentModelName}
            refreshTrigger={galleryRefreshTrigger}
            language={language}
            onToggleLanguage={toggleLanguage}
            view={galleryView}
            onLoadWrap={handleLoadCommunityWrap}
            onClose={() => setIsGalleryOpen(false)}
          />
        )}

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onShareSuccess={() => setGalleryRefreshTrigger(prev => prev + 1)}
          imageUrl={shareImageBlob}
          language={language}
          type="car"
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
