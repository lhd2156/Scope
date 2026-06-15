import type { ScopeAiImageInput } from '@/services/scopeAiService';
import type { ChatAttachment } from '@/components/trips/tripAiChatTurn';

export const MAX_IMAGE_ATTACHMENTS = 3;
export const MAX_SCOPE_AI_IMAGE_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;
export const SUPPORTED_SCOPE_AI_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function resolveSupportedScopeAiImageMimeType(file: File): string | null {
  const mimeType = file.type.trim().toLowerCase();
  if (SUPPORTED_SCOPE_AI_IMAGE_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }

  if (/\.jpe?g$/i.test(file.name)) {
    return 'image/jpeg';
  }
  if (/\.png$/i.test(file.name)) {
    return 'image/png';
  }
  if (/\.webp$/i.test(file.name)) {
    return 'image/webp';
  }

  return null;
}

export function isImageFile(file: File): boolean {
  return Boolean(resolveSupportedScopeAiImageMimeType(file)) && file.size <= MAX_SCOPE_AI_IMAGE_ATTACHMENT_BYTES;
}

export function createAttachmentPreviewUrl(file: File): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }

  return URL.createObjectURL(file);
}

export function revokeAttachmentPreview(attachment: ChatAttachment): void {
  if (!attachment.previewUrl || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return;
  }

  URL.revokeObjectURL(attachment.previewUrl);
}

export function readImageFileAsBase64(file: File): Promise<string | undefined> {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',').pop() || undefined : result || undefined);
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

export async function buildChatAttachmentFromFile(file: File, idFactory: () => string): Promise<ChatAttachment> {
  const mimeType = resolveSupportedScopeAiImageMimeType(file) ?? file.type;
  return {
    id: idFactory(),
    base64Data: await readImageFileAsBase64(file),
    name: file.name || 'Attached image',
    previewUrl: createAttachmentPreviewUrl(file),
    size: file.size,
    type: mimeType || 'image',
  };
}

export function buildScopeAiImagePayload(attachments: ChatAttachment[]): ScopeAiImageInput[] {
  return attachments
    .filter((attachment) => (
      attachment.base64Data &&
      SUPPORTED_SCOPE_AI_IMAGE_MIME_TYPES.has(attachment.type) &&
      attachment.size <= MAX_SCOPE_AI_IMAGE_ATTACHMENT_BYTES
    ))
    .slice(0, MAX_IMAGE_ATTACHMENTS)
    .map((attachment) => ({
      filename: attachment.name,
      mime_type: attachment.type,
      data: attachment.base64Data as string,
    }));
}
