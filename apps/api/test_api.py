import asyncio
from main import app
from httpx import AsyncClient, ASGITransport

async def test():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        print("Checking Health...")
        health = await client.get("/health")
        print("Health Status:", health.status_code)
        print("Health Response:", health.json())

        print("\nChecking Chat...")
        try:
            chat = await client.post("/chat", json={"message": "I have a headache"})
            print("Chat Status:", chat.status_code)
            # print("Chat Response:", chat.json()) # Verbose
        except Exception as e:
            print("Chat failed:", e)

        print("\nChecking Debug Preview...")
        try:
            debug = await client.get("/debug/directory/preview")
            print("Debug Status:", debug.status_code)
            print("Debug Data:", debug.json())
        except Exception as e:
            print("Debug failed:", e)

        print("\nChecking Safety: Emergency...")
        try:
            em = await client.post("/chat", json={"message": "I have chest pain"})
            print("Emergency Status:", em.status_code)
            print("Emergency Urgency:", em.json().get("urgency"))
            print("Emergency Flags:", em.json().get("safety_flags"))
        except Exception as e:
            print("Emergency Chat failed:", e)

        print("\nChecking Safety: Refusal...")
        try:
            ref = await client.post("/chat", json={"message": "What is the dosage for ibuprofen?"})
            print("Refusal Status:", ref.status_code)
            print("Refusal Urgency:", ref.json().get("urgency"))
            print("Refusal Flags:", ref.json().get("safety_flags"))
        except Exception as e:
            print("Refusal Chat failed:", e)
            
        print("\nChecking Safety: Allowed...")
        try:
            allow = await client.post("/chat", json={"message": "I have a headache"})
            print("Allowed Urgency:", allow.json().get("urgency"))
            print("Disclaimer Present:", "I’m not a doctor" in allow.json().get("assistant_message", ""))
        except Exception as e:
            print("Allowed Chat failed:", e)

        print("\nChecking RAG: Fever (Expecting Citations)...")
        try:
            rag = await client.post("/chat", json={"message": "How do I treat a fever at home?", "mode": "rag"})
            print("RAG Status:", rag.status_code)
            data = rag.json()
            if rag.status_code != 200:
                print("RAG Error:", data)
            print("Citations Count:", len(data.get("citations", [])))
            if data.get("citations"):
                print("First Citation Title:", data["citations"][0]["title"])
        except Exception as e:
            print("RAG Chat failed:", e)

if __name__ == "__main__":
    asyncio.run(test())
