import httpx
import asyncio
import time
import uuid

async def test_auth():
    base_url = "http://127.0.0.1:8000/api/auth"
    client = httpx.AsyncClient()
    
    unique_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    
    # 0. Signup
    print(f"Testing Signup for {unique_email}...")
    signup_resp = await client.post(f"{base_url}/signup", json={"email": unique_email, "password": "Password123!"})
    print(f"Status: {signup_resp.status_code}")
    
    # Wait to avoid 429
    await asyncio.sleep(2)
    
    # 1. Login
    print("\nTesting Login...")
    response = await client.post(f"{base_url}/login", json={"email": unique_email, "password": "Password123!"})
    
    print(f"Status: {response.status_code}")
    print(f"Cookies keys: {list(client.cookies.keys())}")
    
    acc_cookie = client.cookies.get("access_token")
    ref_cookie = client.cookies.get("refresh_token")
    
    if acc_cookie and ref_cookie:
        print("✅ Access and Refresh cookies received successfully.")
    else:
        print(f"❌ Missing cookies. Found: {list(client.cookies.keys())}")
        if response.status_code != 200:
             print(f"Error: {response.json()}")
        return
        
    await asyncio.sleep(2)
        
    # 2. Refresh
    print("\nTesting Refresh...")
    refresh_resp = await client.post(f"{base_url}/refresh")
    print(f"Status: {refresh_resp.status_code}")
    if refresh_resp.status_code == 200:
        print(f"Response: {refresh_resp.json()}")
        print(f"New cookies: {list(client.cookies.keys())}")
    else:
        print(f"Error: {refresh_resp.json()}")
    
    await asyncio.sleep(2)
    
    # 3. Logout
    print("\nTesting Logout...")
    logout_resp = await client.post(f"{base_url}/logout")
    print(f"Status: {logout_resp.status_code}")
    
    await asyncio.sleep(2)
    
    # 4. Lockout test
    print("\nTesting Lockout...")
    for i in range(6):
        resp = await client.post(f"{base_url}/login", json={"email": unique_email, "password": "WrongPassword!"})
        print(f"Attempt {i+1} status: {resp.status_code} - {resp.json().get('detail', resp.json())}")
        await asyncio.sleep(1) # just in case

    await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_auth())
