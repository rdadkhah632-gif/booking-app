import { useI18n } from '@/lib/useI18n'
import { Service } from './dashboardServicesTypes'

type Props = {
  mode: 'create' | 'edit'
  service?: Service
  imageUrl?: string
  imagePreviewUrl?: string
  imageFile?: File | null
  uploading: boolean
  onCreateImageChange?: (file: File | null) => void
  onUploadCreate?: () => void
  onClearCreate?: () => void
  onUploadService?: (service: Service, file: File | null) => void
  onRemoveService?: (service: Service) => void
}

export default function ServiceImageUpload({
  mode,
  service,
  imageUrl = '',
  imagePreviewUrl = '',
  uploading,
  onCreateImageChange,
  onUploadCreate,
  onClearCreate,
  onUploadService,
  onRemoveService
}: Props) {
  const { t } = useI18n()
  const displayUrl = mode === 'create' ? imagePreviewUrl || imageUrl : service?.image_url || ''

  return (
    <div className="image-upload-box">
      <div>
        <p className="small muted">{t('dashboardServices.image.kicker', 'Service image')}</p>

        <strong>
          {mode === 'create'
            ? t('dashboardServices.image.uploadFromDevice', 'Upload from your device')
            : service?.image_url
              ? t('dashboardServices.image.replace', 'Replace uploaded image')
              : t('dashboardServices.image.upload', 'Upload image')}
        </strong>

        <p className="small muted" style={{ marginTop: '0.25rem' }}>
          {t('dashboardServices.image.body', 'JPG, PNG, WEBP or GIF up to 5MB.')}
        </p>
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0] || null
          if (mode === 'create') onCreateImageChange?.(file)
          if (mode === 'edit' && service) onUploadService?.(service, file)
        }}
        disabled={uploading}
      />

      {displayUrl && (
        <div
          className="image-preview"
          style={{ backgroundImage: `url(${displayUrl})` }}
        />
      )}

      <div className="image-upload-actions">
        {mode === 'create' && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onUploadCreate}
            disabled={uploading}
          >
            {uploading
              ? t('dashboardServices.image.uploading', 'Uploading...')
              : imageUrl
                ? t('dashboardServices.image.replaceButton', 'Replace image')
                : t('dashboardServices.image.uploadButton', 'Upload image')}
          </button>
        )}

        {mode === 'edit' && uploading && (
          <p className="small muted">{t('dashboardServices.image.uploadingImage', 'Uploading image...')}</p>
        )}

        {displayUrl && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (mode === 'create') onClearCreate?.()
              if (mode === 'edit' && service) onRemoveService?.(service)
            }}
          >
            {t('dashboardServices.image.remove', 'Remove image')}
          </button>
        )}
      </div>

      <style jsx>{`
        .image-upload-box {
          display: grid;
          gap: 0.75rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
        }

        .image-preview {
          min-height: 150px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background-size: cover;
          background-position: center;
          background-color: var(--surface);
        }

        .image-upload-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        @media (max-width: 640px) {
          .image-upload-actions,
          .image-upload-actions :global(.btn),
          .image-upload-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}