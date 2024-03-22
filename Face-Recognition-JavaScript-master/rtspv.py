import cv2
import pyvirtualcam

# Open the RTSP stream
cap = cv2.VideoCapture('rtsp://your_rtsp_stream_url')

# Create a virtual camera
with pyvirtualcam.Camera(width=640, height=480, fps=30) as cam:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Resize the frame to match the virtual camera's resolution
        frame = cv2.resize(frame, (cam.width, cam.height))

        # Send the frame to the virtual camera
        cam.send(frame)

        # Show the frame (optional)
        cv2.imshow('Virtual Camera', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        # Uncomment the line below if you want to limit the frame rate
        # time.sleep(1 / 30)

    cap.release()
    cv2.destroyAllWindows()
