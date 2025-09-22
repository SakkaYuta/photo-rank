import { useEffect, useState } from 'react'

type Props = {
  photo: { title: string; watermarked_url?: string; original_url?: string }
  isOwner: boolean
}

export const ProductPreview = ({ photo, isOwner }: Props) => {
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    if (!isOwner && photo.watermarked_url) setImageUrl(photo.watermarked_url)
    else if (isOwner && photo.original_url) setImageUrl(photo.original_url)
  }, [photo, isOwner])

  return (
    <div className="relative">
      {imageUrl && (
        <img src={imageUrl} alt={photo.title} className="w-full h-auto rounded" />
      )}
      {!isOwner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white text-4xl sm:text-6xl opacity-30" style={{ transform: 'rotate(45deg)' }}>
            SAMPLE
          </span>
        </div>
      )}
    </div>
  )
}

export default ProductPreview

