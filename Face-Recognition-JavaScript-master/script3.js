$.getJSON('./dataset', data => {const video = document.getElementById("video"); 
console.log(data); //["doc1.jpg", "doc2.jpg", "doc3.jpg"] 

// Load necessary models
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(() => {
    startWebcam();
    getLabeledFaceDescriptions(data);
}).catch((error) => {
    console.error('Error loading models:', error);
});

// Function to start webcam
function startWebcam() {
    navigator.mediaDevices
        .getUserMedia({
            video: true,
            audio: false,
        })
        .then((stream) => {
            video.srcObject = stream;
        })
        .catch((error) => {
            console.error(error);
        });
}

// Function to get labeled face descriptions
async function getLabeledFaceDescriptions(data) {
    const labels = data;
    const totalLabels = labels.length;
    let loadedLabels = 0;

    const updateCounter = () => {
        loadedLabels++;
        const progress = (loadedLabels / totalLabels) * 100;
        document.getElementById('counter').innerText = `${progress.toFixed(2)}%`;
    };

    return Promise.all(
        labels.map(async (label) => {
            try {
                const descriptions = [];
                const files = await new Promise((resolve, reject) => {
                    $.getJSON(`./dataset/${label}`, resolve).fail(reject);
                });

                for (const file of files) {
                    console.log(label, file);
                    const img = await faceapi.fetchImage(`/dataset/${label}/${file}`);
                    const detections = await faceapi
                        .detectAllFaces(img)
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    detections.forEach((detection) => {
                        descriptions.push(detection.descriptor);
                    });
                }

                updateCounter();
                return new faceapi.LabeledFaceDescriptors(label, descriptions);
            } catch (error) {
                console.error('Error loading labeled face descriptions:', error);
                return null;
            }
        })
    );
}

// Create counter element
const counter = document.createElement('span');
counter.id = 'counter';
counter.innerText = 'wait load data 0%';
document.body.appendChild(counter);

// Call the function to load data
getLabeledFaceDescriptions(data)
    .then((labeledFaceDescriptors) => {
        console.log('All labeled face descriptors loaded:', labeledFaceDescriptors);
        // Perform further actions if needed
        document.getElementById('counter').innerText = '100% complete'; // Update counter to 100% when loading is complete
        document.getElementById('counter').style.color = '#32CD32';
    })
    .catch((error) => {
        console.error('Error loading labeled face descriptors:', error);
    });

// Event listener for video play
video.addEventListener("play", async () => {
    console.log(data);
    const labeledFaceDescriptors = await getLabeledFaceDescriptions(data);
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi
            .detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

        const results = resizedDetections.map((d) => {
            return faceMatcher.findBestMatch(d.descriptor);
        });
        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, {
                label: result.toString()
            });
            drawBox.draw(canvas);
        });
    }, 50); // Decreased interval to 50ms for more frequent processing
});


});
