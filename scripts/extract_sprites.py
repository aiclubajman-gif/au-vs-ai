import os
import json
import numpy as np
from PIL import Image
from collections import deque
# Pure Python BFS noise filter
def filter_tiny_specks(arr, min_size=30):
    h, w, _ = arr.shape
    alpha = arr[:, :, 3] > 0
    visited = np.zeros((h, w), dtype=bool)

    for y in range(h):
        for x in range(w):
            if alpha[y, x] and not visited[y, x]:
                # BFS to find component size
                component = []
                queue = deque([(y, x)])
                visited[y, x] = True
                while queue:
                    cy, cx = queue.popleft()
                    component.append((cy, cx))
                    for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not visited[ny, nx]:
                            visited[ny, nx] = True
                            queue.append((ny, nx))
                if len(component) < min_size:
                    for cy, cx in component:
                        arr[cy, cx, 3] = 0
    return arr

MOCK_DIR = r"C:\Uni\Personal Projects\AI game club fair\Proposed mock"
OUT_DIR = r"c:\Uni\Personal Projects\AI game club fair\Code\au-vs-ai\public\sprites"

os.makedirs(OUT_DIR, exist_ok=True)

def remove_bg_flood(im, bg_type="dark_navy", tolerance=45):
    """
    Flood-fills background from perimeter, turning background pixels transparent.
    Leaves dark pixel outlines intact.
    """
    arr = np.array(im.convert("RGBA"))
    h, w, _ = arr.shape
    
    corners = [
        arr[0, 0][:3],
        arr[0, w-1][:3],
        arr[h-1, 0][:3],
        arr[h-1, w-1][:3]
    ]
    bg_color = np.median(corners, axis=0).astype(float)

    visited = np.zeros((h, w), dtype=bool)
    mask = np.zeros((h, w), dtype=bool)
    queue = deque()

    for x in range(w):
        for y in [0, h-1]:
            diff = np.linalg.norm(arr[y, x][:3] - bg_color)
            if diff < tolerance:
                queue.append((y, x))
                visited[y, x] = True
                mask[y, x] = True
    for y in range(h):
        for x in [0, w-1]:
            if not visited[y, x]:
                diff = np.linalg.norm(arr[y, x][:3] - bg_color)
                if diff < tolerance:
                    queue.append((y, x))
                    visited[y, x] = True
                    mask[y, x] = True

    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                pix = arr[ny, nx][:3].astype(float)
                
                if bg_type == "grass":
                    # Pixel is green grass if G is higher than R and B
                    is_green = (pix[1] > pix[0] + 12) and (pix[1] > pix[2] + 12)
                    diff = np.linalg.norm(pix - bg_color)
                    if is_green or diff < tolerance:
                        mask[ny, nx] = True
                        queue.append((ny, nx))
                else: # dark navy
                    diff = np.linalg.norm(pix - bg_color)
                    # Stay within dark blues/blacks
                    is_dark = (pix[0] < 45 and pix[1] < 45 and pix[2] < 70)
                    if diff < tolerance or is_dark:
                        mask[ny, nx] = True
                        queue.append((ny, nx))

    arr[mask, 3] = 0
    
    # Filter out tiny orphan noise specks (< 35 pixels)
    arr = filter_tiny_specks(arr, min_size=35)
    return Image.fromarray(arr)

def auto_crop_alpha(im, padding=4):
    arr = np.array(im)
    alpha = arr[:, :, 3]
    non_empty = np.where(alpha > 10)
    if len(non_empty[0]) == 0 or len(non_empty[1]) == 0:
        return im
    min_y, max_y = np.min(non_empty[0]), np.max(non_empty[0])
    min_x, max_x = np.min(non_empty[1]), np.max(non_empty[1])
    
    h, w = arr.shape[:2]
    crop_box = (
        max(0, min_x - padding),
        max(0, min_y - padding),
        min(w, max_x + padding + 1),
        min(h, max_y + padding + 1)
    )
    return im.crop(crop_box)

manifest = {}

def process_sprite(name, source_file, bbox, bg_type="dark_navy", tolerance=45, trim_bottom=0, trim_top=0):
    src_path = os.path.join(MOCK_DIR, source_file)
    src_im = Image.open(src_path)
    cropped = src_im.crop(bbox)
    
    if trim_bottom > 0:
        cw, ch = cropped.size
        cropped = cropped.crop((0, 0, cw, ch - trim_bottom))
    if trim_top > 0:
        cw, ch = cropped.size
        cropped = cropped.crop((0, trim_top, cw, ch))

    alpha_im = remove_bg_flood(cropped, bg_type=bg_type, tolerance=tolerance)
    final_im = auto_crop_alpha(alpha_im)
    
    png_path = os.path.join(OUT_DIR, f"{name}.png")
    webp_path = os.path.join(OUT_DIR, f"{name}.webp")
    
    final_im.save(png_path, "PNG")
    final_im.save(webp_path, "WEBP", quality=95)
    
    manifest[name] = {
        "width": final_im.width,
        "height": final_im.height,
        "png": f"/sprites/{name}.png",
        "webp": f"/sprites/{name}.webp",
        "source": source_file
    }
    print(f"[OK] Extracted {name} ({final_im.width}x{final_im.height})")

def main():
    print("Extracting high-fidelity pixel art sprites...")

    # =========================================================================
    # 1. Human Character Sprites
    # =========================================================================
    # Red cap boy (isolated clean from Homepage)
    process_sprite("char-boy-redcap", "Homepage.png", (145, 225, 295, 385), bg_type="grass", tolerance=65)
    
    # Red cap boy cheering (fist pump from mround2)
    process_sprite("char-boy-cheer", "mround2.png", (750, 1450, 935, 1665), bg_type="dark_navy", tolerance=40, trim_bottom=2)
    
    # Brown hair boy perplexed with ? (from mround3)
    process_sprite("char-boy-puzzled", "mround3.png", (38, 845, 220, 1090), bg_type="dark_navy", tolerance=42, trim_bottom=10)
    
    # Girl with straw hat (from Homepage)
    process_sprite("char-girl-strawhat", "Homepage.png", (295, 160, 445, 320), bg_type="grass", tolerance=65)
    
    # Boy in blue hoodie (from Homepage)
    process_sprite("char-boy-bluehoodie", "Homepage.png", (165, 405, 305, 565), bg_type="grass", tolerance=65)

    # Girl with red cap & backpack (from round3)
    process_sprite("char-girl-cap", "round3.png", (12, 625, 178, 878), bg_type="grass", tolerance=65)

    # Cheering duo on cliff platform (from humanwin)
    hw = Image.open(os.path.join(MOCK_DIR, "humanwin.png"))
    hw_humans = hw.crop((10, 440, 420, 770))
    hw_humans.save(os.path.join(OUT_DIR, "char-humans-win.png"))
    hw_humans.save(os.path.join(OUT_DIR, "char-humans-win.webp"), quality=95)
    manifest["char-humans-win"] = {"width": hw_humans.width, "height": hw_humans.height, "png": "/sprites/char-humans-win.png"}
    print("[OK] Saved char-humans-win")

    # Defeated humans on cliff (from aiwin)
    aw = Image.open(os.path.join(MOCK_DIR, "aiwin.png"))
    aw_humans = aw.crop((10, 430, 350, 730))
    aw_humans.save(os.path.join(OUT_DIR, "char-humans-defeat.png"))
    aw_humans.save(os.path.join(OUT_DIR, "char-humans-defeat.webp"), quality=95)
    manifest["char-humans-defeat"] = {"width": aw_humans.width, "height": aw_humans.height, "png": "/sprites/char-humans-defeat.png"}
    print("[OK] Saved char-humans-defeat")

    # =========================================================================
    # 2. Robot Sprites
    # =========================================================================
    # Standing proud monitor robot (from Homepage)
    process_sprite("robot-monitor-standing", "Homepage.png", (1145, 280, 1275, 440), bg_type="dark_navy", tolerance=45)

    # Waving monitor robot (from Homepage)
    process_sprite("robot-monitor-waving", "Homepage.png", (1205, 125, 1345, 285), bg_type="dark_navy", tolerance=45)

    # Peeking robot on edge (from mround2)
    process_sprite("robot-peek", "mround2.png", (760, 485, 935, 795), bg_type="dark_navy", tolerance=45)

    # Arms crossed robot with sparkle (from mround3)
    process_sprite("robot-arms-crossed", "mround3.png", (710, 845, 915, 1090), bg_type="dark_navy", tolerance=45, trim_bottom=12)

    # Thinking robot with hand on chin (from round3)
    process_sprite("robot-thinking", "round3.png", (1420, 580, 1640, 880), bg_type="dark_navy", tolerance=45)

    # 3 Individual dancing robots from aiwin with precise tight bboxes
    process_sprite("robot-cheer-arms-up", "aiwin.png", (1370, 100, 1640, 345), bg_type="dark_navy", tolerance=45)
    process_sprite("robot-dancing-notes", "aiwin.png", (1370, 348, 1640, 620), bg_type="dark_navy", tolerance=45)
    process_sprite("robot-sparkler", "aiwin.png", (1370, 625, 1640, 930), bg_type="dark_navy", tolerance=45)

    # Full party robot column
    aw_robots = aw.crop((1350, 90, 1660, 935))
    aw_robots.save(os.path.join(OUT_DIR, "robot-party-column.png"))
    aw_robots.save(os.path.join(OUT_DIR, "robot-party-column.webp"), quality=95)
    manifest["robot-party-column"] = {"width": aw_robots.width, "height": aw_robots.height, "png": "/sprites/robot-party-column.png"}
    print("[OK] Saved robot-party-column")

    # =========================================================================
    # 3. Cyber Mascots (Penguin Duo)
    # =========================================================================
    process_sprite("mascot-penguins-win", "humanwin.png", (1230, 360, 1650, 810), bg_type="dark_navy", tolerance=45)
    process_sprite("mascot-shrug-left", "aiwin.png", (350, 355, 595, 715), bg_type="dark_navy", tolerance=45)
    process_sprite("mascot-shrug-right", "aiwin.png", (1085, 355, 1335, 715), bg_type="dark_navy", tolerance=45)

    # =========================================================================
    # 4. Badges & Icons
    # =========================================================================
    process_sprite("badge-crown-gold", "mhumanWin.png", (405, 95, 535, 170), bg_type="dark_navy", tolerance=42)
    process_sprite("badge-laurel-left", "humanwin.png", (525, 330, 630, 520), bg_type="dark_navy", tolerance=45)
    process_sprite("badge-laurel-right", "humanwin.png", (1000, 330, 1105, 520), bg_type="dark_navy", tolerance=45)
    process_sprite("badge-trophy-rank1", "humanwin.png", (460, 595, 820, 695), bg_type="dark_navy", tolerance=35)
    process_sprite("badge-beat-percentile", "humanwin.png", (835, 595, 1205, 695), bg_type="dark_navy", tolerance=35)

    # =========================================================================
    # 5. Background Flanks & Backdrops
    # =========================================================================
    hp = Image.open(os.path.join(MOCK_DIR, "Homepage.png"))
    flank_meadow = hp.crop((0, 0, 650, 941))
    flank_meadow.save(os.path.join(OUT_DIR, "flank-meadow-left.png"))
    flank_meadow.save(os.path.join(OUT_DIR, "flank-meadow-left.webp"), quality=90)
    manifest["flank-meadow-left"] = {"width": 650, "height": 941, "png": "/sprites/flank-meadow-left.png"}
    print("[OK] Saved flank-meadow-left")

    flank_circuit = hp.crop((1050, 0, 1672, 941))
    flank_circuit.save(os.path.join(OUT_DIR, "flank-circuit-right.png"))
    flank_circuit.save(os.path.join(OUT_DIR, "flank-circuit-right.webp"), quality=90)
    manifest["flank-circuit-right"] = {"width": 622, "height": 941, "png": "/sprites/flank-circuit-right.png"}
    print("[OK] Saved flank-circuit-right")

    m3 = Image.open(os.path.join(MOCK_DIR, "mround3.png"))
    m3.save(os.path.join(OUT_DIR, "bg-mobile-circuit.png"))
    m3.save(os.path.join(OUT_DIR, "bg-mobile-circuit.webp"), quality=90)
    manifest["bg-mobile-circuit"] = {"width": 940, "height": 1672, "png": "/sprites/bg-mobile-circuit.png"}
    print("[OK] Saved bg-mobile-circuit")

    # Write Manifest
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written with {len(manifest)} assets to {manifest_path}")

    # Generate HTML Preview Gallery
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AU vs AI — 16-Bit Sprite Catalog</title>
<style>
  body {
    background: #020617;
    color: #f8fafc;
    font-family: monospace;
    padding: 24px;
    margin: 0;
  }
  h1 { color: #facc15; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
    margin-top: 24px;
  }
  .card {
    background: #0f172a;
    border: 2px solid #1e293b;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .preview-box {
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: 
      linear-gradient(45deg, #1e293b 25%, transparent 25%), 
      linear-gradient(-45deg, #1e293b 25%, transparent 25%), 
      linear-gradient(45deg, transparent 75%, #1e293b 75%), 
      linear-gradient(-45deg, transparent 75%, #1e293b 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    background-color: #0b0f19;
    border-radius: 8px;
    overflow: hidden;
  }
  img {
    max-height: 160px;
    max-width: 90%;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .label {
    margin-top: 12px;
    font-weight: bold;
    font-size: 13px;
    color: #38bdf8;
    word-break: break-word;
  }
  .dims {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 4px;
  }
</style>
</head>
<body>
  <h1>AU vs AI — 16-Bit Retro Pixel Sprite Catalog</h1>
  <p>Phase 1 Extracted Sprites (Transparent Alpha + WebP/PNG optimized):</p>
  <div class="grid">
"""
    for name, data in sorted(manifest.items()):
        html += f"""
    <div class="card">
      <div class="preview-box">
        <img src="{name}.png" alt="{name}">
      </div>
      <div class="label">{name}</div>
      <div class="dims">{data['width']} x {data['height']} px</div>
    </div>
"""
    html += """
  </div>
</body>
</html>
"""
    preview_path = os.path.join(OUT_DIR, "preview.html")
    with open(preview_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[OK] Preview gallery written to {preview_path}")

if __name__ == "__main__":
    main()
