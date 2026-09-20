# Quick Python SDK verification script
from vantix import VantixClient

def test():
    client = VantixClient(endpoint="http://localhost:5000")
    try:
        att = client.get_attestation()
        print("Vantix Gateway Attestation:", att.get("status", "OK"))
    except Exception as e:
        print("Gateway check:", e)

if __name__ == "__main__":
    test()
