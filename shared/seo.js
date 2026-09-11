// Route table and page metadata shared by the client router and the server's
// crawler-facing HTML, so a URL means the same thing on both sides.
export const SITE_URL = 'https://www.teslastudio.online';

export const PAGE_PATHS = Object.freeze({
    preview: '/',
    home: '/home',
    create: '/create',
    edit: '/create/manual',
    explore: '/explore',
    explore3d: '/explore/3d',
    garage: '/garage',
});

export const PAGE_META = Object.freeze({
    en: {
        preview: {
            title: 'Tesla Studio | 3D Tesla Wrap Preview & Community Wrap Library',
            description: 'Preview Tesla wraps on a 3D model, browse and download hundreds of free community wrap designs, upload your own sheet to see it on the car, and export installation-ready PNG artwork.',
        },
        home: {
            title: 'Tesla Studio | Design, Preview and Share Tesla Wraps',
            description: 'A browser-based studio for Tesla owners: preview wraps in 3D on Model 3, Model Y, Model S, Model X and Cybertruck, explore community designs, and export Toybox-ready artwork.',
        },
        create: {
            title: 'AI Tesla Wrap Generator | Tesla Studio',
            description: 'Describe a design and get a full Tesla wrap texture drawn on the correct template for your car, ready to preview in 3D and export as PNG.',
        },
        edit: {
            title: 'Tesla Wrap Editor | Tesla Studio',
            description: 'Place your own artwork on a Tesla wrap template, adjust it on the 3D car, and export an installation-ready PNG for the Tesla Toybox Colorizer.',
        },
        explore: {
            title: 'Free Tesla Wrap Designs | Community Gallery | Tesla Studio',
            description: 'Browse hundreds of free Tesla wrap designs for Model 3, Model Y, Model S, Model X and Cybertruck. Preview any wrap in 3D and download the PNG.',
        },
        explore3d: {
            title: 'Tesla Wraps in 3D | Tesla Studio',
            description: 'See community Tesla wrap designs rendered on the real 3D car before you download them.',
        },
        garage: {
            title: 'My Garage | Tesla Studio',
            description: 'Your uploaded and liked Tesla wraps.',
        },
    },
    zh: {
        preview: {
            title: 'Tesla Studio | 特斯拉 3D 车衣预览与社区车衣库',
            description: '在 3D 特斯拉车模上预览车衣效果，浏览并下载数百款免费社区车衣，上传自己的贴膜图直接贴到车上看效果，并导出可安装的 PNG 素材。',
        },
        home: {
            title: 'Tesla Studio | 设计、预览并分享特斯拉车衣',
            description: '面向特斯拉车主的在线工作室：在 Model 3、Model Y、Model S、Model X 与 Cybertruck 的 3D 车模上预览车衣，浏览社区作品，导出可用于玩具盒的素材。',
        },
        create: {
            title: 'AI 特斯拉车衣生成 | Tesla Studio',
            description: '用文字描述设计，即可生成贴合车型模板的整车车衣贴图，可直接 3D 预览并导出 PNG。',
        },
        edit: {
            title: '特斯拉车衣编辑器 | Tesla Studio',
            description: '把自己的图案放到特斯拉车衣模板上，在 3D 车模上调整，并导出可用于喷漆中心的 PNG。',
        },
        explore: {
            title: '免费特斯拉车衣设计 | 社区画廊 | Tesla Studio',
            description: '浏览数百款适用于 Model 3、Model Y、Model S、Model X 与 Cybertruck 的免费车衣设计，可 3D 预览并下载 PNG。',
        },
        explore3d: {
            title: '3D 特斯拉车衣 | Tesla Studio',
            description: '下载前先在真实 3D 车模上查看社区车衣效果。',
        },
        garage: {
            title: '我的车库 | Tesla Studio',
            description: '你上传和点赞过的特斯拉车衣。',
        },
    },
});

/** Every car a wrap can be tagged with; each one gets a crawlable collection page. */
export const WRAP_MODELS = Object.freeze([
    'Cybertruck',
    'Model S (2021+)',
    'Model S Plaid (2025+)',
    'Model X (2021+)',
    'Model 3 (2024 Base)',
    'Model 3 (2024 Performance)',
    'Model 3 (Classic)',
    'Model Y (2025 Performance)',
    'Model Y (2025 Long Range)',
    'Model Y (2025 Standard)',
    'Model Y L',
    'Model Y',
]);

const WRAP_ROUTE = /^\/wrap\/([0-9a-f]{24})(?:\/[^/]*)?$/i;
const COLLECTION_ROUTE = /^\/wraps\/([a-z0-9-]+)$/;

/** Which page a path shows; unknown paths land on the preview like the old hash routes did. */
export function parseRoute(pathname) {
    const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const wrap = WRAP_ROUTE.exec(normalized);
    if (wrap) return { page: 'explore', wrapId: wrap[1], model: null };
    const collection = COLLECTION_ROUTE.exec(normalized);
    const model = collection ? modelFromSlug(collection[1]) : null;
    if (model) return { page: 'explore', wrapId: null, model };
    const page = Object.keys(PAGE_PATHS).find(key => PAGE_PATHS[key] === normalized) ?? 'preview';
    return { page, wrapId: null, model: null };
}

export function modelFromSlug(slug) {
    return WRAP_MODELS.find(model => slugify(model) === slug) ?? null;
}

/** The gallery filtered to one car, e.g. /wraps/model-3-2024-base. */
export function collectionPath(model) {
    return `/wraps/${slugify(model)}`;
}

/** Head tags and heading for one car's collection; the count is known only on the server. */
export function collectionMeta(model, count) {
    const many = typeof count === 'number' && count > 0 ? `${count} free` : 'Free';
    return {
        title: `${model} Wraps | Free Tesla Wrap Designs | Tesla Studio`,
        heading: `Free ${model} Wrap Designs`,
        description: `${many} ${model} wrap designs from the Tesla Studio community. Preview any wrap on the 3D ${model}, then download the PNG for the Tesla Toybox Colorizer.`,
        path: collectionPath(model),
    };
}

/** The bare 3D viewer for one wrap, for iframes on other sites. */
export function embedPath(wrap) {
    return `/embed/wrap/${wrap._id}`;
}

/** URL-safe tail for a wrap link; the id before it carries the identity, so non-Latin names just say "wrap". */
export function slugify(name) {
    const slug = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return slug || 'wrap';
}

export function wrapPath(wrap) {
    return `/wrap/${wrap._id}/${slugify(wrap.name)}`;
}

/** Head tags for one wrap's page; the render on the car beats the flat sheet as the preview image. */
export function wrapMeta(wrap) {
    const model = wrap.models?.[0];
    const author = wrap.author || 'Anonymous';
    return {
        title: `${wrap.name} | ${model ? `${model} Wrap` : 'Tesla Wrap'} | Tesla Studio`,
        description: `Free ${model ?? 'Tesla'} wrap design "${wrap.name}" by ${author}. Preview it in 3D on Tesla Studio and download the PNG for the Tesla Toybox Colorizer.`,
        image: wrap.renderUrl || wrap.imageUrl || '',
        path: wrapPath(wrap),
    };
}
