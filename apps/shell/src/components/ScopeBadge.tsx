'use client';

import { useEffect, useId, useState } from 'react';
import { Icon } from './icons/Icon';

/** El ambito que impone el RLS, reducido a una insignia. */
export function ScopeBadge({ restricciones }: { restricciones: [string, string[]][] }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const clickTo = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', clickTo);
    return () => document.removeEventListener('keydown', clickTo);
  }, [visible]);

  if (restricciones.length === 0) return null;

  const detalle = restricciones
    .map(([fieldName, valores]) => `${fieldName} = ${valores.join(', ')}`)
    .join(' · ');

  return (
    <span
      className="ambito"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        className="insignia scope-badge"
        aria-describedby={visible ? id : undefined}
        data-testid="active-scope"
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon nombre="ambito" tamano={14} />
        Ambito limitado por RLS
      </button>

      {visible ? (
        <span role="tooltip" id={id} className="scope__detail" data-testid="detail-scope">
          Su ambito de login limita esta view a: {detalle}
        </span>
      ) : null}
    </span>
  );
}
