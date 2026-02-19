import React from 'react';
import { X, Loader2, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface PreviewModalProps {
  isOpen: boolean;
  fileUrl: string;
  onClose: () => void;
}

export const PreviewModal = ({ isOpen, fileUrl, onClose }: PreviewModalProps) => {
  if (!isOpen) return null;

  // Fungsi untuk download file
  const handleDownload = () => {
    const link = document.createElement('a');
    // Ambil URL asli file (sebelum dibungkus viewer office)
    const rawUrl = fileUrl.split('src=')[1]?.split('&')[0];
    link.href = decodeURIComponent(rawUrl || fileUrl);
    link.download = "Document_Export";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-6xl h-[92vh] bg-card border border-border rounded-lg overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header Minimalis dengan Download */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-border bg-[#020617]">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Document Preview</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDownload}
              className="h-8 text-[10px] font-bold text-white/70 hover:bg-white/10 hover:text-white gap-2 uppercase tracking-widest"
            >
              <Download size={14} /> Download
            </Button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <Button 
              variant="ghost" size="icon" onClick={onClose} 
              className="h-8 w-8 text-white/50 hover:bg-destructive hover:text-white"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-white relative">
          <iframe src={fileUrl} className="w-full h-full border-none" title="Viewer" />
          <div className="absolute inset-0 flex items-center justify-center -z-10 bg-slate-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
          </div>
        </div>
      </div>
    </div>
  );
};