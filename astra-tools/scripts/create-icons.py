from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
out = Path('public/icons')
out.mkdir(parents=True, exist_ok=True)
items = [('revisiondesk','#12533e','R'),('filefit','#2764e7','F'),('claimpack','#9a4118','C'),('sharesafe','#167356','S'),('downloadrules','#6950b6','D'),('stepguide','#185b91','G'),('replyready','#9a441f','R'),('watchdesk','#6b4db1','W'),('followupdesk','#16715f','F')]
for name,color,letter in items:
    for size in [16,32,48,128]:
        im=Image.new('RGBA',(size,size),(0,0,0,0))
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((0,0,size-1,size-1),radius=max(3,size//5),fill=color)
        font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',round(size*.65))
        box=d.textbbox((0,0),letter,font=font)
        d.text(((size-(box[2]-box[0]))/2-box[0],(size-(box[3]-box[1]))/2-box[1]),letter,font=font,fill='white')
        im.save(out/f'{name}-{size}.png')
print('Created 36 extension icons.')
