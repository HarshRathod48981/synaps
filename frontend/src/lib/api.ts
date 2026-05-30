/**
 * Synaps API Client
 */

const API_BASE = '/api';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'API Error');
  }
  return res.json();
}

// Media / Timeline
export async function getTimeline(params: {
  page?: number;
  per_page?: number;
  media_type?: string;
  year?: number;
  month?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.per_page) searchParams.set('per_page', String(params.per_page));
  if (params.media_type) searchParams.set('media_type', params.media_type);
  if (params.year) searchParams.set('year', String(params.year));
  if (params.month) searchParams.set('month', String(params.month));
  return fetchAPI(`/media/timeline?${searchParams.toString()}`);
}

export async function getMediaItem(id: string) {
  return fetchAPI(`/media/item/${id}`);
}

export async function getMediaStats() {
  return fetchAPI('/media/stats');
}

export async function toggleFavorite(id: string) {
  return fetchAPI(`/media/favorite/${id}`, { method: 'POST' });
}

export function getThumbnailUrl(id: string) {
  return `${API_BASE}/media/thumbnail/${id}`;
}

export function getFileUrl(id: string) {
  // Cache-bust to avoid stale 500 responses from previous backend versions
  return `${API_BASE}/media/file/${id}?_v=2`;
}

export function getStreamUrl(id: string) {
  return `${API_BASE}/media/stream/${id}`;
}

// Finder
export async function browseDirectory(path: string = '') {
  return fetchAPI(`/finder/browse?path=${encodeURIComponent(path)}`);
}

export async function getDirectoryTree(depth: number = 2) {
  return fetchAPI(`/finder/tree?depth=${depth}`);
}

// Search
export async function searchMedia(query: string, mediaType?: string) {
  const params = new URLSearchParams({ q: query });
  if (mediaType) params.set('media_type', mediaType);
  return fetchAPI(`/search/?${params.toString()}`);
}

export async function getSearchSuggestions(query: string) {
  return fetchAPI(`/search/suggestions?q=${encodeURIComponent(query)}`);
}

// Sync
export async function uploadFile(file: File, device: string = 'iPhone') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('device', device);
  return fetch(`${API_BASE}/sync/upload`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json());
}

export async function getSyncHistory() {
  return fetchAPI('/sync/history');
}

// Trash
export async function getTrash() {
  return fetchAPI('/trash/');
}

export async function moveToTrash(mediaId: string) {
  return fetchAPI(`/trash/delete/${mediaId}`, { method: 'POST' });
}

export async function restoreFromTrash(trashId: string) {
  return fetchAPI(`/trash/restore/${trashId}`, { method: 'POST' });
}

export async function permanentDelete(trashId: string) {
  return fetchAPI(`/trash/permanent/${trashId}`, { method: 'DELETE' });
}

// Settings
export async function getSettings() {
  return fetchAPI('/settings/');
}

export async function updateSettings(data: Record<string, string>) {
  return fetchAPI('/settings/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getStorageUsage() {
  return fetchAPI('/settings/storage-usage');
}

// Import Manager
export interface ImportScanResult {
  total_files: number;
  photos: number;
  videos: number;
  total_size: number;
  total_size_human: string;
  source_dir: string;
}

export interface ImportPreviewResult {
  destinations: { path: string; count: number }[];
  total_files: number;
  unknown_date: number;
}

export interface ImportProgress {
  job_id: string;
  status: 'pending' | 'scanning' | 'importing' | 'indexing' | 'complete' | 'error' | 'none';
  phase: string;
  progress: number;
  total_files: number;
  processed_files: number;
  imported: number;
  duplicates_skipped: number;
  unknown_date: number;
  errors: number;
  error_log: string[];
  started_at: string | null;
  completed_at: string | null;
}

export async function scanImports(): Promise<ImportScanResult> {
  return fetchAPI('/import/scan', { method: 'POST' });
}

export async function previewImports(): Promise<ImportPreviewResult> {
  return fetchAPI('/import/preview', { method: 'POST' });
}

export async function executeImport(): Promise<{ status: string; job_id: string }> {
  return fetchAPI('/import/execute', { method: 'POST' });
}

export async function getImportProgress(jobId: string): Promise<ImportProgress> {
  return fetchAPI(`/import/progress/${jobId}`);
}

export async function getLatestImport(): Promise<ImportProgress> {
  return fetchAPI('/import/latest');
}

// Health
export async function checkHealth() {
  return fetchAPI('/health');
}

// Trigger scan
export async function triggerScan() {
  return fetchAPI('/scan', { method: 'POST' });
}
