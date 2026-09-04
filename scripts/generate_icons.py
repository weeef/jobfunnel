import zlib
import struct
import os

def create_png(width, height, get_pixel_rgba):
    """Generate a valid PNG file in pure Python without third-party libraries."""
    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk: width(4), height(4), bit_depth(1), color_type(1, 6=RGBA),
    # compression(1), filter(1), interlace(1)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # Scanlines: each line starts with filter byte 0 (None), then RGBA bytes
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter type 0
        for x in range(width):
            r, g, b, a = get_pixel_rgba(x, y, width, height)
            raw_data.extend((r, g, b, a))
            
    compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return png_signature + ihdr_chunk + idat_chunk + iend_chunk

def icon_shader(x, y, w, h):
    # Normalized coords [0, 1]
    nx = x / (w - 1) if w > 1 else 0.5
    ny = y / (h - 1) if h > 1 else 0.5
    
    # Rounded rectangle mask
    radius = 0.22
    corner_x = min(nx, 1.0 - nx)
    corner_y = min(ny, 1.0 - ny)
    
    in_box = True
    if corner_x < radius and corner_y < radius:
        dist = ((radius - corner_x)**2 + (radius - corner_y)**2)**0.5
        if dist > radius:
            in_box = False
            
    if not in_box:
        return (0, 0, 0, 0)
        
    # Background gradient: vibrant indigo (#4f46e5) to emerald (#059669)
    # Diagonal gradient
    t = (nx + ny) / 2.0
    r = int(59 * (1 - t) + 16 * t)
    g = int(130 * (1 - t) + 185 * t)
    b = int(246 * (1 - t) + 129 * t)
    
    # Draw a stylized "Funnel" / "Briefcase" glyph in white
    # Funnel top width: from 0.25 to 0.75 at y=0.30
    # Funnel throat: from 0.42 to 0.58 at y=0.60
    # Funnel stem: from 0.44 to 0.56 from y=0.60 to 0.78
    
    is_glyph = False
    
    # Upper funnel trapezoid
    if 0.28 <= ny <= 0.56:
        # width narrows as ny increases
        progress = (ny - 0.28) / (0.56 - 0.28)
        half_w = 0.26 * (1 - progress) + 0.09 * progress
        if abs(nx - 0.5) <= half_w:
            is_glyph = True
            
    # Lower funnel stem
    if 0.56 < ny <= 0.76:
        if abs(nx - 0.5) <= 0.08:
            is_glyph = True
            
    # Accent ring/dot at bottom (representing offer / goal)
    if ((nx - 0.5)**2 + (ny - 0.74)**2)**0.5 <= 0.09:
        is_glyph = True

    if is_glyph:
        return (255, 255, 255, 255)
        
    return (r, g, b, 255)

def main():
    os.makedirs('assets/icons', exist_ok=True)
    sizes = [16, 32, 48, 128]
    for size in sizes:
        png_bytes = create_png(size, size, icon_shader)
        out_path = os.path.join('assets', 'icons', f'icon-{size}.png')
        with open(out_path, 'wb') as f:
            f.write(png_bytes)
        print(f"Generated {out_path} ({len(png_bytes)} bytes)")

if __name__ == '__main__':
    main()
