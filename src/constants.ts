// GitHub CDN base URL for static assets
export const CDN_BASE = "https://raw.githubusercontent.com/starbadboy/tesla/main/public";

export const CAR_MODELS: Record<string, string> = {
    "Cybertruck": `${CDN_BASE}/assets/cybertruck.png`,
    "Model 3 (2024 Base)": `${CDN_BASE}/assets/model3-2024-base.png`,
    "Model 3 (2024 Performance)": `${CDN_BASE}/assets/model3-2024-performance.png`,
    "Model 3 (Classic)": `${CDN_BASE}/assets/model3.png`,
    "Model Y (2025 Base)": `${CDN_BASE}/assets/modely-2025-base.png`,
    "Model Y (2025 Performance)": `${CDN_BASE}/assets/modely-2025-performance.png`,
    "Model Y (2025 Long Range)": `${CDN_BASE}/assets/modely-2025-premium.png`,
    "Model Y L": `${CDN_BASE}/assets/modely-l.png`,
    "Model Y": `${CDN_BASE}/assets/modely.png`,
};

export const CAR_3D_MODELS: Record<string, string> = {
    "Cybertruck": `${CDN_BASE}/models/cybertruck/Cybertruck.gltf`,
    "Model 3 (2024 Base)": `${CDN_BASE}/models/model3_2024/Poppyseed.gltf`,
    "Model 3 (2024 Performance)": "", // Not available
    "Model 3 (Classic)": `${CDN_BASE}/models/model3_classic/Model3_High.gltf`,
    "Model Y (2025 Base)": `${CDN_BASE}/models/modely_2025_standard/BayberryE41.gltf`,
    "Model Y (2025 Performance)": "", // Not available
    "Model Y (2025 Long Range)": `${CDN_BASE}/models/modely_2025_premium/Bayberry.gltf`,
    "Model Y L": "", // Not available
    "Model Y": `${CDN_BASE}/models/modely_classic/ModelY_High.gltf`,
};

export const WRAP_FOLDER_MAP: Record<string, string> = {
    "Cybertruck": "cybertruck",
    "Model 3 (2024 Base)": "model3-2024-base",
    "Model 3 (2024 Performance)": "model3-2024-performance",
    "Model 3 (Classic)": "model3",
    "Model Y (2025 Base)": "modely-2025-base",
    "Model Y (2025 Performance)": "modely-2025-performance",
    "Model Y (2025 Long Range)": "modely-2025-premium",
    "Model Y L": "modely-l",
    "Model Y": "modely",
};
