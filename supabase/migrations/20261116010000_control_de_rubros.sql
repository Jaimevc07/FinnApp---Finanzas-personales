-- Cada ítem del presupuesto puede ser fijo (se paga completo, con el botón "Pagado") o flexible (se
-- gasta de a poco: puede quedar por debajo o pasarse). Nulo = como su categoría: "Flexible" → flexible;
-- "Fijo", "Semi-fijo" o sin control → fijo.
alter table rubros add column if not exists control text check (control in ('fijo', 'flexible'));
