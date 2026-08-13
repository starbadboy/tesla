export const SITE_URL = 'https://www.teslastudio.online/';
export const SITE_IMAGE = `${SITE_URL}preview.png`;

export const SEO_COPY = {
    en: {
        title: 'Tesla Studio | 3D Tesla Wrap Preview & Community Wrap Library',
        description:
            'Preview Tesla wraps on a 3D model, browse and download hundreds of free community wrap designs, upload your own sheet to see it on the car, and export installation-ready PNG artwork.',
        heading: 'Tesla Studio',
        intro:
            'A browser-based studio for Tesla owners and wrap creators: preview wraps on 3D Tesla models, explore community designs, and export installation-ready graphics.',
        features: [
            'Preview wraps on 3D Tesla models: Model 3, Model Y, Model S, Model X, and Cybertruck.',
            'Upload your own full-wrap sheet and see it on the car before exporting PNG artwork for the Tesla Toybox Colorizer workflow.',
            'Browse, download and share hundreds of free community Tesla wrap designs.'
        ],
        faq: [
            {
                question: 'What can I do with Tesla Studio?',
                answer:
                    'You can preview any community wrap on a 3D Tesla model, upload your own full-wrap sheet to see it on the car, download wraps as PNG artwork, and share your own designs with the community.'
            },
            {
                question: 'Which Tesla models are supported?',
                answer:
                    'Cybertruck, Model 3, Model S, Model X and Model Y, including the 2024 Model 3 and 2025 Model Y variants. A few variants have no 3D asset yet and say so on the stage.'
            },
            {
                question: 'How do I use an exported Tesla wrap?',
                answer:
                    'Export the wrap as a PNG, place it in a Wraps folder on a USB drive, plug the USB drive into your Tesla, then open Toybox, Colorizer, and Customize Wrap.'
            }
        ]
    },
    zh: {
        title: 'Tesla Studio | 特斯拉 3D 车衣预览与社区车衣库',
        description:
            '在 3D 特斯拉车模上预览车衣效果，浏览并下载数百款免费社区车衣，上传自己的贴膜图直接贴到车上看效果，并导出可安装的 PNG 素材。',
        heading: 'Tesla Studio 特斯拉车衣预览工具',
        intro:
            '面向特斯拉车主和车衣创作者的在线工作室：在 3D 车模上预览车衣效果，浏览社区作品，并导出可安装的图片素材。',
        features: [
            '在 3D 车模上预览车衣效果，支持 Model 3、Model Y、Model S、Model X 与 Cybertruck。',
            '上传自己的全车贴膜图，先在车上看效果，再导出 PNG 用于 Tesla Toybox 喷漆中心自定义车衣流程。',
            '浏览、下载并分享数百款免费社区特斯拉车衣。'
        ],
        faq: [
            {
                question: 'Tesla Studio 可以做什么？',
                answer:
                    '你可以在 3D 车模上预览任意社区车衣，上传自己的全车贴膜图看实车效果，把车衣下载为 PNG 素材，也可以把自己的作品分享到社区。'
            },
            {
                question: '支持哪些特斯拉车型？',
                answer:
                    '包含 Cybertruck、Model 3、Model S、Model X 与 Model Y，以及 2024 Model 3 和 2025 Model Y 的各版本。少数版本暂无 3D 模型，界面会直接标注。'
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
