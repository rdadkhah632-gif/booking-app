import { useI18n } from '@/lib/useI18n'
import ServiceImageUpload from './ServiceImageUpload'
import ServicePreviewCard from './ServicePreviewCard'

type Props = {
  formExpanded: boolean
  loading: boolean
  uploadingImage: boolean
  name: string
  description: string
  imageUrl: string
  imagePreviewUrl: string
  imageFile: File | null
  duration: number
  price: number
  durationOptions: () => number[]
  setFormExpanded: (value: boolean | ((previous: boolean) => boolean)) => void
  setName: (value: string) => void
  setDescription: (value: string) => void
  setDuration: (value: number) => void
  setPrice: (value: number) => void
  handleCreateImageChange: (file: File | null) => void
  uploadCreateImage: () => void
  clearCreateImage: () => void
  resetForm: () => void
  addService: (event: React.FormEvent) => void
}

export default function CreateServiceCard({
  formExpanded,
  loading,
  uploadingImage,
  name,
  description,
  imageUrl,
  imagePreviewUrl,
  imageFile,
  duration,
  price,
  durationOptions,
  setFormExpanded,
  setName,
  setDescription,
  setDuration,
  setPrice,
  handleCreateImageChange,
  uploadCreateImage,
  clearCreateImage,
  resetForm,
  addService
}: Props) {
  const { t } = useI18n()

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="services-form-header" style={{ marginBottom: formExpanded ? '1rem' : 0 }}>
        <div>
          <p className="small muted">{t('dashboardServices.create.kicker', 'Create service')}</p>

          <h3 style={{ marginTop: '0.25rem' }}>
            {t('dashboardServices.create.title', 'Add a new service')}
          </h3>

          <p className="muted small" style={{ marginTop: '0.35rem' }}>
            {t(
              'dashboardServices.create.body',
              'Keep service names simple. Customers should understand what they are booking without needing to ask.'
            )}
          </p>
        </div>

        <button type="button" onClick={() => setFormExpanded((prev) => !prev)} className="btn btn-ghost">
          {formExpanded
            ? t('dashboardServices.create.collapse', 'Collapse form')
            : t('dashboardServices.create.addService', 'Add service')}
        </button>
      </div>

      {formExpanded && (
        <form onSubmit={addService} style={{ display: 'grid', gap: '1rem' }}>
          <div className="services-create-grid">
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <input
                placeholder={t('dashboardServices.create.namePlaceholder', 'Service name e.g. Haircut, Dental Checkup')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="services-create-small-grid">
                <label className="small muted">
                  {t('dashboardServices.create.duration', 'Duration')}
                  <input
                    type="number"
                    placeholder={t('dashboardServices.create.durationPlaceholder', 'Duration in minutes')}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    min={5}
                    required
                    style={{ marginTop: '0.35rem' }}
                  />

                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    style={{ marginTop: '0.35rem' }}
                  >
                    {durationOptions().map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} {t('common.minutes', 'minutes')}</option>
                    ))}
                  </select>
                </label>

                <label className="small muted">
                  {t('dashboardServices.create.price', 'Price')}
                  <input
                    type="number"
                    placeholder={t('dashboardServices.create.pricePlaceholder', 'Price')}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    min={0}
                    step="0.01"
                    required
                    style={{ marginTop: '0.35rem' }}
                  />
                </label>
              </div>

              <ServiceImageUpload
                mode="create"
                imageUrl={imageUrl}
                imagePreviewUrl={imagePreviewUrl}
                imageFile={imageFile}
                uploading={uploadingImage}
                onCreateImageChange={handleCreateImageChange}
                onUploadCreate={uploadCreateImage}
                onClearCreate={clearCreateImage}
              />

              <textarea
                placeholder={t('dashboardServices.create.descriptionPlaceholder', 'Short description shown to customers optional')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <ServicePreviewCard
              name={name}
              duration={duration}
              price={price}
              description={description}
              imageUrl={imagePreviewUrl || imageUrl}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="submit" disabled={loading} className="btn btn-accent">
              {loading ? t('dashboardServices.create.adding', 'Adding...') : t('dashboardServices.create.addService', 'Add service')}
            </button>

            <button type="button" onClick={resetForm} className="btn btn-ghost">
              {t('dashboardServices.create.clearForm', 'Clear form')}
            </button>
          </div>
        </form>
      )}

      <style jsx>{`
        .services-form-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .services-create-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
          gap: 1rem;
          align-items: start;
        }

        .services-create-small-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }

        @media (max-width: 860px) {
          .services-create-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}