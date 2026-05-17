import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, RefObject } from 'react';

import { CAR_MODELS, CAR_3D_MODELS } from '../../constants';
import type { DesignCanvasHandle, LayerTransform } from '../DesignCanvas';
import { DesignCanvas } from '../DesignCanvas';
import { ThreeDView } from '../ThreeDView';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { TRANSLATIONS } from '../../translations';

import {
  IconBattery,
  IconCar,
  IconChevDown,
  IconCheck,
  IconClose,
  IconDownload,
  IconEye,
  IconGlobe,
  IconGrid,
  IconHeart,
  IconLayers,
  IconLock,
  IconMoon,
  IconPlate,
  IconPlus,
  IconRotate,
  IconScale,
  IconSettings,
  IconShare,
  IconSliders,
  IconSound,
  IconSparkle,
  IconSun,
  IconTarget,
  IconUpload,
  IconZap,
} from './icons';
import { WRAP_PRESETS, gradientCss, gradientToDataUrl } from './wraps';
import type { WrapPreset } from './wraps';

import '../../styles/tesla-studio.css';

const ACCENT: { hex: string; rgb: string } = { hex: '#a855ff', rgb: '168,85,255' };

const MODE_TABS = [
  { k: 'car' as const,   label: 'CAR',   Icon: IconCar },
  { k: 'plate' as const, label: 'PLATE', Icon: IconPlate },
  { k: 'sound' as const, label: 'SOUND', Icon: IconSound },
];

interface ModelMeta {
  id: string;
  name: string;
  displayName: string;
  badge: string;
  range: string;
  hp: string;
  zero: string;
  img: string;
  has3D: boolean;
}

function buildModelList(language: 'en' | 'zh'): ModelMeta[] {
  const t = TRANSLATIONS[language] as unknown as Record<string, string>;
  return Object.keys(CAR_MODELS).map(name => {
    const lower = name.toLowerCase();
    const badge = lower.includes('performance')
      ? 'PERF'
      : lower.includes('plaid')
        ? 'PLAID'
        : lower.includes('cybertruck')
          ? 'BEAST'
          : lower.includes('long')
            ? 'LR'
            : 'BASE';
    const range = lower.includes('performance')
      ? '296 mi'
      : lower.includes('long')
        ? '341 mi'
        : lower.includes('cybertruck')
          ? '340 mi'
          : '272 mi';
    const hp = lower.includes('performance')
      ? '510 hp'
      : lower.includes('plaid')
        ? '1020 hp'
        : lower.includes('cybertruck')
          ? '845 hp'
          : '283 hp';
    const zero = lower.includes('performance')
      ? '2.9 s'
      : lower.includes('plaid')
        ? '1.99 s'
        : lower.includes('cybertruck')
          ? '2.6 s'
          : '5.8 s';
    return {
      id: name,
      name,
      displayName: t[name] ?? name,
      badge,
      range,
      hp,
      zero,
      img: CAR_MODELS[name],
      has3D: Boolean(CAR_3D_MODELS[name]),
    };
  });
}

// ============================================================
// Props
// ============================================================
export interface TeslaStudioProps {
  language: 'en' | 'zh';
  onToggleLanguage: () => void;

  appMode: 'car' | 'plate' | 'sound';
  onAppMode: (mode: 'car' | 'plate' | 'sound') => void;

  currentModelName: string;
  onModelChange: (name: string) => void;

  singleLayer: string | null;
  onSingleLayerChange: (url: string | null) => void;

  selectedLayerId: string | null;
  onSelectedLayerIdChange: (id: string | null) => void;

  layerTransforms: Record<string, LayerTransform>;
  onLayerTransformsChange: (next: Record<string, LayerTransform>) => void;

  isWrapVisible: boolean;
  onIsWrapVisibleChange: (next: boolean) => void;

  // AI
  aiPrompt: string;
  onAiPromptChange: (next: string) => void;
  aiProvider: 'puter' | 'openai' | 'gemini';
  onAiProviderChange: (next: 'puter' | 'openai' | 'gemini') => void;
  isGenerating: boolean;
  isPuterLoaded: boolean;
  aiError: string | null;
  onGenerate: () => void;

  // Stage / canvas refs
  canvasRef: RefObject<DesignCanvasHandle | null>;

  // Share & export
  onShare: () => void;
  onExport: () => void;

  // Community
  onOpenGallery: () => void;

  // Children rendered as overlays (e.g. ShareModal, BuyMeCoffee, full Gallery modal)
  children?: React.ReactNode;
}

// ============================================================
// Top Rail
// ============================================================
interface TopRailProps {
  model: ModelMeta;
  models: ModelMeta[];
  onModelChange: (m: ModelMeta) => void;
  appMode: 'car' | 'plate' | 'sound';
  onAppMode: (m: 'car' | 'plate' | 'sound') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  language: 'en' | 'zh';
  time: string;
  battery: number;
  authLabel: string;
  onAvatarClick: () => void;
}

function TopRail({
  model, models, onModelChange,
  appMode, onAppMode,
  theme, onToggleTheme,
  onToggleLanguage,
  language,
  time, battery,
  authLabel, onAvatarClick,
}: TopRailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="tsl-rail">
      <div className="tsl-rail-left">
        <div className="tsl-logo" title="Tesla Wrap Studio">
          <svg viewBox="0 0 342 35" width="78" height="10" fill="currentColor" aria-hidden="true">
            <path d="M0 .1h33.5v5.5H20V34h-6.5V5.6H0zM40.8 34V.1h30.1v5.5H47.2V14h22.6v5.4H47.2v9h23.7V34zM79.3 34h6.4V18.8h18.1V34h6.4V.1h-6.4v13.3H85.7V.1h-6.4zM122.4 34V.1h24.7c4.8 0 8.9 3.9 8.9 8.7 0 2.8-1.4 5.4-3.7 7 2.9 1.5 4.6 4.5 4.6 7.9 0 5.5-4.5 10-10 10zm6.4-5.5h15.9c2.6 0 4.8-2 4.8-4.6s-2.2-4.6-4.8-4.6h-15.9zm0-14.7h15c2.3 0 4.2-1.9 4.2-4.1 0-2.3-1.9-4.1-4.2-4.1h-15zM175.6 34V.1h6.4v28.4h21V34zM225.8 34h-6.4L207 .1h6.9l9 25.5L231.8.1h6.9zM260 34h-6.4V.1H260zM295 5.6h-11V34h-6.5V5.6h-11V.1H295zM342 34l-14.4-16.9 13.6-17h-7.8l-9.7 12.3L313.8.1h-7.8l13.6 17L305.2 34h7.8l10.1-12.9L333.2 34z" />
          </svg>
          <span className="tsl-logo-sub">WRAP STUDIO</span>
        </div>

        <div className="tsl-divider-v" />

        <div className="tsl-mode-switch" role="tablist">
          {MODE_TABS.map(({ k, label, Icon }) => (
            <button
              key={k}
              role="tab"
              aria-selected={appMode === k}
              className={`tsl-mode-btn ${appMode === k ? 'is-active' : ''}`}
              onClick={() => onAppMode(k)}
              type="button"
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tsl-rail-center">
        <button
          className="tsl-model-pill"
          onClick={() => setMenuOpen(open => !open)}
          type="button"
          disabled={appMode !== 'car'}
        >
          <span className="tsl-model-badge" style={{ background: ACCENT.hex }}>{model.badge}</span>
          <span className="tsl-model-name">{model.displayName}</span>
          <IconChevDown size={14} />
        </button>
        {menuOpen && appMode === 'car' && (
          <div className="tsl-model-menu" onMouseLeave={() => setMenuOpen(false)}>
            {models.map(m => (
              <button
                key={m.id}
                type="button"
                className={`tsl-model-row ${m.id === model.id ? 'is-active' : ''}`}
                onClick={() => { onModelChange(m); setMenuOpen(false); }}
              >
                <img src={m.img} alt="" />
                <div>
                  <div className="tsl-model-row-name">{m.displayName}</div>
                  <div className="tsl-model-row-specs">
                    <span>{m.range}</span><span>·</span><span>{m.hp}</span><span>·</span><span>0–60 {m.zero}</span>
                  </div>
                </div>
                {m.id === model.id && <IconCheck size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tsl-rail-right">
        <div className="tsl-status">
          <div className="tsl-status-item" title="Battery">
            <IconBattery size={14} />
            <span>{battery}%</span>
          </div>
          <div className="tsl-status-item" title="Time">
            <span className="tsl-mono">{time}</span>
          </div>
        </div>
        <button className="tsl-icon-btn" title={language === 'en' ? '中文' : 'English'} onClick={onToggleLanguage} type="button">
          <IconGlobe size={16} />
        </button>
        <button className="tsl-icon-btn" title="Theme" onClick={onToggleTheme} type="button">
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button className="tsl-avatar" title="Account" type="button" onClick={onAvatarClick}>
          <span>{authLabel}</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Stage — full-bleed 3D viewer with HUD overlays
// ============================================================
interface StageProps {
  modelName: string;
  model3dPath: string | null;
  modelImagePath: string;
  canvasRef: RefObject<DesignCanvasHandle | null>;
  isWrapVisible: boolean;
  onToggleWrap: (v: boolean) => void;
  view: '2d' | '3d';
  onView: (v: '2d' | '3d') => void;
  has3D: boolean;
  language: 'en' | 'zh';
  appMode: 'car' | 'plate' | 'sound';
  activeLayers: Record<string, string>;
  layerTransforms: Record<string, LayerTransform>;
  onTransformChange: (id: string, t: LayerTransform) => void;
  selectedLayerId: string | null;
  onSelect: (id: string | null) => void;
}

function Stage({
  model3dPath, modelImagePath, canvasRef, isWrapVisible, onToggleWrap,
  view, onView, has3D, language, appMode, activeLayers, layerTransforms,
  onTransformChange, selectedLayerId, onSelect,
}: StageProps) {
  const showThreeD = view === '3d' && has3D && appMode === 'car';

  return (
    <div className="tsl-stage">
      <div className="tsl-stage-floor" />
      <div className="tsl-stage-grid" />
      <div className="tsl-stage-vignette" />

      <div className="tsl-hud-tl">
        <div className="tsl-tick-label">ENV·STUDIO</div>
        <div className="tsl-mono tsl-tick-val">LUX 04.82 / RH 42%</div>
      </div>
      <div className="tsl-hud-tr">
        <div className="tsl-tick-label">MODE</div>
        <div className="tsl-mono tsl-tick-val">{appMode.toUpperCase()} · {has3D ? '3D-READY' : '2D-ONLY'}</div>
      </div>
      <div className="tsl-hud-bl">
        <div className="tsl-tick-label">SURFACE AREA</div>
        <div className="tsl-mono tsl-tick-val">14.6 m² · 7 PANELS</div>
      </div>
      <div className="tsl-hud-br">
        <div className="tsl-tick-label">RENDER</div>
        <div className="tsl-mono tsl-tick-val">
          <span className="tsl-dot" style={{ background: ACCENT.hex, color: ACCENT.hex }} />
          PBR · DRACO · 60fps
        </div>
      </div>

      {/* 3D layer */}
      <div
        className="tsl-stage-host"
        style={{ opacity: showThreeD ? 1 : 0, pointerEvents: showThreeD ? 'auto' : 'none' }}
      >
        {model3dPath && (
          <ThreeDView
            stageRef={canvasRef}
            modelPath={model3dPath}
            isActive={showThreeD}
            showTexture={isWrapVisible}
            onToggleWrap={onToggleWrap}
            language={language}
          />
        )}
      </div>

      {/* 2D layer — also serves as texture source for ThreeDView */}
      <div
        className="tsl-stage-host"
        style={{ opacity: showThreeD ? 0 : 1, pointerEvents: showThreeD ? 'none' : 'auto' }}
      >
        <DesignCanvas
          ref={canvasRef}
          modelPath={modelImagePath}
          layers={activeLayers}
          transforms={layerTransforms}
          onTransformChange={onTransformChange}
          selectedId={selectedLayerId}
          onSelect={onSelect}
          onExport={() => undefined}
          mode="select"
          brushColor="#000000"
          brushSize={5}
          canvasType={appMode === 'plate' ? 'plate' : 'car'}
          plateSize="420x200"
        />
      </div>

      <div className="tsl-plinth">
        <svg viewBox="0 0 600 80" preserveAspectRatio="none">
          <ellipse cx="300" cy="40" rx="290" ry="32" fill="none" stroke="currentColor" strokeOpacity=".3" strokeDasharray="2 6" />
          <ellipse cx="300" cy="40" rx="220" ry="24" fill="none" stroke="currentColor" strokeOpacity=".15" strokeDasharray="2 6" />
        </svg>
      </div>

      <div className="tsl-viewer-ctrl">
        <button
          type="button"
          className={`tsl-seg ${view === '2d' ? 'is-active' : ''}`}
          onClick={() => onView('2d')}
        >
          <IconGrid size={13} /> 2D CANVAS
        </button>
        <button
          type="button"
          className={`tsl-seg ${view === '3d' ? 'is-active' : ''}`}
          onClick={() => onView('3d')}
          disabled={!has3D || appMode !== 'car'}
          title={!has3D ? 'No 3D model for this car yet' : ''}
        >
          <IconTarget size={13} /> 3D PREVIEW
        </button>
        <div className="tsl-seg-divider" />
        <button type="button" className="tsl-seg" onClick={() => onToggleWrap(!isWrapVisible)}>
          <IconEye size={13} /> {isWrapVisible ? 'WRAP ON' : 'BASE PAINT'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Left Design Panel
// ============================================================
interface DesignPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  activeWrapId: string | null;
  onPickPreset: (preset: WrapPreset) => void;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  aiProvider: 'puter' | 'openai' | 'gemini';
  onAiProviderChange: (v: 'puter' | 'openai' | 'gemini') => void;
  isGenerating: boolean;
  isPuterLoaded: boolean;
  aiError: string | null;
  onGenerate: () => void;
}

function DesignPanel({
  collapsed, onToggle, activeWrapId, onPickPreset, onUpload,
  aiPrompt, onAiPromptChange, aiProvider, onAiProviderChange,
  isGenerating, isPuterLoaded, aiError, onGenerate,
}: DesignPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cycleProvider = () => {
    const order: Array<'puter' | 'openai' | 'gemini'> = ['puter', 'openai', 'gemini'];
    const i = order.indexOf(aiProvider);
    onAiProviderChange(order[(i + 1) % order.length]);
  };
  const providerLabel = aiProvider === 'puter' ? 'COMPUTER · AI' : aiProvider === 'openai' ? 'OPENAI' : 'GEMINI';
  const generateDisabled =
    isGenerating || !aiPrompt.trim() || (aiProvider === 'puter' && !isPuterLoaded);

  return (
    <div className={`tsl-panel tsl-panel-left ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="tsl-panel-head">
        <div className="tsl-panel-title">
          <IconLayers size={12} />
          <span className="tsl-panel-title-text">DESIGN</span>
        </div>
        <button
          type="button"
          className="tsl-panel-collapse"
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <IconLayers size={12} /> : <IconClose size={12} />}
        </button>
        {!collapsed && <div className="tsl-panel-hairline" />}
      </div>

      <div className="tsl-panel-body">
        <div className="tsl-section">
          <div className="tsl-section-head">
            <span>WRAP LIBRARY</span>
            <span className="tsl-mono tsl-dim">{WRAP_PRESETS.length}</span>
          </div>
          <div className="tsl-wrap-grid">
            {WRAP_PRESETS.map(w => (
              <button
                key={w.id}
                type="button"
                className={`tsl-wrap-chip ${activeWrapId === w.id ? 'is-active' : ''}`}
                onClick={() => onPickPreset(w)}
              >
                <span className="tsl-wrap-chip-swatch" style={{ background: gradientCss(w.stops, w.angle) }} />
                <span className="tsl-wrap-chip-name">{w.name}</span>
                {activeWrapId === w.id && (
                  <span className="tsl-wrap-chip-check"><IconCheck size={10} /></span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="tsl-section">
          <div className="tsl-section-head">
            <span>UPLOAD</span>
            <span className="tsl-dim">PNG · JPG · SVG</span>
          </div>
          <button type="button" className="tsl-upload" onClick={() => fileRef.current?.click()}>
            <IconUpload size={18} />
            <div>
              <div className="tsl-upload-title">Drop your texture</div>
              <div className="tsl-upload-sub">or browse · up to 4096</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onUpload}
            />
          </button>
        </div>

        <div className="tsl-section tsl-section-ai">
          <div className="tsl-section-head">
            <span>
              <IconSparkle size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              GENERATE · AI
            </span>
            <button
              type="button"
              className="tsl-ai-provider tsl-mono"
              onClick={cycleProvider}
              title="Click to cycle provider"
            >
              {providerLabel}
            </button>
          </div>
          <textarea
            className="tsl-ai-input"
            placeholder="describe a wrap… 'sunset over tokyo, matte, stripes'"
            value={aiPrompt}
            onChange={e => onAiPromptChange(e.target.value)}
          />
          <div className="tsl-ai-chips">
            {['cyberpunk neon', 'stealth matte', 'liquid chrome', 'vaporwave'].map(s => (
              <button key={s} type="button" className="tsl-chip" onClick={() => onAiPromptChange(s)}>
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tsl-primary-btn"
            onClick={onGenerate}
            disabled={generateDisabled}
            style={{ ['--accent' as keyof CSSProperties]: ACCENT.hex } as CSSProperties}
          >
            {isGenerating
              ? (<><span className="tsl-spinner" /> GENERATING…</>)
              : (<><IconZap size={14} /> GENERATE WRAP</>)}
          </button>
          {aiError && <div className="tsl-ai-error">{aiError}</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Right Properties Panel
// ============================================================
interface PropertiesPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  activeWrap: WrapPreset | null;
  selectedTransform: LayerTransform | null;
  selectedLayerId: string | null;
  onUpdate: (changes: Partial<LayerTransform>) => void;
}

function PropertiesPanel({
  collapsed, onToggle, activeWrap, selectedTransform, selectedLayerId, onUpdate,
}: PropertiesPanelProps) {
  const disabled = !selectedTransform || !selectedLayerId;

  const opacityPct = selectedTransform ? Math.round(selectedTransform.opacity * 100) : 0;
  const rotationDeg = selectedTransform
    ? ((selectedTransform.rotation % 360) + 360) % 360
    : 0;
  const scalePct = selectedTransform ? Math.round(selectedTransform.scaleX * 100) : 100;

  return (
    <div className={`tsl-panel tsl-panel-right ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="tsl-panel-head">
        <button
          type="button"
          className="tsl-panel-collapse"
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <IconSliders size={12} /> : <IconClose size={12} />}
        </button>
        <div className="tsl-panel-title">
          <IconSliders size={12} />
          <span className="tsl-panel-title-text">TRANSFORM</span>
        </div>
        {!collapsed && <div className="tsl-panel-hairline" />}
      </div>

      <div className="tsl-panel-body">
        <div className="tsl-section">
          <div className="tsl-layer-card">
            <div
              className="tsl-layer-thumb"
              style={{ background: activeWrap ? gradientCss(activeWrap.stops, activeWrap.angle) : '#222' }}
            />
            <div className="tsl-layer-meta">
              <div className="tsl-layer-name">{activeWrap?.name ?? 'Custom Layer'}</div>
              <div className="tsl-layer-sub tsl-mono">{selectedLayerId ? selectedLayerId.toUpperCase() : 'NO SELECTION'}</div>
            </div>
            <button type="button" className="tsl-lock-btn" title="Lock"><IconLock size={12} /></button>
          </div>
        </div>

        <div className="tsl-section">
          <div className="tsl-section-head"><span>PROPERTIES</span></div>

          <div className={`tsl-prop-row ${disabled ? 'is-disabled' : ''}`}>
            <label><IconEye size={11} /><span>Opacity</span></label>
            <div className="tsl-prop-ctrl">
              <input
                type="range" min={0} max={100} step={1}
                value={opacityPct}
                disabled={disabled}
                onChange={e => onUpdate({ opacity: parseFloat(e.target.value) / 100 })}
              />
              <span className="tsl-prop-val tsl-mono">{opacityPct}%</span>
            </div>
          </div>

          <div className={`tsl-prop-row ${disabled ? 'is-disabled' : ''}`}>
            <label><IconRotate size={11} /><span>Rotation</span></label>
            <div className="tsl-prop-ctrl">
              <input
                type="range" min={0} max={360} step={1}
                value={rotationDeg}
                disabled={disabled}
                onChange={e => onUpdate({ rotation: parseFloat(e.target.value) })}
              />
              <span className="tsl-prop-val tsl-mono">{Math.round(rotationDeg)}°</span>
            </div>
          </div>

          <div className={`tsl-prop-row ${disabled ? 'is-disabled' : ''}`}>
            <label><IconScale size={11} /><span>Scale</span></label>
            <div className="tsl-prop-ctrl">
              <input
                type="range" min={10} max={300} step={1}
                value={scalePct}
                disabled={disabled}
                onChange={e => {
                  const v = parseFloat(e.target.value) / 100;
                  onUpdate({ scaleX: v, scaleY: v });
                }}
              />
              <span className="tsl-prop-val tsl-mono">{scalePct}%</span>
            </div>
          </div>
        </div>

        <div className="tsl-section">
          <div className="tsl-section-head"><span>FINISH</span></div>
          <div className="tsl-seg-group">
            {['MATTE', 'SATIN', 'GLOSS'].map((f, i) => (
              <button key={f} type="button" className={`tsl-seg ${i === 1 ? 'is-active' : ''}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="tsl-section">
          <div className="tsl-estimate-inline">
            <div className="tsl-estimate-row">
              <span className="tsl-dim">Material</span>
              <span className="tsl-mono">14.6 m²</span>
            </div>
            <div className="tsl-estimate-row">
              <span className="tsl-dim">Labor</span>
              <span className="tsl-mono">18–22 hrs</span>
            </div>
            <div className="tsl-estimate-row is-total">
              <span>Estimate</span>
              <span className="tsl-mono" style={{ color: ACCENT.hex }}>$3,840</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Community dock — fetches /api/wraps for a horizontal strip
// ============================================================
interface DockWrap {
  _id: string;
  imageUrl: string;
  title?: string;
  user?: { name?: string };
  likes?: number;
  modelType?: string;
}

interface CommunityDockProps {
  appMode: 'car' | 'plate' | 'sound';
  currentModelName: string;
  onLoadWrap: (url: string) => void;
  onShare: () => void;
  onBrowseAll: () => void;
}

function CommunityDock({ appMode, currentModelName, onLoadWrap, onShare, onBrowseAll }: CommunityDockProps) {
  const [items, setItems] = useState<DockWrap[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const endpoint =
          appMode === 'sound'
            ? '/api/sounds?sort=hot'
            : `/api/wraps?sort=hot&type=${appMode}`;
        const resp = await fetch(endpoint);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { wraps?: DockWrap[]; sounds?: DockWrap[] } | DockWrap[];
        const list = Array.isArray(data)
          ? data
          : data.wraps ?? data.sounds ?? [];
        if (!cancelled) setItems(list.slice(0, 12));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [appMode, currentModelName]);

  return (
    <div className="tsl-dock">
      <div className="tsl-dock-head">
        <div className="tsl-dock-title">
          <IconGrid size={12} />
          <span>COMMUNITY</span>
          <span className="tsl-badge-live">
            <span className="tsl-dot" style={{ background: ACCENT.hex, color: ACCENT.hex }} />
            LIVE
          </span>
        </div>
        <div className="tsl-dock-actions">
          <button type="button" className="tsl-ghost-btn" onClick={onBrowseAll}>
            BROWSE ALL →
          </button>
          <button
            type="button"
            className="tsl-primary-btn tsl-compact"
            onClick={onShare}
            style={{ ['--accent' as keyof CSSProperties]: ACCENT.hex } as CSSProperties}
          >
            <IconPlus size={13} /> SHARE YOURS
          </button>
        </div>
      </div>
      <div className="tsl-dock-strip">
        {loading && items.length === 0 ? (
          <div className="tsl-dock-empty">Loading community wraps…</div>
        ) : items.length === 0 ? (
          <div className="tsl-dock-empty">No wraps yet — be the first to share.</div>
        ) : (
          items.map(c => (
            <button
              key={c._id}
              type="button"
              className="tsl-dock-card"
              onClick={() => onLoadWrap(c.imageUrl)}
            >
              <div
                className="tsl-dock-card-img"
                style={{ backgroundImage: `url(${c.imageUrl})`, backgroundColor: '#111' }}
              >
                <div className="tsl-dock-card-overlay">
                  <span className="tsl-dock-card-likes">
                    <IconHeart size={10} /> {(c.likes ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="tsl-dock-card-meta">
                <div className="tsl-dock-card-name">{c.title ?? 'Untitled wrap'}</div>
                <div className="tsl-dock-card-sub tsl-mono">
                  @{c.user?.name ?? 'anon'} · {c.modelType ?? appMode}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main shell
// ============================================================
export function TeslaStudio(props: TeslaStudioProps) {
  const {
    language, onToggleLanguage,
    appMode, onAppMode,
    currentModelName, onModelChange,
    singleLayer, onSingleLayerChange,
    selectedLayerId, onSelectedLayerIdChange,
    layerTransforms, onLayerTransformsChange,
    isWrapVisible, onIsWrapVisibleChange,
    aiPrompt, onAiPromptChange,
    aiProvider, onAiProviderChange,
    isGenerating, isPuterLoaded, aiError, onGenerate,
    canvasRef,
    onShare, onExport,
    onOpenGallery,
    children,
  } = props;

  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  // Resolve theme to dark/light (system → respect prefers-color-scheme)
  const resolvedTheme: 'dark' | 'light' = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }, [theme]);

  const models = useMemo(() => buildModelList(language), [language]);
  const currentModel = models.find(m => m.id === currentModelName) ?? models[0];

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [time, setTime] = useState('00:00');

  // Clock
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    fmt();
    const iv = window.setInterval(fmt, 10_000);
    return () => window.clearInterval(iv);
  }, []);

  // Auto-fallback to 2D when 3D unavailable
  useEffect(() => {
    if (!currentModel?.has3D || appMode !== 'car') {
      setView('2d');
    } else if (appMode === 'car' && currentModel.has3D) {
      setView('3d');
    }
  }, [currentModel, appMode]);

  // Picking a preset injects a gradient PNG as the single wrap layer
  const handlePickPreset = (preset: WrapPreset) => {
    const url = gradientToDataUrl(preset);
    if (!url) return;
    setActivePresetId(preset.id);
    onSingleLayerChange(url);
    onLayerTransformsChange({
      ...layerTransforms,
      'Full Wrap': layerTransforms['Full Wrap'] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    onSelectedLayerIdChange('Full Wrap');
    onIsWrapVisibleChange(true);
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const url = URL.createObjectURL(e.target.files[0]);
    setActivePresetId(null);
    onSingleLayerChange(url);
    onLayerTransformsChange({
      ...layerTransforms,
      'Full Wrap': { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    });
    onSelectedLayerIdChange('Full Wrap');
    onIsWrapVisibleChange(true);
    e.target.value = '';
  };

  const handleTransformChange = (id: string, t: LayerTransform) => {
    onLayerTransformsChange({ ...layerTransforms, [id]: t });
  };

  const updateSelected = (changes: Partial<LayerTransform>) => {
    if (!selectedLayerId) return;
    const current = layerTransforms[selectedLayerId]
      ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    onLayerTransformsChange({
      ...layerTransforms,
      [selectedLayerId]: { ...current, ...changes },
    });
  };

  const selectedTransform = selectedLayerId
    ? (layerTransforms[selectedLayerId] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 })
    : null;

  const activeLayers: Record<string, string> = singleLayer
    ? { 'Full Wrap': singleLayer }
    : {};

  const authLabel = user?.username?.[0]?.toUpperCase() ?? 'K';

  const accentVars: CSSProperties = {
    ['--accent' as keyof CSSProperties]: ACCENT.hex,
    ['--accent-rgb' as keyof CSSProperties]: ACCENT.rgb,
  } as CSSProperties;

  return (
    <div
      className={`tsl-app tsl-theme-${resolvedTheme} tsl-panels-glass tsl-density-comfy`}
      style={accentVars}
    >
      <TopRail
        model={currentModel}
        models={models}
        onModelChange={m => onModelChange(m.id)}
        appMode={appMode}
        onAppMode={onAppMode}
        theme={resolvedTheme}
        onToggleTheme={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        onToggleLanguage={onToggleLanguage}
        language={language}
        time={time}
        battery={87}
        authLabel={authLabel}
        onAvatarClick={onOpenGallery}
      />

      <div className="tsl-body">
        <DesignPanel
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed(v => !v)}
          activeWrapId={activePresetId}
          onPickPreset={handlePickPreset}
          onUpload={handleUpload}
          aiPrompt={aiPrompt}
          onAiPromptChange={onAiPromptChange}
          aiProvider={aiProvider}
          onAiProviderChange={onAiProviderChange}
          isGenerating={isGenerating}
          isPuterLoaded={isPuterLoaded}
          aiError={aiError}
          onGenerate={onGenerate}
        />

        <Stage
          modelName={currentModelName}
          model3dPath={CAR_3D_MODELS[currentModelName] || null}
          modelImagePath={CAR_MODELS[currentModelName]}
          canvasRef={canvasRef}
          isWrapVisible={isWrapVisible}
          onToggleWrap={onIsWrapVisibleChange}
          view={view}
          onView={setView}
          has3D={currentModel?.has3D ?? false}
          language={language}
          appMode={appMode}
          activeLayers={activeLayers}
          layerTransforms={layerTransforms}
          onTransformChange={handleTransformChange}
          selectedLayerId={selectedLayerId}
          onSelect={onSelectedLayerIdChange}
        />

        <PropertiesPanel
          collapsed={rightCollapsed}
          onToggle={() => setRightCollapsed(v => !v)}
          activeWrap={WRAP_PRESETS.find(p => p.id === activePresetId) ?? null}
          selectedTransform={selectedTransform}
          selectedLayerId={selectedLayerId}
          onUpdate={updateSelected}
        />
      </div>

      <CommunityDock
        appMode={appMode}
        currentModelName={currentModelName}
        onLoadWrap={url => {
          onSingleLayerChange(url);
          onIsWrapVisibleChange(true);
          setActivePresetId(null);
        }}
        onShare={onShare}
        onBrowseAll={onOpenGallery}
      />

      <div className="tsl-actionbar">
        <div className="tsl-actionbar-left">
          <button
            type="button"
            className={`tsl-toggle ${autoRotate ? 'is-on' : ''}`}
            onClick={() => setAutoRotate(v => !v)}
            title="Auto-rotate (visual)"
          >
            <span className="tsl-toggle-dot" />
            <span>AUTO-ROTATE</span>
          </button>
          <span className="tsl-dim tsl-mono" style={{ fontSize: 10 }}>v4.2.1 · synced to cloud</span>
        </div>
        <div className="tsl-actionbar-right">
          <button type="button" className="tsl-ghost-btn" onClick={onShare}>
            <IconShare size={13} /> SHARE
          </button>
          <button
            type="button"
            className="tsl-primary-btn tsl-compact"
            onClick={onExport}
            style={{ ['--accent' as keyof CSSProperties]: ACCENT.hex } as CSSProperties}
          >
            <IconDownload size={13} /> EXPORT PNG
          </button>
          <button
            type="button"
            className="tsl-icon-btn"
            onClick={onOpenGallery}
            title="Open Garage / Settings"
          >
            <IconSettings size={16} />
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}
