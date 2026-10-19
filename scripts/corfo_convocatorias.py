#!/usr/bin/env python3
"""
Extractor de convocatorias de Corfo (corfo.gob.cl/sites/cpp/programasyconvocatorias).

Corfo no tiene API pública. El buscador del sitio carga los resultados desde
  POST https://www.corfo.gob.cl/sites/cpp/wp-admin/admin-ajax.php
  action=filter_convocatorias, post_type=convocatoria, nonce=<de la página>, page=N
  filtros opcionales (arrays): estado[], alcance[], perfil[], etapa[], necesidad[], venta[]
  respuesta: {"found": <total>, "html": "<tarjetas + paginación>"}  (10 por página)

El sitio tiene protección anti-bots, por eso se usa un navegador real (Playwright):
se abre la página una vez, se toma el nonce y las peticiones se hacen desde ella.

Instalación:
  pip install playwright beautifulsoup4
  playwright install chromium

Uso:
  python corfo_convocatorias.py                       # abiertas, con detalle y etiquetas
  python corfo_convocatorias.py --estado todas         # abiertas + cerradas (~1.300, tarda)
  python corfo_convocatorias.py --sin-detalle          # solo datos del listado (rápido)
  python corfo_convocatorias.py --salida datos/corfo   # genera datos/corfo.json y .csv

Recomendado: correrlo 1 vez al día y guardar el resultado en tu propia base.
"""
import argparse
import csv
import json
import re
import sys
import time
from datetime import date, datetime

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

BASE = "https://www.corfo.gob.cl/sites/cpp/programasyconvocatorias/"
PAUSA = 0.4  # segundos entre peticiones; no bajar mucho, para no sobrecargar el sitio

FILTROS = {
    "perfil": ["empresa", "extranjero", "institucion", "intermediario", "organizacion", "persona"],
    "etapa": [
        "estoy-desarrollando-id", "estoy-recien-empezando", "quiero-aumentar-mis-ventas",
        "quiero-entregar-servicios-a-emprendedores", "quiero-escalar",
        "quiero-fortalecer-el-ecosistema-de-emprendimiento", "quiero-innovar-en-lo-que-hago",
        "tengo-ganas-de-emprender-hacer-algo", "tengo-una-idea-de-negocio",
    ],
    "necesidad": [
        "capacitaciones", "capital-de-riesgo", "co-financiamientos-para-empresas", "creditos",
        "emprender", "escalamiento", "garantias-coberturas", "incentivo-mujeres", "innovar",
        "otros-incentivos", "subsidios", "territorio",
    ],
    "venta": [
        "001-a-2-400-uf-microempresa", "2-400-a-25-000-uf-pequena-empresa",
        "25-000-a-100-000-uf-mediana-empresa", "mayor-a-100-000-uf-gran-empresa",
        "menor-a-100-000-uf", "sin-ventas",
    ],
}

SECCIONES = [  # (regex sobre el título de la sección, clave normalizada)
    (r"qui[eé]nes pueden (postular|solicitarlo)", "quienes_pueden_postular"),
    (r"beneficio", "beneficio"),
    (r"pasos", "pasos_postulacion"),
    (r"calendario", "calendario"),
    (r"postulaci[oó]n", "postulacion"),
]


def limpiar(txt):
    txt = re.sub(r"Cerrar X[\s\S]*$", "", txt or "")
    txt = re.sub(r"[ \t]+", " ", txt)
    return re.sub(r"\n\s*\n+", "\n", txt).strip()


def iso(fecha):
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", fecha or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


class Corfo:
    def __init__(self, page):
        self.page = page
        page.goto(BASE, wait_until="networkidle")
        self.ajax = page.evaluate("convocatoriasAjax.ajaxurl")
        self.nonce = page.evaluate("convocatoriasAjax.nonce")

    def _post(self, pagina, filtros):
        pares = [("action", "filter_convocatorias"), ("page", str(pagina)),
                 ("post_type", "convocatoria"), ("nonce", self.nonce)]
        for k, vals in filtros.items():
            pares += [(f"{k}[]", v) for v in vals]
        for intento in range(3):
            res = self.page.evaluate(
                """async ([url, pares]) => {
                    const r = await fetch(url, {method: 'POST', body: new URLSearchParams(pares)});
                    return {status: r.status, text: await r.text()};
                }""",
                [self.ajax, pares],
            )
            if res["status"] == 200:
                return json.loads(res["text"])
            if res["status"] == 403:  # nonce vencido: recargar la página
                self.__init__(self.page)
                pares[3] = ("nonce", self.nonce)
            time.sleep(2 * (intento + 1))
        raise RuntimeError(f"Fallo admin-ajax (página {pagina}, filtros {filtros})")

    def listar(self, filtros):
        out, pagina = [], 1
        while True:
            data = self._post(pagina, filtros)
            total = int(data.get("found") or 0)
            soup = BeautifulSoup(data.get("html") or "", "html.parser")
            tarjetas = soup.select(".caja-resultados_uno")
            for c in tarjetas:
                t = lambda sel: c.select_one(sel).get_text(" ", strip=True) if c.select_one(sel) else None
                link = c.select_one(".foot-caja_result a")
                out.append({
                    "titulo": t("h4"),
                    "apertura": iso(t(".apertura span")),
                    "cierre": iso(t(".cierre span")),
                    "alcance": re.sub(r"^Alcance:\s*", "", t("h5") or ""),
                    "estado_corfo": re.sub(r"^Estado:\s*", "", t("h6") or ""),
                    "resumen": t(".contenido-caja_prog p"),
                    "url": link["href"] if link else None,
                })
            if not tarjetas or len(out) >= total:
                return out
            pagina += 1
            time.sleep(PAUSA)

    def detalle(self, url):
        html = self.page.evaluate("async u => (await fetch(u)).text()", url)
        soup = BeautifulSoup(html, "html.parser")
        # Los PDFs y el link de postulación se leen ANTES de quitar los modales (ahí están las bases)
        docs = {}
        for a in soup.select("a[href]"):
            if re.search(r"\.pdf(\?|$)", a["href"], re.I):
                docs[a["href"]] = a.get_text(" ", strip=True) or a["href"].rsplit("/", 1)[-1]
        post = soup.select_one('[id^="section-postulacion"] a[href]')
        for e in soup(["script", "style", "svg"]):
            e.decompose()
        for e in soup.select('[role="dialog"], a[href="#"]'):  # modal de bases y links "Revisa aquí"
            e.decompose()
        secciones = {}
        for s in soup.select('[id^="section-"]'):
            h = s.find(["h1", "h2", "h3", "h4"])
            titulo = h.get_text(" ", strip=True) if h else s.get("id", "")
            texto = limpiar(s.get_text("\n"))
            clave = next((k for rx, k in SECCIONES if re.search(rx, titulo + " " + s.get("id", ""), re.I)), None)
            if clave:
                texto = limpiar(texto.replace(titulo, "", 1))
                secciones[clave] = texto
            elif "que_es" not in secciones:  # cabecera: trae "¿Qué es?"
                i = texto.find("¿Qué es?")
                secciones["que_es"] = texto[i + 8:].strip() if i >= 0 else texto
        cab = soup.select_one("#section-cabecera-0")
        cab_txt = cab.get_text(" ", strip=True) if cab else ""
        hora = lambda et: (re.search(et + r":\s*\d{2}/\d{2}/\d{4}\s*(\d{1,2}:\d{2})", cab_txt) or [None, None])[1]
        contacto = secciones.get("calendario", "")
        return {
            "hora_apertura": hora("Apertura"),
            "hora_cierre": hora("Cierre"),
            "secciones": secciones,
            "contacto_email": (re.search(r"[\w.+-]+@corfo\.cl", contacto) or [None])[0],
            "link_postulacion": post["href"] if post and post["href"] != "#" else None,
            "documentos": [{"nombre": n, "url": u} for u, n in docs.items()],
        }


def main():
    ap = argparse.ArgumentParser(description="Extrae convocatorias de Corfo")
    ap.add_argument("--estado", choices=["abiertas", "cerradas", "todas"], default="abiertas")
    ap.add_argument("--sin-detalle", action="store_true", help="no visitar la ficha de cada convocatoria")
    ap.add_argument("--sin-etiquetas", action="store_true", help="no consultar perfil/etapa/necesidad/venta")
    ap.add_argument("--salida", default="convocatorias_corfo", help="prefijo de los archivos .json y .csv")
    ap.add_argument("--headful", action="store_true", help="mostrar el navegador")
    args = ap.parse_args()

    estados = ["abiertas", "cerradas"] if args.estado == "todas" else [args.estado]
    hoy = date.today().isoformat()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful)
        page = browser.new_page(locale="es-CL")
        corfo = Corfo(page)

        todas = {}
        for est in estados:
            for c in corfo.listar({"estado": [est]}):
                todas[c["url"]] = {**c, **{g: [] for g in FILTROS}}
            print(f"[{est}] {sum(1 for x in todas.values() if x['estado_corfo'].lower() == est)} convocatorias", file=sys.stderr)

        if not args.sin_etiquetas:
            for grupo, valores in FILTROS.items():
                for v in valores:
                    for est in estados:
                        for c in corfo.listar({"estado": [est], grupo: [v]}):
                            if c["url"] in todas:
                                todas[c["url"]][grupo].append(v)
                print(f"etiquetas {grupo} ok", file=sys.stderr)

        if not args.sin_detalle:
            for i, c in enumerate(todas.values(), 1):
                try:
                    c.update(corfo.detalle(c["url"]))
                except Exception as e:  # una ficha rota no debe botar todo
                    c["error_detalle"] = str(e)
                if i % 25 == 0:
                    print(f"detalle {i}/{len(todas)}", file=sys.stderr)
                time.sleep(PAUSA)
        browser.close()

    registros = []
    for c in todas.values():
        c["id"] = (c["url"] or "").rstrip("/").rsplit("/", 1)[-1]
        # El estado de Corfo a veces queda desactualizado: calcular vigencia real por fecha
        if c["cierre"]:
            c["vigente"] = c["cierre"] >= hoy
        else:
            c["vigente"] = c["estado_corfo"].lower() == "abiertas"  # ventanilla permanente
        c["permanente"] = c["cierre"] is None and c["estado_corfo"].lower() == "abiertas"
        c["extraido_en"] = datetime.now().isoformat(timespec="seconds")
        registros.append(c)
    registros.sort(key=lambda x: (x["cierre"] or "9999"))

    with open(args.salida + ".json", "w", encoding="utf-8") as f:
        json.dump(registros, f, ensure_ascii=False, indent=2)

    cols = ["id", "titulo", "estado_corfo", "vigente", "permanente", "alcance", "apertura", "cierre",
            "perfil", "etapa", "necesidad", "venta", "resumen", "url"]
    with open(args.salida + ".csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in registros:
            w.writerow({k: "|".join(r[k]) if isinstance(r.get(k), list) else r.get(k) for k in cols})

    print(f"Listo: {len(registros)} convocatorias -> {args.salida}.json / .csv", file=sys.stderr)


if __name__ == "__main__":
    main()
