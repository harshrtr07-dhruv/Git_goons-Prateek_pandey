from PIL import Image
import os

def remove_white_bg(input_path, output_path, threshold=220):
    img = Image.open(input_path).convert("RGBA")
    data = img.load()
    width, height = img.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = data[x, y]
            if r > threshold and g > threshold and b > threshold:
                avg = (r + g + b) / 3.0
                alpha = int(255 * (255 - avg) / (255 - threshold))
                alpha = max(0, min(255, alpha))
                data[x, y] = (r, g, b, alpha)
                    
    img.save(output_path, "PNG")

try:
    remove_white_bg("public/logo.png", "public/logo_transparent.png")
    print("Background removed successfully.")
except Exception as e:
    print(f"Error: {e}")
