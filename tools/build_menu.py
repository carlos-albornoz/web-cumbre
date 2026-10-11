"""Genera el bloque del menú dentro de index.html (entre <!-- MENU:START --> y <!-- MENU:END -->).
Los datos salen del menú impreso de Cumbre. Para cambiar un precio o un plato, edítalo aquí y ejecuta:
    python tools/build_menu.py
No edites a mano el bloque generado en index.html."""
import html, re, pathlib

# id, nombre, altitud (m.s.n.m. o None), precio USD, descripción, opciones (o None)
CARNE = [
    ("pico-bolivar", "Pico Bolívar", 4978, 12, "Pan de papa de 110 g, 130 g de lomito marinado en chimichurri, 130 g de pollo, pico de gallo, queso llanero asado, aguacate, chorizo de cerdo ahumado y tártara.", None),
    ("pico-la-torre", "Pico La Torre", 4547, 13, "Pan de papa de 110 g, stick fries, 150 g de carne de res, 150 g de pechuga de pollo, 150 g de chuleta ahumada, queso Facilita Kraft, pepinillos, tocineta y salsas de la casa.", None),
    ("double-cheese-bacon", "Double Cheese & Bacon", None, 9, "Pan de papa de 110 g, 200 g de carne de res cubierta con queso Facilita Kraft, tocineta crocante, pepinillos de la casa, cebolla, salsa de tomate y BBQ de la casa.", None),
    ("pico-codazzi", "Pico Codazzi", 4775, 9, "Pan de papa de 110 g, 150 g de carne de res, lechuga, queso asado, tocineta, piña asada con miel de papelón, mayomostaza y salsa BBQ de la casa.", None),
    ("bosque-pino", "Bosque Pino", 2500, 9, "Pan de papa de 110 g, 150 g de carne de res cubierta con fondue de queso mozzarella, cebollas caramelizadas en vino de mora, tocineta, lechuga, tomate y salsas clásicas.", None),
    ("pico-humboldt", "Pico Humboldt", 4940, 8.5, "Pan de papa de 110 g, 150 g de carne de res, ensalada rallada, stick fries, huevo frito, aguacate, tocineta y tártara.", None),
    ("pico-toro", "Pico Toro", 4755, 8, "Pan de papa de 80 g, 150 g de lomito marinado en chimichurri, pico de gallo, queso llanero asado, aguacate y tártara.", None),
    ("pico-leon", "Pico León", 4720, 6.5, "Pan de papa de 80 g, 100 g de carne de res cubierta con fondue de queso mozzarella, cebollas caramelizadas, lechuga, tomate y tártara.", None),
    ("cheeseburger", "Cheeseburger", None, 6, "Pan de papa de 80 g, 100 g de carne de res, queso Facilita Kraft, cebolla, pepinillos de la casa, salsa de tomate y BBQ de la casa.", None),
]
POLLO = [
    ("pico-la-concha", "Pico La Conchá", 4922, 9, "Con chuleta. Pan de papa de 110 g, 150 g de chuleta ahumada con BBQ, ensalada coleslaw y crujientes aros de cebolla.", None),
    ("pico-bonpland", "Pico Bonpland", 4823, 10, "Pan de papa de 110 g, 150 g de pechuga de pollo bañada con champiñones salteados con tocineta en crema de leche, stick fries y queso de año.", ("Crispy", "A la plancha")),
    ("pico-aguila", "Pico Águila", 4118, 9, "Pan de papa de 110 g, 150 g de pechuga de pollo, tomate, lechuga, dip de ajoporro, tocineta y salsas clásicas.", ("Crispy", "A la plancha")),
    ("mucubaji", "Mucubají", 3628, 9, "Pan de papa de 110 g, 150 g de pechuga de pollo, ensalada César, tocineta y queso de año.", ("Crispy", "A la plancha")),
    ("sanguchito-de-pollo", "Sanguchito de Pollo", None, 8, "Pan de papa de 80 g, 140 g de pollo crispy, queso Facilita Kraft, pepinillos de la casa, tocineta ahumada, salsa de tomate y BBQ de la casa.", None),
]
# id, nombre, precio, descripción, opciones
COMBOS = [
    ("combo-sierra-nevada", "Sierra Nevada", 28, "Cheeseburger, Pico León, Bosque Pino y Pico Humboldt, más un refresco de 1,5 L.", None),
    ("combo-lomito", "Combo Lomito", 18, "Pico Bolívar y Pico Toro, más un refresco de 1 L.", None),
    ("combo-chicken", "Combo Chicken", 18, "Dos burgers de pollo a escoger, más un refresco de 1 L.", ("Crispy", "A la plancha")),
    ("combo-1y1", "Combo 1 y 1", 18, "Una burger de carne y una de pollo a escoger, más un refresco de 1 L. No incluye Pico Bolívar ni Pico La Torre.", None),
    ("combo-cheese-chips", "Cheeseburger x4 con chips", 18, "Cuatro cheeseburgers con 2 raciones de papas chips.", None),
    ("combo-cheese-4", "Cheeseburger x4", 16, "Cuatro cheeseburgers, sin papas chips.", None),
]
# grupos de la carta sin foto: título, nota, [(id, nombre, precio, detalle)]
EXTRAS = [
    ("Entradas", None, [
        ("servicio-chips", "Servicio de chips", 5, "Con 2 salsas a escoger."),
        ("tequenos", "Tequeños", 6, "Acompañados de salsa tártara."),
        ("papas-francesas", "Servicio de papas francesas", 6, "Con 2 salsas a escoger."),
        ("tenders", "Tenders de pollo", 7, "Con papas francesas y salsa a escoger."),
        ("ensalada-cesar", "Ensalada César", 9, "Con pollo crispy o a la plancha."),
        ("papas-la-culata", "Papas La Culata", 9, "Bañadas en fondue de queso mozzarella, tocineta y maíz."),
        ("papas-mifafi", "Papas Mifafi", 11, "Con chuleta, lomito o pollo a la plancha, tocineta, maíz, salsas clásicas y queso de año."),
    ]),
    ("Platos", "Con acompañante: papas francesas, chips, puré de papa, ensalada César o coleslaw.", [
        ("pollo-plancha-crispy", "Pollo a la plancha o crispy", 8, ""),
        ("chuleta-bbq", "Chuleta ahumada con salsa BBQ", 8, ""),
        ("lomito-salteado", "Lomito salteado con cebolla y pimentón en salsa BBQ", 9, ""),
        ("lomito-gratinado", "Lomito gratinado con fondue de queso mozzarella", 9, ""),
        ("pechuga-parmigiana", "Pechuga a la parmigiana", 9, ""),
        ("pollo-crema-champinones", "Pollo en crema blanca de champiñones y tocineta", 10, "A la plancha o crispy."),
    ]),
    ("Bebidas", None, [
        ("refresco-personal", "Refresco personal", 1, ""),
        ("refresco-1l", "Refresco 1 L", 2.5, ""),
        ("refresco-15l", "Refresco 1,5 L", 3, ""),
        ("refresco-2l", "Refresco 2 L", 3.5, ""),
    ]),
]

# Adicionales: se eligen dentro de la ventana de cada hamburguesa (id, nombre, precio)
ADICIONALES = [
        ("add-queso-kraft", "Queso Facilita Kraft", 1),
        ("add-queso-asado", "Queso asado", 1),
        ("add-cebolla-caramelizada", "Cebollas caramelizadas", 1),
        ("add-huevo", "Huevo", 1),
        ("add-aguacate", "Aguacate", 1),
        ("add-maiz", "Maíz", 1),
        ("add-fondue", "Fondue de queso mozzarella", 1.5),
        ("add-cebolla-vino", "Cebollas caramelizadas en vino", 1.5),
        ("add-tocineta", "Tocineta", 1.5),
        ("add-champinones", "Champiñones", 1.5),
        ("add-chorizo", "Chorizo", 2),
        ("add-carne", "Carne 150 g", 2),
        ("add-pollo-plancha", "Pollo a la plancha", 2),
        ("add-lomito", "Lomito 150 g", 2.5),
        ("add-chuleta", "Chuleta", 2.5),
        ("add-pollo-crispy", "Pollo crispy", 2.5),
    ]

e = lambda s: html.escape(str(s), quote=True)

def money(n):
    return f"${n:g}" if float(n).is_integer() else f"${n:.2f}".replace(".", ",")

def alt_txt(a):
    return f"{a:,}".replace(",", ".") + " m.s.n.m."

PEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 20 7-12 4 6 3-4 6 10H2Z"/></svg>'
PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'

def options(pid, opts):
    if not opts:
        return ""
    radios = "".join(
        f'<label><input type="radio" name="opt-{e(pid)}" value="{e(o)}"{" checked" if i == 0 else ""}><span>{e(o)}</span></label>'
        for i, o in enumerate(opts))
    return f'<fieldset class="opts"><legend class="sr">Preparación del pollo</legend>{radios}</fieldset>'

def card(pid, name, alt, price, desc, opts, cat, featured=False, combo=False, custom=False):
    cls = "card" + (" card--feature" if featured else "") + (" card--combo" if combo else "")
    w, h = (720, 228) if combo else (520, 520)
    alt_html = f'<p class="card__alt">{PEAK}<span>{alt_txt(alt)}</span></p>' if alt else ""
    badge = '<span class="card__badge">El pico más alto</span>' if featured else ""
    custom_attr = ' data-custom' + (f' data-options="{e("|".join(opts))}"' if opts else "") if custom else ""
    if custom and opts:
        opts_html = f'<p class="card__opt">{e(" o ".join(o.lower() for o in opts)).capitalize()}, tú eliges</p>'
    else:
        opts_html = options(pid, opts)
    return f'''        <article class="{cls}" data-cat="{cat}" data-id="{e(pid)}" data-name="{e(name)}" data-price="{price}" data-alt="{alt or 0}"{custom_attr}>
          <div class="card__media">{badge}<img src="assets/menu/{e(pid)}.webp" alt="{e(name)}" width="{w}" height="{h}" loading="lazy" decoding="async"></div>
          <div class="card__body">
            {alt_html}
            <h3 class="card__name">{e(name)}</h3>
            <p class="card__desc">{e(desc)}</p>
            {opts_html}
            <div class="card__foot">
              <span class="price">{money(price)}</span>
              <button class="add" type="button" data-add aria-label="Añadir {e(name)} al carrito">{PLUS}<span>Añadir al carrito</span></button>
            </div>
          </div>
        </article>'''

def build():
    out = ['        <div class="grid" data-grid>']
    for i, it in enumerate(CARNE):
        out.append(card(*it[:5], it[5], "carne", featured=(it[0] == "pico-bolivar"), custom=True))
    for it in POLLO:
        out.append(card(*it[:5], it[5], "pollo", custom=True))
    out.append("        </div>")
    out.append('        <h3 class="subhead" data-cat="combos">Combos <span>para subir en grupo</span></h3>')
    out.append('        <div class="grid grid--combos">')
    for pid, name, price, desc, opts in COMBOS:
        out.append(card(pid, name, None, price, desc, opts, "combos", combo=True))
    out.append("        </div>")
    out.append('        <h3 class="subhead" data-cat="extras">Para acompañar <span>entradas, platos, bebidas y extras</span></h3>')
    out.append('        <div class="carta" data-cat="extras">')
    for title, note, items in EXTRAS:
        rows = []
        for pid, name, price, det in items:
            det_html = f'<small>{e(det)}</small>' if det else ""
            rows.append(f'''              <li class="row" data-id="{e(pid)}" data-name="{e(name)}" data-price="{price}">
                <div class="row__txt"><span class="row__name">{e(name)}</span>{det_html}</div>
                <span class="row__dots" aria-hidden="true"></span>
                <span class="price">{money(price)}</span>
                <button class="add add--icon" type="button" data-add aria-label="Añadir {e(name)} al carrito">{PLUS}</button>
              </li>''')
        note_html = f'<p class="carta__note">{e(note)}</p>' if note else ""
        out.append(f'''          <section class="carta__group">
            <h4 class="carta__title">{e(title)}</h4>
            {note_html}
            <ul>
{chr(10).join(rows)}
            </ul>
          </section>''')
    out.append("        </div>")
    return "\n".join(out)

def build_extras():
    out = []
    for pid, name, price in ADICIONALES:
        out.append(f'''            <label class="xtra"><input type="checkbox" value="{e(pid)}" data-name="{e(name)}" data-price="{price}"><span class="xtra__box" aria-hidden="true"></span><span class="xtra__name">{e(name)}</span><span class="xtra__price">+{money(price)}</span></label>''')
    return "\n".join(out)

if __name__ == "__main__":
    p = pathlib.Path(__file__).resolve().parent.parent / "index.html"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"<!-- MENU:START -->.*?<!-- MENU:END -->",
               lambda m: "<!-- MENU:START -->\n" + build() + "\n<!-- MENU:END -->", s, flags=re.S)
    s = re.sub(r"<!-- EXTRAS:START -->.*?<!-- EXTRAS:END -->",
               lambda m: "<!-- EXTRAS:START -->\n" + build_extras() + "\n            <!-- EXTRAS:END -->", s, flags=re.S)
    p.write_text(s, encoding="utf-8")
    print("menú generado")
