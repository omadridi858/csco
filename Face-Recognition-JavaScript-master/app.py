import asyncio
import websockets
import base64
import cv2
import numpy as np

async def handler(websocket, path):
    async for message in websocket:
        try:
            if message.startswith('data:image/jpeg;base64,'):
                # Decode the base64 image data
                image_data = base64.b64decode(message.split(",")[1])
                
                # Convert the image data to a NumPy array
                np_data = np.frombuffer(image_data, dtype=np.uint8)
                
                # Decode the image data to an OpenCV image
                frame = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    # Display the image in a window
                    cv2.imshow('Webcam Stream', frame)
                    
                    # Wait for a key event for 1 ms
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                else:
                    print("Frame is None")
            else:
                print("Received non-image data")
        except Exception as e:
            print(f"Error processing message: {e}")

# Start the WebSocket server
start_server = websockets.serve(handler, "localhost", 2000)

# Run the WebSocket server
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()

# Clean up OpenCV windows
cv2.destroyAllWindows()
