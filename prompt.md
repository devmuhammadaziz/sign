🤟 SignFlow: Real-Time Sign Language Translator

📋 Project Overview

A lightning-fast, browser-based application that translates sign language (hand gestures and motion) into text in real-time. Designed for accessibility, the UI features a full-screen webcam feed with large, high-contrast subtitles at the bottom.

Core Constraint: Zero server-side processing for video frames. To achieve < 1-second latency, all hand tracking and gesture classification must happen on the user's device using the browser's GPU.

🛠️ The "Zero-Latency" Tech Stack

Frontend UI: Next.js (React) + Tailwind CSS (Full-screen video, cinematic subtitles).

Hand Tracking: @mediapipe/tasks-vision (Extracts 21 3D hand coordinates per hand at 60+ FPS).

Machine Learning (The Brain): @tensorflow/tfjs (TensorFlow.js). We will feed the MediaPipe coordinates into a lightweight TFJS model (like an LSTM or 1D-CNN) that classifies gestures over a time window.

State Management: Zustand or React Context (to manage the scrolling text transcript smoothly without re-rendering the video feed).

🤖 THE MEGA-PROMPT

Copy everything below this line and paste it into Cursor, Windsurf, or ChatGPT.

System Role:
You are an expert Machine Learning Engineer and React Developer specializing in WebRTC, Computer Vision, and Accessibility Tech. We are building "SignFlow"—an ultra-low latency, real-time Sign Language to Text translation web application.

Core Objective:
The app must detect hand gestures using the webcam and translate them into text on the screen in real-time (under 500ms delay). CRITICAL: Do not use backend APIs or LLMs for frame-by-frame image processing. The entire pipeline must run client-side to ensure zero lag.

Tech Stack:
Next.js (App Router), Tailwind CSS, MediaPipe Hands (@mediapipe/tasks-vision), and TensorFlow.js (@tensorflow/tfjs).

UI/UX Requirements:

Full-Screen Camera: The <video> element must take up the entire screen (w-screen h-screen object-cover), mirrored so it acts like a natural mirror for the user.

Subtitle Overlay: At the bottom 20% of the screen, place a beautiful, highly readable caption area (dark semi-transparent background, large white text with a slight text-shadow). It should look like high-end movie subtitles.

Active Word Buffer: Show the word currently being recognized in real-time (maybe in a distinct color like yellow), and once confirmed by the model, push it to the main translated sentence string.

Technical Architecture & Features to Implement:

MediaPipe Pipeline:

Initialize the webcam stream and feed it into the MediaPipe Hand Landmarker.

Extract the (x, y, z) coordinates for the 21 landmarks of both hands.

Normalization: Normalize the coordinates relative to the bounding box of the hand so the model works regardless of how close the user is to the camera.

Time-Series Data Buffer (Crucial for Words, not just Letters):

Sign language isn't static; it's movement. Create a rolling array buffer that stores the normalized hand coordinates of the last 30 frames (approx. 1 second of movement).

TensorFlow.js Integration:

Set up the infrastructure to load a pre-trained TFJS model (assume the model URL will be provided later, or use a dummy async function that acts as a placeholder model for now).

Feed the 30-frame coordinate buffer into the TFJS model for inference.

Implement a confidence threshold (e.g., only output a word if prediction > 0.85).

Debouncing & Text Smoothing:

To prevent the screen from flashing the same word 10 times a second, implement a debounce/cooldown logic. If "HELLO" is detected, lock out new predictions for 1 second unless it's a completely different gesture.

Create a clear screen / reset timeout: if no hands are detected for 3 seconds, add a period to the sentence or fade out the active text.

Initial Task:
Please generate the complete project setup, including package.json dependencies. Then, provide the main page.tsx component featuring the full-screen webcam UI and the custom React Hook (useSignLanguageTracker.ts) that initializes MediaPipe, handles the frame buffer, and prepares the data for TFJS inference. Ensure the UI is responsive and clean.