import { cuerpo, idDe, responder, type CtxId } from '@/lib/servidor/http';
import { borrarGrupo, renombrarGrupo } from '@/lib/servidor/repo';

/** Renombra un grupo de productos de la lista: { de: 'Proteínas y Lácteos', a: 'Lácteos' } */
export async function PATCH(req: Request, ctx: CtxId) {
  return responder(async () => {
    const b = await cuerpo(req);
    await renombrarGrupo(await idDe(ctx), b.de, b.a);
  });
}

/** Borra un grupo con todos sus productos: { nombre: 'Proteínas y Lácteos' } */
export async function DELETE(req: Request, ctx: CtxId) {
  return responder(async () => {
    const b = await cuerpo(req);
    await borrarGrupo(await idDe(ctx), b.nombre);
  });
}
