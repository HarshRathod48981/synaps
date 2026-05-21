"""
Generate mock test images for development.
Run: python3 generate_mock_data.py
"""
import os
import random
import struct
import zlib

def create_minimal_png(width, height, r, g, b):
    """Create a minimal valid PNG file without Pillow."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
    
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = chunk(b'IHDR', ihdr_data)
    
    # IDAT - raw image data
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            raw_data += bytes([r, g, b])
    
    compressed = zlib.compress(raw_data)
    idat = chunk(b'IDAT', compressed)
    
    # IEND
    iend = chunk(b'IEND', b'')
    
    return sig + ihdr + idat + iend


dirs = [
    'mock_storage/Vault/Harsh/Iphone',
    'mock_storage/Vault/Harsh/Mac',
    'mock_storage/Vault/Dad/Memories',
    'mock_storage/Vault/Mom/Memories',
    'mock_storage/Vault/Sister/Memories',
    'mock_storage/Vault/Windows_laptop-HP/photos',
    'mock_storage/Vault/Windows_laptop-HP/Screenshots',
    'mock_storage/Imports/Harsh',
]

colors = [
    (59, 130, 246), (139, 92, 246), (236, 72, 153),
    (245, 158, 11), (34, 197, 94), (168, 85, 247),
    (251, 113, 133), (96, 165, 250),
]

count = 0
for d in dirs:
    os.makedirs(d, exist_ok=True)
    for i in range(6):
        r, g, b = random.choice(colors)
        w, h = random.choice([(200, 150), (150, 200), (200, 200)])
        year = 2020 + random.randint(0, 5)
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        
        name = f'IMG_{year}_{month:02d}_{day:02d}_{count:04d}.png'
        filepath = os.path.join(d, name)
        
        png_data = create_minimal_png(w, h, r, g, b)
        with open(filepath, 'wb') as f:
            f.write(png_data)
        
        count += 1

print(f'Created {count} test images')
