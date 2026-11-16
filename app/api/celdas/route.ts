import { cuerpo, responder } from '@/lib/servidor/http';
import { guardarCelda } from '@/lib/servidor/repo';

/** { rubroId, periodoId, valor, auto?, propagar? } · propagar = aplicar a este mes y a los siguientes */
export async function PUT(req: Request) {
  return responder(async () => {
    const b = await cuerpo(req);
    await guardarCelda({
      rubroId: Number(b.rubroId),
      periodoId: String(b.periodoId),
      valor: Number(b.valor),
      auto: !!b.auto,
      propagar: !!b.propagar,
    });
  }, false);
}
