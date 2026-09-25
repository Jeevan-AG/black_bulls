"""
Vantix SDK for Python
Official developer SDK for integrating Vantix Silent AI Data Firewall into
Python AI pipelines (LangChain, LlamaIndex, AutoGen, CrewAI, FastAPI, etc.)

Usage:
    from vantix import VantixClient
    vantix = VantixClient(endpoint="http://localhost:5000")
    res = vantix.chat("What registers map to 0x4001?", user_id="engineer-1")
    print(res["response"])
"""

import json
import os
import urllib.request
import urllib.error
from typing import Optional, Dict, Any


class VantixClient:
    def __init__(
        self,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        org_id: Optional[str] = None,
        timeout: int = 30,
    ):
        self.endpoint = (endpoint or os.environ.get("VANTIX_GATEWAY_URL", "http://localhost:5000")).rstrip("/")
        self.api_key = api_key or os.environ.get("VANTIX_API_KEY", "")
        self.org_id = org_id or os.environ.get("VANTIX_ORG_ID", "default-org")
        self.timeout = timeout

    def chat(
        self,
        prompt: str,
        user_id: str = "anonymous",
        user_email: str = "",
        session_id: Optional[str] = None,
        app_id: str = "python-sdk",
    ) -> Dict[str, Any]:
        """
        Pass prompt through Vantix 7-step pipeline:
        Intercept -> Detect -> Redact -> Forward -> Restore -> Log -> Return
        """
        if not prompt or not isinstance(prompt, str):
            raise ValueError("[VantixSDK] prompt must be a non-empty string")

        url = f"{self.endpoint}/api/vantix/chat"
        payload = json.dumps({
            "prompt": prompt,
            "userId": user_id,
            "userEmail": user_email,
            "sessionId": session_id or f"py-sess-{os.urandom(4).hex()}",
            "orgId": self.org_id,
            "appId": app_id,
        }).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "X-Vantix-SDK": "python-v2.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                return json.loads(err_body)
            except Exception:
                raise RuntimeError(f"[VantixSDK] HTTP {e.code}: {e.reason}")
        except Exception as e:
            raise RuntimeError(f"[VantixSDK] Connection failed: {e}")

    def get_attestation(self) -> Dict[str, Any]:
        """Fetch TEE cryptographic attestation and enclave integrity report."""
        url = f"{self.endpoint}/api/vantix/attestation"
        req = urllib.request.Request(url, headers={"X-Vantix-SDK": "python-v2.0"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))


# Global default client instance
_default_client = VantixClient()


def chat(prompt: str, **kwargs) -> Dict[str, Any]:
    return _default_client.chat(prompt, **kwargs)


def get_attestation() -> Dict[str, Any]:
    return _default_client.get_attestation()
