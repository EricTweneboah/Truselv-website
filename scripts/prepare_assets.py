"""Create web derivatives from supplied assets; never modify the originals."""
from pathlib import Path
import shutil
import subprocess
from PIL import Image
from fontTools.ttLib import TTFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
BRAND = ROOT / 'images/TruSelv_Brand_Kit'
for src, dst in [
    ('01_Logos/SVG/truselv-logo-horizontal-primary.svg', 'logo.svg'),
    ('01_Logos/SVG/truselv-logo-horizontal-white.svg', 'logo-white.svg'),
    ('01_Logos/Bedbord/bedbord-by-truselv-primary.svg', 'bedbord-logo.svg'),
    ('06_Digital/Icons/favicon.ico', 'favicon.ico'),
    ('06_Digital/Icons/truselv-app-icon-180.png', 'apple-touch-icon.png'),
]:
    shutil.copyfile(BRAND / src, OUT / dst)
for font in ['Manrope', 'SourceSans3']:
    f = TTFont(BRAND / f'03_Typography/Fonts/{font}-Variable.ttf')
    f.flavor = 'woff2'
    f.save(OUT / f'{font}.woff2')
    shutil.copyfile(BRAND / f'03_Typography/Fonts/OFL-{font}.txt', OUT / f'OFL-{font}.txt')
for src, dst in [('images/products/bedbord.png','bedbord-room'),('images/products/bedbordui.png','bedbord-screen'),('images/ERIC.png','eric'),('images/kila.png','michaela'),('images/OSAM.png','osam')]:
    im = Image.open(ROOT / src).convert('RGBA')
    im.thumbnail((1600, 1400))
    im.save(OUT / f'{dst}.webp', quality=87)
for src in (ROOT / 'tess_marketing_kit/images_web').glob('*.webp'):
    im = Image.open(src)
    im.thumbnail((1440, 1440))
    im.save(OUT / ('tess-' + src.name[3:]), quality=85)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
for source, name in [('welcome.mp4','welcome'),('Bedbord product video.mp4','bedbord'),('TESS PAGE VIDEO.mp4','tess')]:
    # Source welcome/TESS have black letterboxing. Keep originals available in Videos.
    filters = 'crop=1440:810:0:135,scale=1440:-2' if name != 'bedbord' else 'scale=1680:-2'
    subprocess.run([ffmpeg,'-y','-i',str(ROOT/'Videos'/source),'-vf',filters,'-c:v','libx264','-crf','23','-preset','medium','-c:a','aac','-b:a','128k','-movflags','+faststart',str(OUT/f'{name}.mp4')], capture_output=True, check=True)
    subprocess.run([ffmpeg,'-y','-ss','2','-i',str(OUT/f'{name}.mp4'),'-frames:v','1',str(OUT/f'{name}-poster.webp')],capture_output=True,check=True)
print('Prepared brand fonts, logos, photos and three web videos.')
