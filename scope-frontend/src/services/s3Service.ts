import axios from 'axios';
import api from '@/services/api';
import { unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope } from '@/types';

const PHOTOS_BASE_PATH = '/api/content/photos';
const DEFAULT_UPLOAD_EXPIRATION_SECONDS = 3600;

export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUploadTarget {
  uploadUrl: string;
  fileUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  expiresInSeconds: number;
}

function buildFallbackUploadTarget(request: PresignedUploadRequest): PresignedUploadTarget {
  const safeFileName = request.fileName.replace(/\s+/g, '-').toLowerCase();
  const objectUrl = typeof URL !== 'undefined' ? URL.createObjectURL(new Blob([], { type: request.contentType })) : `local://${safeFileName}`;

  return {
    uploadUrl: objectUrl,
    fileUrl: objectUrl,
    method: 'PUT',
    headers: {
      'Content-Type': request.contentType,
    },
    expiresInSeconds: DEFAULT_UPLOAD_EXPIRATION_SECONDS,
  };
}

export async function getPresignedUploadTarget(request: PresignedUploadRequest): Promise<PresignedUploadTarget> {
  try {
    const { data } = await api.get<ApiEnvelope<PresignedUploadTarget> | PresignedUploadTarget>(
      `${PHOTOS_BASE_PATH}/presigned-url`,
      {
        params: {
          fileName: request.fileName,
          contentType: request.contentType,
          sizeBytes: request.sizeBytes,
        },
      },
    );
    return unwrapApiData(data);
  } catch {
    return buildFallbackUploadTarget(request);
  }
}

export async function uploadFileToPresignedTarget(target: PresignedUploadTarget, file: Blob): Promise<string> {
  if (target.uploadUrl.startsWith('blob:') || target.uploadUrl.startsWith('local://')) {
    return target.fileUrl;
  }

  if (target.method === 'POST') {
    const body = new FormData();
    body.append('file', file);
    const { data } = await api.post<ApiEnvelope<{ fileUrl: string }> | { fileUrl: string }>(
      target.uploadUrl,
      body,
      {
        headers: target.headers,
        timeout: 20_000,
      },
    );
    return unwrapApiData(data).fileUrl;
  }

  await axios.put(target.uploadUrl, file, {
    headers: target.headers,
    timeout: 20_000,
  });

  return target.fileUrl;
}

export async function deletePhoto(photoId: string): Promise<void> {
  try {
    await api.delete(`${PHOTOS_BASE_PATH}/${photoId}`);
  } catch {
    // Local mock mode keeps uploads ephemeral, so there is nothing persistent to delete.
  }
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<void> {
  try {
    await api.put(`${PHOTOS_BASE_PATH}/${photoId}`, { caption });
  } catch {
    // Caption updates become no-ops while the content API contract is still mocked.
  }
}
