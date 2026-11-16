"""Convierte el Excel "Visual Board Financiero" en los datos iniciales de la app (lib/semilla.json).

Uso:  python scripts/excel_a_semilla.py Visual_Board_Financiero_2026_2027.xlsx lib/semilla.json
Requiere: pip install openpyxl

Lee las hojas "Presupuesto Mensual", "Visual Board" y "Mercado Detallado".
Las celdas con fórmula dentro de la tabla de pagos (p. ej. el saldo restante de la
deuda en dólares) se marcan como "auto": la app las recalcula con la TRM vigente.
"""
import json
import re
import sys

import openpyxl

MESES = {"Ene": 1, "Feb": 2, "Mar": 3, "Abr": 4, "May": 5, "Jun": 6,
         "Jul": 7, "Ago": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dic": 12}

SECCION = {
    "Ingresos Fijos": "ingreso",
    "Ingresos Extra": "ingreso",
    "Eventos y Viajes": "evento",
    "Pago Deudas Tarjetas": "deuda",
    "Pago Deudas Créditos": "deuda",
}

FILAS_TOTALES = {"TOTAL INGRESOS", "TOTAL SOSTENIMIENTO", "TOTAL DEUDAS Y METAS",
                 "EGRESO TOTAL MES", "FLUJO NETO DEL MES", "CAJA ACUMULADA REAL"}


def periodo(encabezado: str) -> dict:
    # "Dic 2026 (Cobro 30 Nov)" -> id 2026-12 · "Jul 2027 (Cobro 30 Jun+Pri)" -> cobro con prima
    m = re.match(r"(\w{3}) (\d{4}) \((.+)\)", encabezado)
    mes, anio, cobro = m.group(1), int(m.group(2)), m.group(3)
    cobro = cobro.replace("+Pri", " + prima")
    return {"id": f"{anio}-{MESES[mes]:02d}", "etiqueta": f"{mes} {anio}", "cobro": cobro}


def numero(v) -> float:
    return float(v) if isinstance(v, (int, float)) else 0.0


def main(origen: str, destino: str) -> None:
    wb = openpyxl.load_workbook(origen, data_only=False)
    pm = wb["Presupuesto Mensual"]
    vb = wb["Visual Board"]
    md = wb["Mercado Detallado"]

    trm = numero(pm["B3"].value)
    periodos = [periodo(pm.cell(4, c).value) for c in range(3, 17)]

    # Tipo de control por categoría (Visual Board I11:N17)
    control = {vb.cell(r, 9).value: vb.cell(r, 14).value for r in range(11, 18)}

    categorias, rubros = [], []
    vistas = set()
    for r in range(6, pm.max_row + 1):
        cat, nombre = pm.cell(r, 1).value, pm.cell(r, 2).value
        if not cat or not nombre or cat in FILAS_TOTALES or pm.cell(r, 3).value is None:
            continue
        if cat not in vistas:
            vistas.add(cat)
            categorias.append({"nombre": cat, "seccion": SECCION.get(cat, "operativo"),
                               "control": control.get(cat)})
        valores, auto, saldo_usd = [], [], None
        for i, c in enumerate(range(3, 17)):
            v = pm.cell(r, c).value
            if isinstance(v, str) and v.startswith("="):
                # Única fórmula de la tabla: saldo USD en COP menos lo ya pagado (=$D$3-C44)
                if "$D$3" in v:
                    auto.append(i)
                    saldo_usd = 500.0  # D3 = 500 * TRM
                valores.append(0.0)
            else:
                valores.append(numero(v))
        rubros.append({"categoria": cat, "nombre": nombre, "valores": valores,
                       "auto": auto, "saldo_usd": saldo_usd})

    mercado = []
    for r in range(4, md.max_row + 1):
        cat, prod = md.cell(r, 1).value, md.cell(r, 2).value
        if not cat or not prod or str(cat).startswith(("TOTAL", "DISPONIBLE")):
            continue
        mercado.append({"categoria": cat, "producto": prod,
                        "cantidad": numero(md.cell(r, 3).value), "precio": numero(md.cell(r, 4).value),
                        "estado": md.cell(r, 6).value or "Pendiente"})

    # Constantes que en el Excel viven dentro de fórmulas del Visual Board
    trm_ref = float(re.search(r"\((\d+)-", vb["H6"].value).group(1))            # =(3900-TRM)*500
    meta = numero(vb["L19"].value)                                              # 9.752.000
    ing28, op28, cuota28 = (float(x) for x in re.findall(r"\d+", vb["L20"].value))  # =8050000-5702000-1630000

    # Categoría para los aportes a metas (no existe en el Excel; la app la usa para ahorrar por metas)
    categorias.append({"nombre": "Ahorro y metas", "seccion": "ahorro", "control": None})

    semilla = {
        "config": {
            "hogar": "Hogar Jaime & María",
            "trm": trm,
            "trm_referencia": trm_ref,
            "ingreso_2028": ing28,
            "operativo_2028": op28,
            "cuota_carro_2028": cuota28,
            "nota_2028": vb["M20"].value,
        },
        "periodos": periodos,
        "categorias": categorias,
        "rubros": rubros,
        # La meta del Excel se mide contra la caja acumulada al final del plan (modo "caja")
        "metas": [{
            "nombre": "Cuota inicial carro",
            "detalle": "$8,5M + traspaso",
            "objetivo": meta,
            "periodo_objetivo": periodos[-1]["id"],
            "modo": "caja",
            "ahorrado": 0,
        }],
        # La hoja "Mercado Detallado" es una lista conectada al rubro de mercado del presupuesto
        "listas": [{
            "nombre": "Mercado del mes",
            "rubro": "Mercado General del Mes",
            "presupuesto": 0,
            "items": mercado,
        }],
    }
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(semilla, f, ensure_ascii=False, indent=1)
    print(f"OK: {len(periodos)} meses, {len(categorias)} categorías, {len(rubros)} rubros, "
          f"1 meta, 1 lista con {len(mercado)} productos -> {destino}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
