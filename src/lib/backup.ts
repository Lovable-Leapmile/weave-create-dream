// Backup and restore utilities for localStorage data

import JSZip from 'jszip';
import { getDocuments, saveDocument, type Document } from './localStorage';
import {
  getAssetDataUrl,
  saveAssetFromDataUrl,
  getAsset,
  saveAsset,
} from './assetStorage';

export interface BackupAsset {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  data: string;
}

export interface BackupData {
  version: string;
  timestamp: string;
  documents: Document[];
  assets: BackupAsset[];
}

interface AssetManifestEntry {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  filePath: string;
}

type BlockLike = {
  attachmentId?: string;
  attachmentData?: string;
  [key: string]: unknown;
};

type SectionLike = {
  content?: BlockLike[];
  children?: SectionLike[];
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sanitizeFileName = (name: string): string => {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180) || "asset";
};

const sanitizeSectionsForExport = (sections: SectionLike[] | undefined): SectionLike[] => {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => {
    const sanitizedSection: SectionLike = { ...section };
    sanitizedSection.content = Array.isArray(section.content)
      ? section.content.map((block) => {
          const { attachmentData: _unusedAttachmentData, ...rest } = block;
          return { ...rest };
        })
      : [];
    sanitizedSection.children = Array.isArray(section.children)
      ? sanitizeSectionsForExport(section.children)
      : undefined;
    return sanitizedSection;
  });
};

const sanitizeDocumentForExport = (document: Document): Document => {
  const rawContent = (document.content ?? {}) as { sections?: SectionLike[] };
  const sanitizedSections = sanitizeSectionsForExport(rawContent.sections);
  return {
    ...document,
    content: {
      ...rawContent,
      sections: sanitizedSections,
    },
  };
};

const collectAttachmentIdsFromSections = (
  sections: SectionLike[] | undefined,
  target: Set<string>
): void => {
  if (!Array.isArray(sections)) return;
  sections.forEach((section) => {
    const content = Array.isArray(section.content) ? section.content : [];
    content.forEach((block) => {
      if (block && typeof block === "object" && typeof block.attachmentId === "string") {
        target.add(block.attachmentId);
      }
    });
    if (Array.isArray(section.children)) {
      collectAttachmentIdsFromSections(section.children, target);
    }
  });
};

const collectAttachmentIdsFromDocument = (document: Document): Set<string> => {
  const ids = new Set<string>();
  const content = (document.content as { sections?: SectionLike[] }) ?? {};
  collectAttachmentIdsFromSections(content.sections, ids);
  return ids;
};

// Create a backup of all documents
export const createBackup = async (options: { includeAssets?: boolean } = {}): Promise<BackupData> => {
  const { includeAssets = true } = options;
  const documents = getDocuments();
  const attachmentIds = new Set<string>();

  const extractAttachmentIds = (sections: SectionLike[] | undefined): void => {
    sections.forEach((section) => {
      const blocks = Array.isArray(section?.content) ? section.content : [];
      blocks.forEach((block) => {
        if (block && typeof block === "object" && typeof block.attachmentId === "string") {
          attachmentIds.add(block.attachmentId);
        }
      });
      if (Array.isArray(section?.children)) {
        extractAttachmentIds(section.children);
      }
    });
  };

  documents.forEach((doc) => {
    const contentSections = (doc.content as { sections?: SectionLike[] })?.sections;
    if (Array.isArray(contentSections)) {
      extractAttachmentIds(contentSections);
    }
  });

  const assets: BackupAsset[] = [];

  if (includeAssets) {
    for (const assetId of attachmentIds) {
      const assetData = await getAssetDataUrl(assetId);
      if (assetData) {
        assets.push({
          id: assetData.id,
          name: assetData.name,
          type: assetData.type,
          size: assetData.size,
          createdAt: assetData.createdAt,
          updatedAt: assetData.updatedAt,
          data: assetData.dataUrl,
        });
      }
    }
  }

  return {
    version: '2.0',
    timestamp: new Date().toISOString(),
    documents,
    assets,
  };
};

// Export backup as JSON file
export const exportBackup = async (filename?: string): Promise<void> => {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename || `backup-${new Date().toISOString().split('T')[0]}.json`;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import backup from JSON file
export const importBackup = (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as unknown;
        if (!isRecord(raw) || typeof raw.version !== "string" || !Array.isArray(raw.documents)) {
          throw new Error('Invalid backup file format');
        }
        const assets = Array.isArray(raw.assets) ? (raw.assets as BackupAsset[]) : [];
        const timestamp =
          typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString();
        const normalized: BackupData = {
          version: raw.version,
          timestamp,
          documents: raw.documents as Document[],
          assets,
        };
        resolve(normalized);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Restore documents from backup
export const restoreBackup = async (backup: BackupData, userId: string): Promise<void> => {
  const userDocuments = backup.documents.filter((doc) => doc.userId === userId);

  const attachmentIds = new Set<string>();
  const extractIds = (sections: SectionLike[]): void => {
    sections.forEach((section) => {
      const blocks = Array.isArray(section?.content) ? section.content : [];
      blocks.forEach((block) => {
        if (block && typeof block === "object" && typeof block.attachmentId === "string") {
          attachmentIds.add(block.attachmentId);
        }
      });
      if (Array.isArray(section?.children)) {
        extractIds(section.children);
      }
    });
  };

  userDocuments.forEach((doc) => {
    const contentSections = (doc.content as { sections?: SectionLike[] })?.sections;
    if (Array.isArray(contentSections)) {
      extractIds(contentSections);
    }
  });

  const assetList = Array.isArray(backup.assets) ? backup.assets : [];

  for (const asset of assetList) {
    if (attachmentIds.has(asset.id)) {
      await saveAssetFromDataUrl(asset.data, {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      });
    }
  }

  userDocuments.forEach((doc) => {
    saveDocument(doc);
  });
};

// Auto-backup functionality
let autoBackupInterval: NodeJS.Timeout | null = null;

export const startAutoBackup = (intervalMinutes: number = 10): void => {
  stopAutoBackup(); // Clear any existing interval
  
  const runBackup = async () => {
    try {
      const backup = await createBackup({ includeAssets: false });
      const key = `auto_backup_${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(backup));

      const autoBackups = Object.keys(localStorage)
        .filter((k) => k.startsWith('auto_backup_'))
        .sort();

      if (autoBackups.length > 5) {
        autoBackups.slice(0, autoBackups.length - 5).forEach((k) => {
          localStorage.removeItem(k);
        });
      }

      console.log(`Auto-backup created at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error("Auto-backup failed", error);
    }
  };

  autoBackupInterval = setInterval(() => {
    void runBackup();
  }, intervalMinutes * 60 * 1000);

  void runBackup();
};

export const stopAutoBackup = (): void => {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
};

// Get list of auto-backups
export const getAutoBackups = (): Array<{ key: string; timestamp: Date; backup: BackupData }> => {
  const backups = Object.keys(localStorage)
    .filter(k => k.startsWith('auto_backup_'))
    .map(key => {
      const backup = JSON.parse(localStorage.getItem(key) || '{}') as BackupData;
      const timestamp = new Date(parseInt(key.replace('auto_backup_', '')));
      return { key, timestamp, backup };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return backups;
};

// Export a single document
export const exportDocument = async (document: Document): Promise<void> => {
  const sanitizedDocument = sanitizeDocumentForExport(document);
  const attachmentIds = collectAttachmentIdsFromDocument(sanitizedDocument);

  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(sanitizedDocument, null, 2));

  const manifest: AssetManifestEntry[] = [];
  if (attachmentIds.size > 0) {
    const assetsFolder = zip.folder("assets");
    if (assetsFolder) {
      for (const assetId of attachmentIds) {
        const asset = await getAsset(assetId);
        if (!asset) {
          console.warn(`Asset with id ${assetId} not found during export.`);
          continue;
        }
        const safeName = sanitizeFileName(asset.name || `asset-${assetId}`);
        const relativePath = `${assetId}/${safeName}`;
        const manifestPath = `assets/${relativePath}`;
        const arrayBuffer = await asset.blob.arrayBuffer();
        assetsFolder.file(relativePath, arrayBuffer, { binary: true });
        manifest.push({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          size: asset.size,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
          filePath: manifestPath,
        });
      }
      assetsFolder.file("manifest.json", JSON.stringify(manifest, null, 2));
    }
  }

  const archiveBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(archiveBlob);
  const link = window.document.createElement("a");
  const exportName =
    `${sanitizeFileName(document.title || "document")}_${new Date()
      .toISOString()
      .split("T")[0]}.zip`;
  link.href = url;
  link.download = exportName;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import a single document
const importDocumentFromJson = async (file: File): Promise<Document> => {
  const text = await file.text();
  const data = JSON.parse(text) as unknown;
  if (
    !isRecord(data) ||
    typeof data.id !== "string" ||
    typeof data.title !== "string" ||
    !Object.prototype.hasOwnProperty.call(data, "content")
  ) {
    throw new Error("Invalid document file format");
  }
  return sanitizeDocumentForExport(data as unknown as Document);
};

const importDocumentFromZip = async (file: File): Promise<Document> => {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const projectFile = zip.file("project.json");
  if (!projectFile) {
    throw new Error("Invalid project bundle: project.json is missing.");
  }

  const documentJson = await projectFile.async("string");
  const parsedDocument = JSON.parse(documentJson) as Document;
  const sanitizedDocument = sanitizeDocumentForExport(parsedDocument);

  const manifestFile = zip.file("assets/manifest.json");
  if (manifestFile) {
    try {
      const manifestContent = await manifestFile.async("string");
      const manifest = JSON.parse(manifestContent) as AssetManifestEntry[];
      for (const assetMeta of manifest) {
        const assetEntry = zip.file(assetMeta.filePath);
        if (!assetEntry) {
          console.warn(`Asset file ${assetMeta.filePath} referenced in manifest not found.`);
          continue;
        }
        const assetBuffer = await assetEntry.async("arraybuffer");
        const blob = new Blob([assetBuffer], {
          type: assetMeta.type || "application/octet-stream",
        });
        await saveAsset(blob, {
          id: assetMeta.id,
          name: assetMeta.name,
          type: assetMeta.type,
          createdAt: assetMeta.createdAt,
          updatedAt: assetMeta.updatedAt,
        });
      }
    } catch (error) {
      console.error("Failed to restore assets from bundle", error);
    }
  }

  return sanitizedDocument;
};

export const importDocument = async (file: File): Promise<Document> => {
  const isZip =
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed";

  if (isZip) {
    return importDocumentFromZip(file);
  }

  return importDocumentFromJson(file);
};
