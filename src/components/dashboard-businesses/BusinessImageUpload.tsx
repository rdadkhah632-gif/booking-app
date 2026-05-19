import { useI18n } from '@/lib/useI18n'
import { Business } from './dashboardBusinessesTypes'

type Props = {
  business: Business
  uploadingBusinessId: string | null
  onUpload: (business: Business, file: File | null) => void
  onRemove: (business: Business) => void
}

export default function BusinessImageUpload({
  business,
  uploadingBusinessId,
  onUpload,
  onRemove
}: Props) {
  const { t } = useI18n()
  const uploading = uploadingBusinessId === business.id

  return (
    <div className="image-upload-box" style={{ marginTop: '0.75rem' }}>
      <div>
        <p className="small muted">
          {t('dashboardBusinesses.image.kicker', 'Business image')}
        </p>

        <strong>
          {business.image_url
            ? t('dashboardBusinesses.image.replace', 'Replace uploaded image')
            : t('dashboardBusinesses.image.upload', 'Upload from your device')}
        </strong>

        <p className="small muted" style={{ marginTop: '0.25rem' }}>
          {t(
            'dashboardBusinesses.image.body',
            'JPG, PNG, WEBP or GIF up to 5MB. This image appears on the marketplace and public booking page.'
          )}
        </p>
      </div>

      {business.image_url && (
        <div
          className="image-preview"
          style={{ backgroundImage: `url(${business.image_url})` }}
        />
      )}

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => onUpload(business, e.target.files?.[0] || null)}
        disabled={uploading}
      />

      <div className="image-upload-actions">
        {uploading && (
          <p className="small muted">
            {t('dashboardBusinesses.image.uploading', 'Uploading image...')}
          </p>
        )}

        {business.image_url && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onRemove(business)}
          >
            {t('dashboardBusinesses.image.remove', 'Remove image')}
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
          min-height: 170px;
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
          align-items: center;
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