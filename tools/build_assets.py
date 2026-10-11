"""Genera los recursos optimizados de la web de Cumbre a partir de 'Fotos y video/'.
Uso: python tools/build_assets.py  (desde la carpeta 'Web Cumbre')"""
import os, subprocess
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

SRC = "Fotos y video"
OUT = "assets"
os.makedirs(f"{OUT}/menu", exist_ok=True)
YEL = (250, 183, 20)

def src(name): return Image.open(os.path.join(SRC, name)).convert("RGB")

def save(im, path, q=82, maxw=None):
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=q, method=6)

def recolor_mark(im, fg_dark, color):
    """Logo bicolor -> PNG transparente en un solo color de marca.
    fg_dark=False: la marca es la parte clara (amarilla sobre negro)."""
    g = im.convert("L")
    if fg_dark:
        g = ImageChops.invert(g)
    a = g.point(lambda v: 0 if v < 60 else 255 if v > 150 else int((v - 60) * 255 / 90))
    out = Image.new("RGBA", im.size, color + (0,))
    out.putalpha(a)
    bbox = a.getbbox()
    return out.crop(bbox)

# ---- Marca
logo = recolor_mark(src("Gemini_Generated_Image_c7jofxc7jofxc7jo.jpg"), False, YEL)
logo.resize((1600, round(logo.height * 1600 / logo.width)), Image.LANCZOS).save(f"{OUT}/logo-cumbre.png", optimize=True)
logo_w = recolor_mark(src("Gemini_Generated_Image_c7jofxc7jofxc7jo.jpg"), False, (245, 241, 232))
logo_w.resize((1600, round(logo_w.height * 1600 / logo_w.width)), Image.LANCZOS).save(f"{OUT}/logo-cumbre-claro.png", optimize=True)
iso = recolor_mark(src("Gemini_Generated_Image_frjz8ofrjz8ofrjz.jpg"), False, YEL)
iso.resize((640, round(iso.height * 640 / iso.width)), Image.LANCZOS).save(f"{OUT}/isotipo.png", optimize=True)
iso.resize((64, round(iso.height * 64 / iso.width)), Image.LANCZOS).save(f"{OUT}/favicon.png", optimize=True)
# Isotipo negro (para fondos amarillos)
isok = recolor_mark(src("Gemini_Generated_Image_wh9yx2wh9yx2wh9y.jpg"), True, (29, 29, 27))
isok.resize((256, round(isok.height * 256 / isok.width)), Image.LANCZOS).save(f"{OUT}/isotipo-negro.png", optimize=True)

# ---- Montañas y mascota
save(src("Gemini_Generated_Image_94kgel94kgel94kg.jpg"), f"{OUT}/montanas.webp", 78, 2400)
save(src("Gemini_Generated_Image_94kgel94kgel94kg.jpg"), f"{OUT}/montanas-sm.webp", 74, 1100)
save(src("Gemini_Generated_Image_ff9ghdff9ghdff9g.jpg"), f"{OUT}/mascota.webp", 82, 1200)
masc = src("Gemini_Generated_Image_ff9ghdff9ghdff9g.jpg")
# Retrato cerrado del oso para el carrito / burbuja
save(masc.crop((850, 560, 1500, 1210)), f"{OUT}/mascota-cara.webp", 84, 320)

# ---- Fotos de producto recortadas del menú (coordenadas en la imagen original 1408x3048)
S = 1408 / 924
def crop_menu(fname, box, name, size=520, square=True):
    im = src(fname)
    x0, y0, x1, y1 = [round(v * S) for v in box]
    c = im.crop((x0, y0, x1, y1))
    if not square:
        c = c.resize((size, round(c.height * size / c.width)), Image.LANCZOS)
        c = c.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
        save(c, f"{OUT}/menu/{name}.webp", 84)
        return
    side = max(c.size)
    sq = Image.new("RGB", (side, side), (29, 29, 27))
    sq.paste(c, ((side - c.width) // 2, (side - c.height) // 2))
    sq = sq.resize((size, size), Image.LANCZOS)
    sq = sq.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    sq = ImageEnhance.Contrast(sq).enhance(1.04)
    save(sq, f"{OUT}/menu/{name}.webp", 84)

M1, M2 = "Menu.jpg", "Menu (2).jpg"
burgers1 = [
    ("pico-la-torre", 573), ("pico-bolivar", 683), ("double-cheese-bacon", 790),
    ("pico-codazzi", 902), ("bosque-pino", 1020), ("pico-humboldt", 1135),
    ("pico-toro", 1250), ("pico-leon", 1365), ("cheeseburger", 1478),
]
for name, top in burgers1:
    crop_menu(M1, (403, top, 507, top + 108), name)
burgers2 = [("pico-la-concha", 418), ("pico-bonpland", 645), ("pico-aguila", 745),
            ("mucubaji", 840), ("sanguchito-de-pollo", 935)]
for name, top in burgers2:
    crop_menu(M2, (42, top, 136, top + 92), name)
combos = [("combo-cheese-4", 342, 404), ("combo-cheese-chips", 470, 535), ("combo-lomito", 598, 680),
          ("combo-chicken", 740, 822), ("combo-sierra-nevada", 885, 950), ("combo-1y1", 1015, 1092)]
for name, t, b in combos:
    crop_menu(M2, (556, t - 4, 834, b + 2), name, 720, square=False)

# ---- Video del hero: sin audio, carga rápida + póster
FF = None
try:
    import imageio_ffmpeg; FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    pass
if FF:
    v = os.path.join(SRC, "gemini_generated_video_f40504be.mp4")
    subprocess.run([FF, "-v", "error", "-y", "-i", v, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "21",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{OUT}/hero.mp4"], check=True)
    subprocess.run([FF, "-v", "error", "-y", "-i", v, "-an", "-vf", "scale=-2:540", "-c:v", "libx264", "-preset", "slow",
                    "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{OUT}/hero-540.mp4"], check=True)
    subprocess.run([FF, "-v", "error", "-y", "-i", v, "-vframes", "1", "-q:v", "3", f"{OUT}/_poster.jpg"], check=True)
    save(Image.open(f"{OUT}/_poster.jpg").convert("RGB"), f"{OUT}/hero-poster.webp", 76)
    os.remove(f"{OUT}/_poster.jpg")
print("ok")
