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
                            .detectAllFaces(img)
                            .withFaceLandmarks()
                            .withFaceDescriptors()
                            .withAgeAndGender()
                            .withFaceExpressions();
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
            document.getElementById('counter').innerText = '100% complete'; 
            document.getElementById('counter').style.color='#32CD32';
        })
        .catch((error) => {
            console.error('Error loading labeled face descriptors:', error);
        });

    video.addEventListener("play", async () => {
        const labeledFaceDescriptors = await getLabeledFaceDescriptions(data);
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
        const minConfidence = 0.6;

        const canvas = faceapi.createCanvasFromMedia(video);
        document.body.append(canvas);

        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const detections = await faceapi
                .detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors()
                .withAgeAndGender()
                .withFaceExpressions();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

            const results = resizedDetections.map((d) => {
                return faceMatcher.findBestMatch(d.descriptor);
            });

            results.forEach((result, i) => {
                const box = resizedDetections[i].detection.box;
                const drawBox = new faceapi.draw.DrawBox(box, {
                    label: `${result.toString()} detail: ${Math.round(resizedDetections[i].age)} year old ${resizedDetections[i].gender}`,
                });
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections[i]);
                drawBox.draw(canvas);

                const personName = result.toString().split(' (')[0];
                const confidence = parseFloat(result.toString().split(' (')[1]);

                if (confidence >= minConfidence) {
                    // Check if the person is recognized or not
                    if (!recognizedPersons.has(personName)) {
                        // If the person is not recognized before, update the database
                        updateDatabase(personName, confidence);
                        // Mark the person as recognized
                        recognizedPersons.set(personName, true);
                    }
                }
            });
        }, 50);
    });

    function updateDatabase(personName, confidence) {
        const now = new Date();
        const dateTimeString = now.toLocaleString();
        console.log(`[${dateTimeString}] Updating database: ${personName} with confidence ${confidence}`);
    }
});
