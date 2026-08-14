import { ReactNode, useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Mirrors the design's sheet transition: backdrop `fade .2s`, sheet
 * `rise .3s ease`. Closing is a short fade with no movement.
 */
export function BottomSheet({ open, onClose, children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Desktop expects Escape to dismiss a dialog; on a phone it simply never fires.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className={closing ? 'backdrop closing' : 'backdrop'} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="modal-head">
      <div className="modal-title">{title}</div>
      <button className="modal-close" onClick={onClose} aria-label="Закрыть">
        ✕
      </button>
    </div>
  );
}
