import React, { useRef } from 'react';
import {
  X, FileCheck, DollarSign, CheckCircle2, XCircle,
  Paperclip, Loader2, AlertTriangle, Upload
} from 'lucide-react';
import { ReviewAction, ReviewState, SuratItem } from './types';

interface ReviewModalProps {
  state: ReviewState;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (patch: Partial<ReviewState>) => void;
}

const ACTION_META: Record<ReviewAction, {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  btnColor: string;
  needsFile: boolean;
  filePlaceholder?: string;
  needsNote: boolean;
}> = {
  APPROVE_SPK: {
    title: 'Terbitkan SPK',
    desc: 'Upload dokumen SPK untuk pengajuan ini.',
    icon: <FileCheck size={18} className="text-emerald-600" />,
    color: 'border-emerald-500/30 bg-emerald-500/5',
    btnColor: 'bg-emerald-600 hover:bg-emerald-700',
    needsFile: true,
    filePlaceholder: 'Upload dokumen SPK (PDF/Excel/Word)',
    needsNote: false,
  },
  APPROVE_KEUANGAN: {
    title: 'Proses ke Keuangan',
    desc: 'Upload bukti pembayaran / dokumen keuangan.',
    icon: <DollarSign size={18} className="text-blue-600" />,
    color: 'border-blue-500/30 bg-blue-500/5',
    btnColor: 'bg-blue-600 hover:bg-blue-700',
    needsFile: true,
    filePlaceholder: 'Upload bukti pembayaran / dokumen keuangan',
    needsNote: false,
  },
  APPROVE_DONE: {
    title: 'Tandai Selesai',
    desc: 'Konfirmasi bahwa seluruh proses sudah selesai.',
    icon: <CheckCircle2 size={18} className="text-emerald-600" />,
    color: 'border-emerald-500/30 bg-emerald-500/5',
    btnColor: 'bg-emerald-600 hover:bg-emerald-700',
    needsFile: false,
    needsNote: false,
  },
  REJECT: {
    title: 'Tolak Pengajuan',
    desc: 'Berikan alasan penolakan yang jelas.',
    icon: <XCircle size={18} className="text-red-600" />,
    color: 'border-red-500/30 bg-red-500/5',
    btnColor: 'bg-red-600 hover:bg-red-700',
    needsFile: false,
    needsNote: true,
  },
};

export const ReviewModal: React.FC<ReviewModalProps> = ({ state, onClose, onSubmit, onChange }) => {
  const { open, surat, action, note, file, loading } = state;
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open || !surat || !action) return null;
  const meta = ACTION_META[action];

  const canSubmit =
    !loading &&
    (!meta.needsFile || !!file) &&
    (!meta.needsNote || note.trim().length > 3);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-card border-2 ${meta.color} rounded-2xl w-full max-w-md shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center border border-border">
              {meta.icon}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-foreground">{meta.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[260px]">{surat.judul_surat}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-muted-foreground">{meta.desc}</p>

          {/* Upload file */}
          {meta.needsFile && (
            <div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => onChange({ file: e.target.files?.[0] ?? null })}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
              >
                {file ? (
                  <>
                    <Paperclip size={20} className="text-primary" />
                    <p className="text-[11px] font-bold text-primary">{file.name}</p>
                    <p className="text-[9px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — klik untuk ganti</p>
                  </>
                ) : (
                  <>
                    <Upload size={20} className="text-muted-foreground/50" />
                    <p className="text-[11px] text-muted-foreground">{meta.filePlaceholder}</p>
                    <p className="text-[9px] text-muted-foreground/50">PDF, Excel, Word, JPG, PNG</p>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Catatan */}
          {meta.needsNote && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1.5">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => onChange({ note: e.target.value })}
                placeholder="Jelaskan alasan penolakan secara detail..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-red-500/30 placeholder:text-muted-foreground/40"
              />
            </div>
          )}

          {/* Catatan opsional untuk non-reject */}
          {!meta.needsNote && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1.5">
                Catatan (Opsional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => onChange({ note: e.target.value })}
                placeholder="Tambahkan catatan jika perlu..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              />
            </div>
          )}

          {/* Warning */}
          {action === 'REJECT' && (
            <div className="flex items-start gap-2.5 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-red-600/80 leading-relaxed">
                Penolakan akan menutup chat dan memberi tahu pemohon. Pastikan alasan sudah jelas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 p-5 pt-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-border text-[11px] font-black uppercase tracking-wider hover:bg-secondary transition-all"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`flex-1 py-2.5 rounded-xl text-white text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${meta.btnColor} disabled:opacity-40`}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Memproses...</>
              : meta.title
            }
          </button>
        </div>
      </div>
    </div>
  );
};