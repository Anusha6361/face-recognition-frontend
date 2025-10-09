"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";

// --- FINAL CONFIGURATION ---
// PASTE YOUR CONFIRMED LIVE RENDER URL HERE:
const LIVE_API_HOST = "https://face-recognition-backend-live.onrender.com"; 
// -----------------------------

// Define the expected structure of a recognized face object from the backend
interface FaceResult {
    name: string;
    location: [number, number, number, number]; // [top, right, bottom, left]
    distance: number | null;
    user_id: number | null;
}

export default function Home() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const socketRef = useRef<WebSocket | null>(null);

    const [status, setStatus] = useState("Initializing...");
    const [messages, setMessages] = useState<string[]>([]);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [file, setFile] = useState<File | null>(null);
    
    // --- Drawing Function (Draws Boxes on the Visible Canvas) ---
    function drawFaces(faceData: FaceResult[]) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // The backend streams 320x240 frames. We scale the coordinates to the 640x480 canvas.
        const streamWidth = 320;
        const streamHeight = 240;
        const scaleX = canvas.width / streamWidth;
        const scaleY = canvas.height / streamHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        faceData.forEach((face) => {
            const [top, right, bottom, left] = face.location;
            
            const x = left * scaleX;
            const y = top * scaleY;
            const w = (right - left) * scaleX;
            const h = (bottom - top) * scaleY;

            // Determine color based on recognition success
            const isKnown = face.name !== "Unknown";
            const color = isKnown ? "#4CAF50" : "#FF5722"; // Green (Success) or Deep Orange (Unknown)
            
            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            // Draw name label background for better contrast against video
            ctx.fillStyle = color;
            ctx.fillRect(x, y - 25, Math.max(90, ctx.measureText(face.name).width + 15), 25);

            // Draw name label
            ctx.fillStyle = 'white';
            ctx.font = "16px 'Roboto Mono', sans-serif";
            
            ctx.fillText(face.name, x + 5, y - 8);
        });
    }
    // --- End Drawing Function ---


    // Start camera, WebSocket, and frame-sending loop
    useEffect(() => {
        async function setup() {
            try {
                // 1. Start Camera Stream
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStatus("Camera ready ✅");
            } catch (err) {
                console.error("Camera error:", err);
                setStatus("Camera error ❌");
                return;
            }

            // 2. Connect WebSocket to the LIVE RENDER URL
            // FIX: This converts HTTPS (from LIVE_API_HOST) to WSS (Secure WebSocket)
            const wsUrl = LIVE_API_HOST.replace('https', 'wss') + "/ws";
            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onopen = () => setStatus("WebSocket connected ✅");
            socket.onclose = () => setStatus("WebSocket disconnected ❌");
            socket.onerror = () => setStatus("WebSocket error ❌");

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.faces && Array.isArray(data.faces)) {
                        const facesArray: FaceResult[] = data.faces;

                        setMessages(facesArray.map(f => `${f.name} (Dist: ${f.distance?.toFixed(3) || 'N/A'})`));
                        drawFaces(facesArray);
                    }
                } catch (e) {
                    console.error("Error parsing WebSocket message:", e);
                }
            };

            // 3. Frame-Sending Loop (10 FPS)
            const intervalId = setInterval(() => {
                if (!videoRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = 320; 
                tempCanvas.height = 240;
                const ctx = tempCanvas.getContext("2d");
                if (!ctx) return;

                ctx.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);

                // Send compressed JPEG base64 data
                const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.7); 
                socketRef.current.send(dataUrl);

                tempCanvas.remove();
            }, 100); 

            // Set final canvas size
            if (canvasRef.current) {
                canvasRef.current.width = 640;
                canvasRef.current.height = 480;
            }

            // Cleanup function
            return () => {
                clearInterval(intervalId);
                socketRef.current?.close();
            };
        }

        setup();
    }, []);


    // Upload new face
    async function handleUpload(e: React.FormEvent) {
        e.preventDefault();
        if (!file || !name || !email) return alert("All fields are required!");

        const formData = new FormData();
        formData.append("name", name);
        formData.append("email", email);
        formData.append("file", file);

        try {
            // HTTP POST to the LIVE RENDER URL
            const res = await axios.post(LIVE_API_HOST + "/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            alert(`✅ Enrollment Successful for: ${res.data.name}`);
        } catch (error: any) {
             const message = error.response?.data?.detail || "Upload failed. Check server logs.";
             alert(`❌ Enrollment Failed: ${message}`);
        }
    }

    // Determine status color for attractive display
    const statusColor = status.includes('✅') ? '#4CAF50' : status.includes('❌') ? '#F44336' : '#FF9800';


    return (
        <div style={{ 
            padding: "40px 20px", 
            fontFamily: 'Roboto, sans-serif',
            background: 'linear-gradient(135deg, #0f1c2d 0%, #000000 100%)', // Deep Space Blue
            color: '#e0e0e0',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            <h1 style={{ 
                color: '#03A9F4', // Light Blue Accent
                fontSize: '2.5em',
                letterSpacing: '2px',
                textShadow: '0 0 5px rgba(3, 169, 244, 0.5)',
                marginBottom: '10px'
            }}>
                Face Recognition
            </h1>
            
            {/* Status Bar */}
            <div style={{ 
                fontSize: '1.2em', 
                marginBottom: '30px', 
                color: statusColor,
                fontWeight: 'bold',
                padding: '5px 15px',
                border: `1px solid ${statusColor}`,
                borderRadius: '5px'
            }}>
                Status: {status}
            </div>

            {/* Main Interface Container */}
            <div style={{ 
                display: 'flex',
                gap: '40px',
                width: '85%', // Use percentage for better responsiveness
                maxWidth: '1200px',
                backgroundColor: '#1b263b', // Darker base for containers
                borderRadius: '15px',
                padding: '30px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)'
            }}>

                {/* Left Panel: Live Camera Feed */}
                <div style={{ flex: '2', position: 'relative' }}>
                    <h2 style={{ color: '#03A9F4', marginTop: '0', borderBottom: '2px solid #5c72a8', paddingBottom: '10px' }}>
                        Live Recognition Feed
                    </h2>
                    <div style={{ position: "relative", width: "640px", height: "480px" }}>
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            width={640} 
                            height={480} 
                            style={{ 
                                border: "3px solid #5c72a8", 
                                borderRadius: '6px',
                                display: 'block',
                                filter: 'grayscale(10%)'
                            }} 
                        />
                        <canvas 
                            ref={canvasRef} 
                            width={640} 
                            height={480} 
                            style={{ 
                                position: "absolute", 
                                top: 0, 
                                left: 0, 
                                pointerEvents: 'none' 
                            }} 
                        />
                    </div>
                </div>

                {/* Right Panel: Controls and Log */}
                <div style={{ flex: '1.2', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    
                    {/* Enrollment Form Card */}
                    <form onSubmit={handleUpload} style={{ 
                        backgroundColor: '#2e3a59', // Input Card Color
                        padding: '20px',
                        borderRadius: '10px',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                        <h3 style={{ marginTop: '0', color: '#FFEB3B', borderBottom: '1px solid #44557d', paddingBottom: '10px' }}>
                            New User Enrollment
                        </h3>
                        <input
                            type="text"
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            style={inputStyle}
                        />
                        <input
                            type="email"
                            placeholder="Email (Unique ID)"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={inputStyle}
                        />
                        <label htmlFor="file-upload" style={fileLabelStyle}>
                            {file ? `File Ready: ${file.name}` : "Select Enrollment Photo"}
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            required
                            style={{ display: 'none' }}
                        />
                        <button type="submit" style={buttonStyle}>
                            Enroll User & Upload Face
                        </button>
                    </form>

                    {/* Activity Log Card */}
                    <div style={{ 
                        backgroundColor: '#2e3a59', 
                        padding: '20px', 
                        borderRadius: '10px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                        <h3 style={{ marginTop: '0', color: '#03A9F4', borderBottom: '1px solid #44557d', paddingBottom: '10px' }}>
                            Detection Log
                        </h3>
                        <ul style={{ listStyleType: 'none', padding: '0', margin: '0' }}>
                            {messages.length > 0 ? (
                                messages.map((msg, i) => (
                                    <li key={i} style={{ 
                                        color: msg.includes("Unknown") ? '#FF5722' : '#4CAF50', 
                                        fontWeight: '500', 
                                        padding: '4px 0',
                                        fontSize: '0.9em',
                                        fontFamily: "'Roboto Mono', monospace"
                                    }}>
                                        {msg}
                                    </li>
                                ))
                            ) : (
                                <li style={{ color: '#adb5bd', fontSize: '0.9em' }}>Awaiting first detection...</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Reusable inline styles for form inputs
const inputStyle: React.CSSProperties = {
    padding: '12px',
    marginBottom: '15px',
    border: '1px solid #44557d',
    borderRadius: '6px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#3e3e60', // Input field color
    color: 'white',
    fontSize: '1em'
};

const fileLabelStyle: React.CSSProperties = {
    display: 'block',
    padding: '12px',
    marginBottom: '15px',
    backgroundColor: '#FFC75F', // Golden color for visibility
    color: '#1a1a2e', 
    borderRadius: '6px',
    textAlign: 'center',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
};

const buttonStyle: React.CSSProperties = {
    padding: '12px 20px',
    backgroundColor: '#845EC2', // Royal Purple
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
    fontWeight: 'bold',
    fontSize: '1.1em',
    letterSpacing: '0.5px',
    transition: 'background-color 0.2s'
};