import Image from 'next/image'

// The Supabase Storage host is the only origin next/image is configured to
// optimise (see next.config.mjs → images.remotePatterns). Product photos
// uploaded through the app live there.
const SUPABASE_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : ''
  } catch {
    return ''
  }
})()

type ProductImageProps = {
  src: string
  alt: string
  /** Responsive sizes hint — required for a good srcset with `fill`. */
  sizes: string
  className?: string
}

/**
 * Renders a product photo. Supabase-hosted images go through next/image
 * (auto WebP/AVIF, responsive srcset, lazy loading). Any other origin — e.g.
 * a manually pasted URL — would 400 through the optimiser, so it falls back
 * to a native lazy <img> instead of breaking the card.
 *
 * The parent element must be positioned (relative/absolute/fixed) for `fill`.
 */
export default function ProductImage({ src, alt, sizes, className }: ProductImageProps) {
  const optimizable = SUPABASE_HOST !== '' && src.startsWith(`https://${SUPABASE_HOST}/`)

  if (!optimizable) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return <Image src={src} alt={alt} fill sizes={sizes} className={className} />
}
