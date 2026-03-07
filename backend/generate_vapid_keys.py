"""Generate VAPID keys for Web Push notifications.

Run once:  python generate_vapid_keys.py
Then add the output to your .env file.
"""
from py_vapid import Vapid

vapid = Vapid()
vapid.generate_keys()

print("Add these to your .env file:\n")
print(f'VAPID_PRIVATE_KEY="{vapid.private_pem().decode().strip()}"')
print(f'VAPID_PUBLIC_KEY="{vapid.public_key_urlsafe_base64()}"')
