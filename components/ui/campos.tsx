'use client';
// Campos de formulario. Fuente de 16 px en móvil para que iOS no haga zoom al enfocar.
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { numero } from '@/lib/formato';
import { cx } from './botones';
import { useSoloLectura } from './solo-lectura';

export const claseInput =
  'foco h-12 w-full min-w-0 rounded-2xl border border-transparent bg-surface-2 px-4 text-[16px] text-ink placeholder:text-muted transition focus:border-accent focus:bg-surface lg:text-[15px]';

export function Campo({ etiqueta, ayuda, children, className, htmlFor }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-semibold text-muted">{etiqueta}</label>
      {children}
      {ayuda && <p className="text-[12px] text-muted">{ayuda}</p>}
    </div>
  );
}

export function Entrada({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx(claseInput, className)} {...rest} />;
}

export function Selector({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cx(claseInput, 'appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b6a71%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")' }} {...rest}>
      {children}
    </select>
  );
}

/** Monto en pesos: muestra separadores de miles mientras se escribe y abre el teclado numérico. */
export function EntradaDinero({
  valor, onValor, className, grande, ...rest
}: { valor: number; onValor: (v: number) => void; grande?: boolean } & Omit<ComponentProps<'input'>, 'value' | 'onChange'>) {
  const [texto, setTexto] = useState(valor ? numero(valor) : '');
  const soloLectura = useSoloLectura();
  useEffect(() => {
    setTexto(t => (Number(t.replace(/\D/g, '')) === Math.round(valor) ? t : valor ? numero(valor) : ''));
  }, [valor]);
  return (
    <div className={cx('relative min-w-0', className)}>
      <span className={cx('pointer-events-none absolute top-1/2 -translate-y-1/2 font-semibold text-muted', grande ? 'left-4 text-[22px]' : 'left-4 text-[15px]')}>$</span>
      <input
        inputMode="numeric"
        autoComplete="off"
        className={cx(claseInput, 'text-right tabular-nums', grande ? 'h-16 pl-10 text-[28px] font-bold tracking-tight' : 'pl-8')}
        value={texto}
        onChange={e => {
          const n = Number(e.target.value.replace(/\D/g, '')) || 0;
          setTexto(n ? numero(n) : '');
          onValor(n);
        }}
        onFocus={e => e.target.select()}
        {...rest}
        readOnly={rest.readOnly || soloLectura}
      />
    </div>
  );
}
