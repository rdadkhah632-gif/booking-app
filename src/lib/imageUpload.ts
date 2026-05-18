import { supabase } from '@/lib/supabaseClient'

const IMAGE_BUCKET = 'mirebook-images'

export type ImageUploadFolder = 'businesses' | 'services' | 'staff'

function safeFileExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return extension === 'jpg' ? 'jpeg' : extension
  }

  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'

  return 'jpeg'
}

export function validateImageFile(file: File) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const maxSize = 5 * 1024 * 1024

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Please upload a JPG, PNG, WEBP or GIF image.')
  }

  if (file.size > maxSize) {
    throw new Error('Image must be 5MB or smaller.')
  }
}

export async function uploadMirebookImage(params: {
  file: File
  folder: ImageUploadFolder
  recordId?: string | null
}) {
  validateImageFile(params.file)

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (!session) throw new Error('You must be logged in to upload images.')

  const extension = safeFileExtension(params.file)
  const recordPart = params.recordId || 'new'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  const path = `${session.user.id}/${params.folder}/${recordPart}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, params.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: params.file.type
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path)

  return {
    path,
    publicUrl: data.publicUrl
  }
}