export const SITE_URL = 'https://www.teslastudio.online/';
export const SITE_IMAGE = `${SITE_URL}preview.png`;

export const SEO_COPY = {
    en: {
        title: 'Tesla Wrap Studio | 3D Tesla Wrap, Plate & Lock Sound Designer',
        description:
            'Design custom Tesla wraps in 2D and 3D, browse community wrap ideas, create custom license plate artwork, and prepare Tesla lock sound files for your USB drive.',
        heading: 'Tesla Wrap Studio',
        intro:
            'A browser-based studio for Tesla owners and wrap creators to design custom wraps, preview artwork on 3D Tesla models, explore community designs, and export installation-ready graphics.',
        features: [
            'Create Tesla Model 3, Model Y, and Cybertruck wrap concepts with image upload, drawing tools, and AI pattern generation.',
            'Preview compatible wraps in 3D before exporting PNG artwork for the Tesla Toybox Colorizer workflow.',
            'Browse and share community Tesla wrap designs, custom license plate graphics, and lock sound ideas.'
        ],
        faq: [
            {
                question: 'What can I design with Tesla Wrap Studio?',
                answer:
                    'You can design Tesla wraps, preview selected models in 3D, create custom license plate artwork, and share or download community wrap and lock sound ideas.'
            },
            {
                question: 'Which Tesla models are supported?',
                answer:
                    'The studio includes Cybertruck, Model 3, Model Y, 2024 Model 3 variants, 2025 Model Y variants, and Model Y L options.'
            },
            {
                question: 'How do I use an exported Tesla wrap?',
                answer:
                    'Export the wrap as a PNG, place it in a Wraps folder on a USB drive, plug the USB drive into your Tesla, then open Toybox, Colorizer, and Customize Wrap.'
            }
        ]
    },
    zh: {
        title: 'Tesla Wrap Studio | 特斯拉 3D 车衣、车牌与锁车音效设计工具',
        description:
            '在线设计特斯拉自定义车衣，使用 2D/3D 预览效果，浏览社区作品，制作自定义车牌图片，并准备可放入 U 盘的特斯拉锁车音效文件。',
        heading: 'Tesla Wrap Studio 特斯拉车衣设计工具',
        intro:
            '面向特斯拉车主和车衣创作者的在线设计工作室，可制作 Model 3、Model Y、Cybertruck 车衣方案，预览 3D 效果，浏览社区作品，并导出可安装的图片素材。',
        features: [
            '支持上传图片、自由绘制和 AI 图案生成，用于创建特斯拉 Model 3、Model Y 与 Cybertruck 车衣概念。',
            '在导出 PNG 前预览部分车型的 3D 车衣效果，适配 Tesla Toybox 喷漆中心自定义车衣流程。',
            '浏览和分享社区车衣、自定义车牌图片与锁车音效灵感。'
        ],
        faq: [
            {
                question: 'Tesla Wrap Studio 可以做什么？',
                answer:
                    '你可以在线设计特斯拉车衣，预览 3D 效果，制作自定义车牌图片，并浏览、分享或下载社区车衣和锁车音效创意。'
            },
            {
                question: '支持哪些特斯拉车型？',
                answer:
                    '当前包含 Cybertruck、Model 3、Model Y、2024 Model 3、2025 Model Y 以及 Model Y L 等车型选项。'
            },
            {
                question: '导出的特斯拉车衣怎么使用？',
                answer:
                    '导出 PNG 图片后，在 U 盘中新建 Wraps 文件夹并放入图片，插入特斯拉车机后进入玩具盒、喷漆中心、自定义车衣。'
            }
        ]
    }
} as const;

export type SeoLanguage = keyof typeof SEO_COPY;
