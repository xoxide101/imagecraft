// MediaPipe Tasks Vision (Apache-2.0) as one classic script, so it works from file://. ImageCraft loads it only when a
// face tool is first used; the matching WebAssembly files and the face model come from the web once and are cached.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
window.CraftFace = { FaceLandmarker, FilesetResolver, version: '1.0.1' };
