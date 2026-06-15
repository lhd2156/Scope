import { ref, type Ref } from 'vue';
import {
  MAX_IMAGE_ATTACHMENTS,
  isImageFile,
  revokeAttachmentPreview,
} from '@/components/trips/tripAiAttachments';
import type { ChatAttachment } from '@/components/trips/tripAiChatTurn';

interface UseTripAiAttachmentsOptions {
  loading: Ref<boolean>;
  buildAttachment: (file: File) => Promise<ChatAttachment>;
}

export function useTripAiAttachments(options: UseTripAiAttachmentsOptions) {
  const attachmentInput = ref<HTMLInputElement | null>(null);
  const pendingAttachments = ref<ChatAttachment[]>([]);

  function openAttachmentPicker(): void {
    if (options.loading.value) {
      return;
    }

    attachmentInput.value?.click();
  }

  async function handleAttachmentChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - pendingAttachments.value.length);
    const imageFiles = Array.from(input.files ?? [])
      .filter(isImageFile)
      .slice(0, remainingSlots);

    if (imageFiles.length) {
      const attachments = await Promise.all(imageFiles.map(options.buildAttachment));
      pendingAttachments.value = [
        ...pendingAttachments.value,
        ...attachments,
      ];
    }

    input.value = '';
  }

  function removePendingAttachment(attachmentId: string): void {
    const attachment = pendingAttachments.value.find((item) => item.id === attachmentId);
    if (attachment) {
      revokeAttachmentPreview(attachment);
    }

    pendingAttachments.value = pendingAttachments.value.filter((item) => item.id !== attachmentId);
  }

  return {
    attachmentInput,
    pendingAttachments,
    openAttachmentPicker,
    handleAttachmentChange,
    removePendingAttachment,
  };
}
