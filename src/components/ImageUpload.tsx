import { useState, useRef, useEffect, DragEvent, ChangeEvent, MouseEvent } from 'react';
import { UploadCloud, Image as ImageIcon, X } from 'lucide-react';
// Lura: Idan 'motion/react' yana baka error, canza shi zuwa 'framer-motion'
import { motion, AnimatePresence } from 'motion/react'; 

interface ImageUploadProps {
  // Mun ba shi damar karbar null domin Parent ya san lokacin da aka goge hoto
  onImageSelect: (file: File | null, previewUrl: string | null) => void;
  className?: string;
  defaultPreview?: string | null;
}

export default function ImageUpload({ onImageSelect, className = '', defaultPreview = null }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(defaultPreview);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Gyaran Dynamic Prop: Sabunta preview idan defaultPreview ya canza daga Parent
  useEffect(() => {
    setPreview(defaultPreview);
  }, [defaultPreview]);

  // 2. Gyaran Memory Leak (Cleanup on Unmount): Share blob URL idan an rufe component
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Toh fa Boss! Please upload a valid image file. 🥺');
      return;
    }
    
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Haba Boss, this image is too large! Maximum size is 10MB. 🙈');
      return;
    }

    // Goge tsohon blob URL kafin mu samar da sabo domin tseratar da Memory
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageSelect(file, url);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const clearImage = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    // Goge blob URL dake cikin memory
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    
    setPreview(null);
    onImageSelect(null, null); // Sanar da babban shafi cewa an goge hoton!

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative w-full overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer group ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]'
            : preview
            ? 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
            : 'border-zinc-200 bg-zinc-50 hover:border-indigo-400 hover:bg-zinc-100'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !preview && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          accept="image/*"
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full flex flex-col items-center justify-center p-2"
            >
              <div className="relative w-full rounded-xl overflow-hidden shadow-sm">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-[300px] object-contain bg-zinc-900/5 rounded-xl"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                <button
                  onClick={clearImage}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur text-zinc-700 rounded-full shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors duration-200 z-10"
                  title="Remove image"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-12 text-center"
            >
              <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                {isDragging ? (
                  <UploadCloud className="w-8 h-8" />
                ) : (
                  <ImageIcon className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-base font-semibold text-zinc-800 mb-1">
                {isDragging ? 'Saki hoton a nan...' : 'Danna ko ka jawo hoto'}
              </h3>
              <p className="text-sm text-zinc-500 max-w-[200px]">
                Support for JPEG, PNG, WEBP (Max 10MB)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 text-sm font-medium text-red-500 bg-red-50 px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
