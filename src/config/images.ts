// Centralized image processing configuration
// Used by UI or server/Edge functions to keep sizes/paths/names consistent.

export type ThumbSize = {
  key: 'sm' | 'md' | 'lg'
  w: number
  h: number
  format: 'webp' | 'jpg' | 'png'
}

export const ImageConfig = {
  thumbnails: {
    sizes: [
      { key: 'sm', w: 320, h: 240, format: 'webp' } as ThumbSize,
      { key: 'md', w: 640, h: 480, format: 'webp' } as ThumbSize,
      { key: 'lg', w: 1280, h: 960, format: 'webp' } as ThumbSize,
    ],
    path: (entity: 'works' | 'products', id: string, key: ThumbSize['key']) =>
      `thumbnails/${entity}/${id}/${key}`,
    filename: (hash: string, w: number, h: number, ext: string) =>
      `${hash}_${w}x${h}.${ext}`,
  },
  watermarks: {
    opacity: 0.3,
    text: 'SAMPLE',
    position: 'center' as const,
    path: (creatorId: string, workId: string, size: 'sm' | 'md' | 'lg') =>
      `works/${creatorId}/${workId}/${size}`,
    filename: (hash: string) => `wm_${hash}.jpg`,
  },
}

export default ImageConfig

