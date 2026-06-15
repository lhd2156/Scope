import { sanitizeScopeAiVisibleText } from '@/services/scopeAiSafety';

export interface ChatAttachment {
  id: string;
  base64Data?: string;
  name: string;
  previewUrl: string;
  size: number;
  type: string;
}

export interface SubmittedChatTurn {
  submittedPrompt: string;
  assistantPrompt: string;
  submittedAttachments: ChatAttachment[];
}

export interface SubmittedUserChatMessage {
  id: string;
  role: 'user';
  content: string;
  attachments?: ChatAttachment[];
}

export function getDefaultAttachmentPrompt(attachments: ChatAttachment[]): string {
  return attachments.length === 1 ? 'Review this image for my trip.' : 'Review these images for my trip.';
}

export function buildPromptWithAttachmentContext(userPrompt: string, attachments: ChatAttachment[]): string {
  if (!attachments.length) {
    return userPrompt;
  }

  const imageSummary = attachments
    .map((attachment, index) => `${index + 1}. ${attachment.name}`)
    .join('\n');

  return [
    userPrompt,
    `Attached images:\n${imageSummary}`,
    'Use the image context if the vision-enabled Scope agent is available. If image analysis is unavailable, say what extra detail you need from the traveler.',
  ].join('\n\n');
}

export function readSubmittedChatTurn(promptText: string, attachments: ChatAttachment[]): SubmittedChatTurn | null {
  const trimmedPrompt = promptText.trim();
  const submittedAttachments = attachments;
  const submittedPrompt = trimmedPrompt || (submittedAttachments.length ? getDefaultAttachmentPrompt(submittedAttachments) : '');

  if (!submittedPrompt && !submittedAttachments.length) {
    return null;
  }

  return {
    submittedPrompt,
    assistantPrompt: buildPromptWithAttachmentContext(submittedPrompt, submittedAttachments),
    submittedAttachments,
  };
}

export function buildSubmittedUserMessage(interactionId: string, turn: SubmittedChatTurn): SubmittedUserChatMessage {
  return {
    id: `${interactionId}-user`,
    role: 'user',
    content: sanitizeScopeAiVisibleText(turn.submittedPrompt),
    attachments: turn.submittedAttachments,
  };
}
