import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export function Toast({ message, type = 'info', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const icons = { success: CheckCircle, error: XCircle, info: Info };
  const Icon = icons[type] || Info;

  return (
    <div className={`toast toast-${type}`} onClick={onDismiss} style={{ cursor: 'pointer' }}>
      <Icon size={16} />
      <span>{message}</span>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = React.useState([]);

  function addToast(message, type = 'info') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return { toasts, addToast, removeToast };
}
