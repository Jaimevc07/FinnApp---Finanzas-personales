-- Fechas de las tarjetas de crédito y el ítem del presupuesto de cada movimiento.

-- Día de corte del extracto y día límite de pago (1–31). Con ellas se sabe en qué extracto entra una
-- compra y en qué mes se paga (comprar después del corte la pasa al extracto siguiente).
alter table rubros add column if not exists dia_corte smallint check (dia_corte between 1 and 31);
alter table rubros add column if not exists dia_pago  smallint check (dia_pago between 1 and 31);

-- Ítem del presupuesto al que corresponde un movimiento (p. ej. "Combustible" dentro de
-- "Transporte y Salud"), para comparar lo gastado con lo presupuestado de ese ítem.
alter table movimientos add column if not exists rubro_id integer references rubros(id) on delete set null;
create index if not exists idx_movimientos_rubro on movimientos(rubro_id);
