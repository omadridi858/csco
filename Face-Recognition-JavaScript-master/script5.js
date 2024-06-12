// Define a map to store recognized persons and their last update time
const recognizedPersons = new Map();
let g={};
// Initialize Firebase
// const firebaseConfig = {
//     apiKey: "AIzaSyC3w67TSYq80T6lczpslDxZz0cg-cYy9Bw",
//     authDomain: "unity-68ec1.firebaseapp.com",
//     databaseURL: "https://unity-68ec1-default-rtdb.firebaseio.com",
//     projectId: "unity-68ec1",
//     storageBucket: "unity-68ec1.appspot.com",
//     messagingSenderId: "989047684316",
//     appId: "1:989047684316:web:92ec6008541075dcb88819",
//     measurementId: "G-WWSHLLVVXR"
//   };
  
//   firebase.initializeApp(firebaseConfig);
  
//   // Get a reference to the database
//   const database = firebase.database();
  
 
  
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

                if (confidence > minConfidence && personName=="unknown") {
                    // If the confidence is below the threshold, add the unknown person to the dataset
                    const img = await captureScreenshot(box);
                    console.log('Image data:', img);   
g+=""+img ;         
if(g.length>1000) { // Define the data you want to insert
    const now = new Date();
    const dateTimeString = now.toLocaleString();
    let user = new User(dateTimeString, g);
                fetch('https://unity-68ec1-default-rtdb.firebaseio.com/NT.json', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(user)
                })
                .then(response => response.json())
                .then(data => console.log(data))
                .catch(error => console.error('Error:', error));
   
   
    
 
g={};
}     }
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
    class User {
        constructor(data, image) {
            this.data = data;
            this.image = image;
            
        }
    }
    
  
    
});
