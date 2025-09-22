import type { Work } from '@/types'

export const SAMPLE_WORKS: Work[] = [
  {
    id: 'demo-work-1',
    title: '桜の季節',
    description: '春の美しい桜並木を撮影しました',
    creator_id: 'demo-user-1',
    price: 2500,
    image_url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=600&h=400&fit=crop',
    category: 'photo',
    tags: ['spring','sakura'],
    is_active: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86000000).toISOString(),
  } as any,
  {
    id: 'demo-work-2',
    title: '夕暮れの街',
    description: '都市の夕暮れ時の美しい景色',
    creator_id: 'demo-user-2',
    price: 3000,
    image_url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=600&h=400&fit=crop',
    category: 'photo',
    tags: ['city','sunset'],
    is_active: true,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172000000).toISOString(),
  } as any,
  {
    id: 'demo-work-3',
    title: '海辺の朝',
    description: '清々しい朝の海辺の写真',
    creator_id: 'demo-user-3',
    price: 2800,
    image_url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=600&h=400&fit=crop',
    category: 'photo',
    tags: ['sea','morning'],
    is_active: true,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 258000000).toISOString(),
  } as any
]

