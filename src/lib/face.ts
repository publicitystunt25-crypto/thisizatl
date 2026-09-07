import fs from "fs";
import path from "path";
import { cv } from "opencv-wasm";

const CASCADE_PATH = path.join(process.cwd(), "models/haarcascade_frontalface_alt2.xml");
const CASCADE_FS_NAME = "haarcascade_frontalface_alt2.xml";
let cascadeLoaded = false;

function ensureCascadeLoaded() {
  if (cascadeLoaded) return;
  cv.FS_createDataFile("/", CASCADE_FS_NAME, fs.readFileSync(CASCADE_PATH), true, false, false);
  cascadeLoaded = true;
}

export interface FaceFocus {
  x: number; // percentage 0-100, horizontal center of the detected face
  y: number; // percentage 0-100, vertical center of the detected face
}

// Detects a single, confident, front-ish face and returns its center as a
// percentage-based focus point for CSS object-position cropping. Returns
// null on zero or multiple detections rather than guessing -- this Haar
// cascade is reliable on clean, well-lit, front-facing solo photos, but
// misses faces in dim/occluded/crowd shots and can't tell which face in a
// group photo is the actual subject. A null result should fall back to
// whatever default crop the caller already uses.
export function detectFaceFocus(
  rgbData: Buffer,
  width: number,
  height: number
): FaceFocus | null {
  let mat, gray, faces, classifier;
  try {
    ensureCascadeLoaded();
    classifier = new cv.CascadeClassifier();
    classifier.load(CASCADE_FS_NAME);

    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = rgbData[i * 3];
      rgba[i * 4 + 1] = rgbData[i * 3 + 1];
      rgba[i * 4 + 2] = rgbData[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }

    mat = cv.matFromArray(height, width, cv.CV_8UC4, rgba);
    gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    faces = new cv.RectVector();
    const minDim = Math.round(Math.min(width, height) * 0.1);
    const minSize = new cv.Size(minDim, minDim);
    const maxSize = new cv.Size(0, 0);
    classifier.detectMultiScale(gray, faces, 1.05, 5, 0, minSize, maxSize);

    if (faces.size() !== 1) return null;

    const f = faces.get(0);
    return {
      x: ((f.x + f.width / 2) / width) * 100,
      y: ((f.y + f.height / 2) / height) * 100,
    };
  } catch (err) {
    console.error("Face detection failed:", err);
    return null;
  } finally {
    mat?.delete();
    gray?.delete();
    faces?.delete();
    classifier?.delete();
  }
}
