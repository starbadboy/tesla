import { useEffect, useRef, useState } from 'react';
import { type DesignCanvasHandle, type LayerTransform } from './components/DesignCanvas';

import { ShareModal } from './components/ShareModal';
import { WrapGallery } from './components/WrapGallery/WrapGallery';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SEO_COPY, SITE_IMAGE, SITE_URL } from './seo';

import { WrapStudio } from './components/WrapStudio/WrapStudio';

function App() {
  const [currentModelName, setCurrentModelName] = useState('Model 3 (2024 Base)');

  const [singleLayer, setSingleLayer] = useState<string | null>(null);
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

  const canvasRef = useRef<DesignCanvasHandle>(null);

  const seo = SEO_COPY[language];

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

  // Reset the wrap when switching models
  useEffect(() => {
    setSingleLayer(null);
    setLayerTransforms({});
    setSelectedLayerId(null);
    setIsWrapVisible(false);
  }, [currentModelName]);

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

        <WrapStudio
          language={language}
          onToggleLanguage={toggleLanguage}
          currentModelName={currentModelName}
          onModelChange={setCurrentModelName}
          singleLayer={singleLayer}
          selectedLayerId={selectedLayerId}
          onSelectedLayerIdChange={setSelectedLayerId}
          layerTransforms={layerTransforms}
          onLayerTransformsChange={setLayerTransforms}
          isWrapVisible={isWrapVisible}
          onIsWrapVisibleChange={setIsWrapVisible}
          canvasRef={canvasRef}
          onShare={handleOpenShareModal}
          onExport={handleExport}
          onOpenGallery={() => setIsGalleryOpen(true)}
          onLoadCommunityWrap={handleLoadCommunityWrap}
          communityRefreshTrigger={galleryRefreshTrigger}
        />

        {isGalleryOpen && (
          <WrapGallery
            type="car"
            selectedModel={currentModelName}
            refreshTrigger={galleryRefreshTrigger}
            language={language}
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
