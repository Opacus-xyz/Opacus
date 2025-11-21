from PIL import Image, ImageDraw, ImageFont
import os

# Create a 256x64 PNG logo
width, height = 256, 64
img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)

# Draw blue icon (simplified geometric shape)
icon_size = 40
icon_x = 12
icon_y = (height - icon_size) // 2

# Draw a hexagon-like shape
points = [
    (icon_x + icon_size//2, icon_y),
    (icon_x + icon_size, icon_y + icon_size//4),
    (icon_x + icon_size, icon_y + 3*icon_size//4),
    (icon_x + icon_size//2, icon_y + icon_size),
    (icon_x, icon_y + 3*icon_size//4),
    (icon_x, icon_y + icon_size//4)
]
draw.polygon(points, fill='#2563eb')

# Draw center circle
center_x = icon_x + icon_size//2
center_y = icon_y + icon_size//2
circle_radius = 8
draw.ellipse([center_x - circle_radius, center_y - circle_radius, 
              center_x + circle_radius, center_y + circle_radius], 
             fill='white')

# Draw text "Opacus"
text_x = icon_x + icon_size + 16
text_y = height // 2 - 16

# Try to use a system font, fallback to default
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
except:
    try:
        font = ImageFont.truetype("/Library/Fonts/Arial.ttf", 36)
    except:
        font = ImageFont.load_default()

draw.text((text_x, text_y), "Opacus", fill='#111827', font=font)

# Save the image
img.save('logo.png')
print("Logo created: logo.png")
