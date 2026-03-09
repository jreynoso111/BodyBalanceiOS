import { decode } from 'base64-arraybuffer';
import { supabase } from '@/services/supabase';

const AVATAR_BUCKET = 'avatars';

export const isMissingAvatarUrlColumn = (message?: string) =>
  String(message || '').toLowerCase().includes('avatar_url');

export const getProfileAvatarPublicUrl = (path?: string | null) => {
  if (!path) return null;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadProfileAvatar = async (options: {
  userId: string;
  base64: string;
  mimeType?: string | null;
}) => {
  const extension = getFileExtension(options.mimeType);
  const filePath = `${options.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, decode(options.base64), {
      contentType: options.mimeType || getContentType(extension),
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
};

export const removeProfileAvatar = async (path?: string | null) => {
  if (!path) return;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) {
    console.error('profile avatar remove failed:', error.message);
  }
};

const getFileExtension = (mimeType?: string | null) => {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    default:
      return 'jpg';
  }
};

const getContentType = (extension: string) => {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
};
