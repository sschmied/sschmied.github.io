let detector;
let videoElement, canvasElement, ctx;
let animationId;
let mediaRecorder;
let recordedChunks = [];

// DOM Elements
const statusText = document.getElementById('status');
const webcamBtn = document.getElementById('webcamBtn');
const uploadBtn = document.getElementById('uploadBtn');
const recordBtn = document.getElementById('recordBtn');
const downloadBtn = document.getElementById('downloadBtn');

// 1. Initialize MoveNet (Lightning variant for speed)
async function initModel() {
    try {
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        statusText.innerText = "Model Ready. Select input source.";
    } catch (error) {
        statusText.innerText = "Error loading model: " + error.message;
    }
}

// 2. Setup Elements
window.onload = () => {
    videoElement = document.getElementById('inputVideo');
    canvasElement = document.getElementById('outputCanvas');
    ctx = canvasElement.getContext('2d');
    initModel();
};

// 3. Webcam Input
webcamBtn.addEventListener('click', async () => {
    if (animationId) cancelAnimationFrame(animationId);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        videoElement.srcObject = stream;
        videoElement.onloadeddata = () => startPoseEstimation();
    } catch (err) {
        alert("Camera access denied or error: " + err);
    }
});

// 4. File Upload Input
uploadBtn.addEventListener('change', (event) => {
    if (animationId) cancelAnimationFrame(animationId);
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoElement.srcObject = null;
        videoElement.src = url;
        videoElement.loop = true;
        videoElement.play();
        videoElement.onloadeddata = () => startPoseEstimation();
    }
});

// 5. Main Loop: Pose Estimation
async function startPoseEstimation() {
    // Match canvas size to video
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    recordBtn.disabled = false;
    statusText.innerText = "Tracking active...";

    async function renderFrame() {
        if (!detector) return;

        // Estimate Poses
        const poses = await detector.estimatePoses(videoElement);

        // Draw Video Background on Canvas (for the recorded output)
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Draw Skeleton
        if (poses && poses.length > 0) {
            drawSkeleton(poses[0].keypoints, 0.3); // 0.3 is confidence threshold
        }

        animationId = requestAnimationFrame(renderFrame);
    }
    renderFrame();
}

// 6. Drawing Logic
function drawSkeleton(keypoints, minConfidence) {
    const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
    
    // Draw lines
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 4;
    adjacentPairs.forEach(([i, j]) => {
        const kp1 = keypoints[i];
        const kp2 = keypoints[j];

        if (kp1.score > minConfidence && kp2.score > minConfidence) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.stroke();
        }
    });

    // Draw points
    keypoints.forEach(kp => {
        if (kp.score > minConfidence) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
}

// 7. Recording Logic
recordBtn.addEventListener('click', () => {
    if (recordBtn.innerText.includes("Start")) {
        startRecording();
    } else {
        stopRecording();
    }
});

function startRecording() {
    const stream = canvasElement.captureStream(30); // 30 FPS
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'surfing-analysis.webm';
            a.click();
        };
        downloadBtn.disabled = false;
    };

    mediaRecorder.start();
    recordBtn.innerText = "Stop Recording";
    recordBtn.style.background = "red";
    downloadBtn.disabled = true;
}

function stopRecording() {
    mediaRecorder.stop();
    recordBtn.innerText = "Start Recording Analysis";
    recordBtn.style.background = ""; // Reset color
}