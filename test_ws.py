import asyncio, websockets, json

async def test():
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type":"frame","frame_id":"test123"}))
        reply = await ws.recv()
        print("Got:", reply)

asyncio.run(test())
