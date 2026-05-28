from PIL import Image
import pillow_heif
pillow_heif.register_heif_opener()
img = Image.open('/storage/Vault/Harsh/Iphone/IMG_3130.HEIC')
img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
print("SUCCESS")
