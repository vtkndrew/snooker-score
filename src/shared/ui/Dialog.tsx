import { useEffect, useRef, type ReactNode } from 'react';

import styles from './Dialog.module.css';

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    const previous = document.activeElement;

    node?.showModal();
    document.body.dataset.modal = 'true';

    return () => {
      node?.close();
      delete document.body.dataset.modal;

      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className={styles.header}>
        <h2 id="dialog-title">{title}</h2>
        <button type="button" aria-label="Закрыть окно" onClick={onClose}>
          ×
        </button>
      </header>
      <div className={styles.content}>{children}</div>
    </dialog>
  );
}
