import { useState, useRef, useEffect, useCallback, DragEvent, ChangeEvent, MouseEvent } from 'react';
import { UploadCloud, FileText, X, File as FileIcon, FileArchive, FileImage, FileCode, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export interface UploadItem {
  id: string;
  file: File;
  previewUrl: string | null;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  downloadURL: string | null;
  error: string | null;
}

export interface DocumentUploadProps {
  onFilesChange?: (items: UploadItem[]) => void;
  className?: string;
  storagePath?: string;
  multiple?: boolean;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSizeMB?: number;
}

const makeId = () => Math.random().toString(36).substring(2, 9);

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isImageFile = (file: File) => file.type.startsWith('image/');

const getFileIcon = (fileName: string, className: string = "w-8 h-8") => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'txt':
    case 'rtf':
      return <FileText className={className} />;
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return <FileArchive className={className} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'webp':
      return <FileImage className={className} />;
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'html':
    case 'css':
    case 'json':
      return <FileCode className={className} />;
    default:
      return <FileIcon className={className} />;
  }
};

export default function DocumentUpload({
  onFilesChange,
  className = '',
  storagePath,
  multiple = false,
  maxFiles = 10,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.csv', '.xlsx', '.xls', 'image/*'],
  maxSizeMB = 25
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      items.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifyFilesChange = useCallback((nextItems: UploadItem[]) => {
    if (onFilesChange) {
      onFilesChange(nextItems);
    }
  }, [onFilesChange]);

  const validateFile = useCallback((file: File): string | null => {
    if (acceptedTypes.length > 0 && !acceptedTypes.includes('*')) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;
      
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        if (type.endsWith('/*')) {
          const baseMime = type.split('/')[0];
          return mimeType.startsWith(baseMime + '/');
        }
        return mimeType.match(new RegExp(type.replace('*', '.*')));
      });

      if (!isValidType) {
        return `Toh fa Boss! Invalid format for ${file.name}. 🥺`;
      }
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Haba Boss, ${file.name} is too large! Maximum is ${maxSizeMB}MB. 🙈`;
    }

    return null;
  }, [acceptedTypes, maxSizeMB]);

  const uploadItem = useCallback((item: UploadItem) => {
    if (!storagePath) {
      setItems(prev => {
        const next = prev.map(i => i.id === item.id ? { ...i, status: 'success' as const, progress: 100 } : i);
        notifyFilesChange(next);
        return next;
      });
      return;
    }

    const fileRef = ref(storage, `${storagePath}/${item.id}_${item.file.name}`);
    const task = uploadBytesResumable(fileRef, item.file);

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));

    task.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, progress } : i));
      },
      (err) => {
        setItems(prev => {
          const next = prev.map(i => i.id === item.id ? { ...i, status: 'error' as const, error: err.message } : i);
          notifyFilesChange(next);
          return next;
        });
      },
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);
        setItems(prev => {
          const next = prev.map(i => i.id === item.id ? { ...i, status: 'success' as const, progress: 100, downloadURL } : i);
          notifyFilesChange(next);
          return next;
        });
      }
    );
  }, [storagePath, notifyFilesChange]);

  const handleFilesAdded = useCallback((filesToAdd: File[]) => {
    setError(null);
    setItems((prev) => {
      const roomLeft = multiple ? maxFiles - prev.length : 1;
      if (roomLeft <= 0) {
        setError(`Haba Boss, you can only upload up to ${maxFiles} files! 🥺`);
        return prev;
      }

      const accepted: UploadItem[] = [];
      for (const file of filesToAdd.slice(0, roomLeft)) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        accepted.push({
          id: makeId(),
          file,
          previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null,
          progress: 0,
          status: 'pending',
          downloadURL: null,
          error: null,
        });
      }

      if (accepted.length === 0) return prev;

      const next = multiple ? [...prev, ...accepted] : accepted;

      if (!multiple) {
        prev.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
      }

      notifyFilesChange(next);

      if (storagePath) {
        accepted.forEach((item) => uploadItem(item));
      }

      return next;
    });
  }, [multiple, maxFiles, notifyFilesChange, storagePath, uploadItem, validateFile]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((i) => i.id !== id);
      notifyFilesChange(next);
      return next;
    });
  };

  const acceptString = acceptedTypes.join(',');

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative w-full overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer group ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]'
            : (!multiple && items.length > 0)
            ? 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-300'
            : 'border-zinc-200 bg-zinc-50 hover:border-indigo-400 hover:bg-zinc-100'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
           if (multiple || items.length === 0) {
             fileInputRef.current?.click();
           }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          accept={acceptString}
          multiple={multiple}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center min-h-[200px]">
          <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
            {isDragging ? (
              <UploadCloud className="w-8 h-8" />
            ) : (
              <FileText className="w-8 h-8" />
            )}
          </div>
          <h3 className="text-base font-semibold text-zinc-800 mb-1">
            {isDragging ? 'Saki takardar a nan...' : 'Danna ko ka jawo takarda'}
          </h3>
          <p className="text-sm text-zinc-500 max-w-[250px] mt-1">
            Accepted formats: {acceptedTypes.join(', ').replace(/\.\*|\/|\*/g, '').toUpperCase()} (Max {maxSizeMB}MB)
          </p>
          
          {!multiple && items.length > 0 && (
            <p className="mt-4 text-xs font-medium text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
              Click to replace current file
            </p>
          )}
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="text-sm font-medium text-red-600 bg-red-50/80 border border-red-100 px-4 py-3 rounded-xl flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded Items List */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 space-y-3"
          >
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full p-4 flex flex-col sm:flex-row items-center gap-4 bg-white rounded-xl border border-zinc-100 shadow-sm"
              >
                <div className="flex-shrink-0 p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-indigo-500 relative overflow-hidden">
                   {item.previewUrl ? (
                     <img src={item.previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-md" />
                   ) : (
                     getFileIcon(item.file.name, "w-10 h-10")
                   )}
                </div>
                
                <div className="flex-1 min-w-0 w-full flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className="flex items-center gap-2 w-full max-w-[200px] sm:max-w-full justify-center sm:justify-start">
                    <h4 className="text-sm font-semibold text-zinc-900 truncate">
                      {item.file.name}
                    </h4>
                    {item.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />}
                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  </div>
                  
                  <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                    <span>{formatFileSize(item.file.size)}</span>
                    {item.status === 'uploading' && (
                      <>
                        <span>•</span>
                        <span className="text-indigo-500 font-medium">{Math.round(item.progress)}%</span>
                      </>
                    )}
                    {item.status === 'error' && (
                      <>
                        <span>•</span>
                        <span className="text-red-500 font-medium truncate max-w-[150px]">{item.error}</span>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(item.status === 'uploading' || item.progress > 0) && item.status !== 'error' && (
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full mt-2 overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full ${item.status === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 mt-2 sm:mt-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                    className="p-2 bg-white text-zinc-400 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
                    title="Remove document"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
