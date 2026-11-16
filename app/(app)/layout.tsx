import { ProveedorFinanzas } from '@/components/proveedor';
import { Shell } from '@/components/shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorFinanzas>
      <Shell>{children}</Shell>
    </ProveedorFinanzas>
  );
}
