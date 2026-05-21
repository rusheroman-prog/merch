'use client'

import { useState, type ChangeEvent, type CSSProperties } from 'react'

type ProductImageUploaderProps = {
  value: string
  onChange: (url: string) => void
  productId?: string
  label?: string
}

export default function ProductImageUploader({
  value,
  onChange,
  productId,
  label = 'Фото товара',
}: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      if (productId) {
        formData.append('productId', productId)
      }

      const response = await fetch('/api/admin/product-image', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось загрузить фото')
        return
      }

      onChange(result.url)
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : 'Неизвестная ошибка'

      setError(message)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>
        {label}

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          disabled={isUploading}
          style={styles.fileInput}
        />
      </label>

      {value ? (
        <div style={styles.previewBox}>
          <img src={value} alt="Фото товара" style={styles.previewImage} />

          <div style={styles.urlBox}>
            <div style={styles.urlLabel}>URL изображения</div>

            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              style={styles.urlInput}
            />
          </div>
        </div>
      ) : (
        <div style={styles.emptyPreview}>
          <div style={styles.emptyIcon}>+</div>
          <div>
            <b>Фото не загружено</b>
            <span>Выберите файл JPG, PNG, WEBP или GIF до 5 MB.</span>
          </div>
        </div>
      )}

      {isUploading && <div style={styles.info}>Загружаем фото...</div>}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#4b4259',
    fontSize: '14px',
    fontWeight: 950,
  },
  fileInput: {
    minHeight: '48px',
    borderRadius: '16px',
    border: '1px solid rgba(109,40,217,0.14)',
    padding: '12px',
    fontSize: '14px',
    background: '#ffffff',
    color: '#4b4259',
    cursor: 'pointer',
  },
  previewBox: {
    display: 'grid',
    gridTemplateColumns: '136px minmax(0, 1fr)',
    gap: '14px',
    alignItems: 'center',
    background: '#f8f7ff',
    border: '1px solid rgba(109,40,217,0.08)',
    borderRadius: '20px',
    padding: '12px',
  },
  previewImage: {
    width: '136px',
    height: '102px',
    objectFit: 'cover',
    borderRadius: '16px',
    background: '#e5e7eb',
    boxShadow: '0 12px 28px rgba(44,20,76,0.1)',
  },
  urlBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    minWidth: 0,
  },
  urlLabel: {
    color: '#8a8197',
    fontSize: '11px',
    fontWeight: 950,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  urlInput: {
    height: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(109,40,217,0.14)',
    padding: '0 12px',
    fontSize: '13px',
    background: '#ffffff',
    minWidth: 0,
    color: '#18111f',
    fontWeight: 700,
  },
  emptyPreview: {
    background: '#f8f7ff',
    border: '1px dashed rgba(109,40,217,0.22)',
    borderRadius: '20px',
    padding: '14px',
    color: '#6b6078',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  emptyIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '14px',
    background: '#ede9fe',
    color: '#6d28d9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 950,
    flex: '0 0 auto',
  },
  info: {
    background: '#eef2ff',
    color: '#3730a3',
    padding: '11px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 800,
  },
  error: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '11px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 800,
  },
}