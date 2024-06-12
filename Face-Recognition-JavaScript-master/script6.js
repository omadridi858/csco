// Define a map to store recognized persons and their last update time
const recognizedPersons = new Map();

$.getJSON('./dataset', data => {
    const video = document.getElementById("video");
    console.log(data); // ["doc1.jpg", "doc2.jpg", "doc3.jpg"]

    Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.loadFaceExpressionModel('/models'),
        faceapi.nets.ageGenderNet.load('/models')
    ]).then(startWebcam);

    function startWebcam() {
        navigator.mediaDevices
            .getUserMedia({ video: true, audio: false })
            .then((stream) => {
                video.srcObject = stream;
            })
            .catch((error) => {
                console.error(error);
            });
    }

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
                            .detectSingleFace(img)
                            .withFaceLandmarks()
                            .withFaceDescriptor();
                        if (detections) {
                            descriptions.push(detections.descriptor);
                        }
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
            document.getElementById('counter').innerText = '100% complete'; 
            document.getElementById('counter').style.color='#32CD32';
        })
        .catch((error) => {
            console.error('Error loading labeled face descriptors:', error);
        });

    video.addEventListener("play", async () => {
        let labeledFaceDescriptors = await getLabeledFaceDescriptions(data);
        let faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
        const minConfidence = 0.6;

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

            results.forEach(async (result, i) => {
                const box = resizedDetections[i].detection.box;
                const drawBox = new faceapi.draw.DrawBox(box, {
                    label: result.toString(),
                });
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections[i]);
                drawBox.draw(canvas);

                const personName = result.toString().split(' (')[0];
                const confidence = parseFloat(result.toString().split(' (')[1]);

                if (confidence < minConfidence && personName === "unknown") {
                    // If the confidence is below the threshold and the person is unknown, add the person to the dataset
                    const img = await captureScreenshot(box);
                    const newName = generateRandomName(); // Generate a random name for the unknown person
                    console.log('Adding unknown person to dataset with name:', newName);
                    console.log('Image data:', img);
                    await updateDatasetAndRetrainModel(img, newName);
                    // After updating the dataset and retraining the model, reload the labeled descriptors
                    labeledFaceDescriptors = await getLabeledFaceDescriptions(data);
                    faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
                }
            });
        }, 50);
    });

    async function captureScreenshot(box) {
        const canvas = document.createElement('canvas');
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
        return canvas.toDataURL('image/jpeg');
    }

    async function updateDatasetAndRetrainModel(imgData, newName) {
        // Upload the image to your server and update the dataset
        // Here, we're just logging the dataURL to simulate the upload process
        console.log('Adding unknown person to dataset with name:', newName);
        console.log('Image data:', imgData);

        // Assuming you have a function to add the new image and name to your dataset
        // This function should update the dataset and retrain the model
        // Here, we're just logging to simulate the process
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate some delay for processing
        console.log('Updating dataset and retraining model... Done!');
    }

    // Function to generate a random name for the unknown person
    function generateRandomName() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let name = '';
        for (let i = 0; i < 6; i++) {
            name += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return name;
    }
});
