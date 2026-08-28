import { useState, useCallback, useEffect, useRef, DragEvent, ClipboardEvent } from 'react';

interface FileDropPasteOptions {
  accept?: string[];
  maxSize?: number; // in bytes
  onFilesAdded: (files: File[]) => void;
  enabled?: boolean;
}

interface FileDropPasteResult {
  isDragging: boolean;
  handleDragEnter: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => void;
  handlePaste: (e: ClipboardEvent) => void;
  dropZoneRef: React.RefObject<HTMLDivElement>;
}

const DEFAULT_ACCEPT = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
];

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function useFileDropPaste({
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  onFilesAdded,
  enabled = true,
}: FileDropPasteOptions): FileDropPasteResult {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const isValidFileType = useCallback((file: File) => {
    return accept.some(type => {
      if (type.endsWith('/*')) {
        const category = type.slice(0, -2);
        return file.type.startsWith(category);
      }
      return file.type === type;
    });
  }, [accept]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const validFiles: File[] = [];
    
    Array.from(files).forEach(file => {
      if (file.size > maxSize) {
        console.warn(`File ${file.name} is too large (max ${maxSize / 1024 / 1024}MB)`);
        return;
      }
      if (!isValidFileType(file)) {
        console.warn(`File ${file.name} has unsupported type: ${file.type}`);
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  }, [maxSize, isValidFileType, onFilesAdded]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [enabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, [enabled]);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
  }, [enabled]);

  const handleDrop = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [enabled, processFiles]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  }, [enabled, processFiles]);

  // Global paste listener for when focus is anywhere in the drop zone
  useEffect(() => {
    if (!enabled) return;

    const handleGlobalPaste = (e: globalThis.ClipboardEvent) => {
      const dropZone = dropZoneRef.current;
      if (!dropZone) return;

      // Check if focus is within the drop zone
      const activeElement = document.activeElement;
      if (!dropZone.contains(activeElement)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [enabled, processFiles]);

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
    dropZoneRef,
  };
}
