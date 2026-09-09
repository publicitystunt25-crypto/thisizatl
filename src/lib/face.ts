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

// Runs the cascade once at a given strictness (minNeighbors -- lower finds
// more candidates but risks more false positives) and returns every
// candidate rect it finds, largest first.
function runCascade(
  classifier: InstanceType<typeof cv.CascadeClassifier>,
  gray: InstanceType<typeof cv.Mat>,
  width: number,
  height: number,
  minNeighbors: number
): { x: number; y: number; width: number; height: number }[] {
  const faces = new cv.RectVector();
  try {
    const minDim = Math.round(Math.min(width, height) * 0.08);
    const minSize = new cv.Size(minDim, minDim);
    const maxSize = new cv.Size(0, 0);
    classifier.detectMultiScale(gray, faces, 1.05, minNeighbors, 0, minSize, maxSize);

    const rects = [];
    for (let i = 0; i < faces.size(); i++) {
      const f = faces.get(i);
      rects.push({ x: f.x, y: f.y, width: f.width, height: f.height });
    }
    return rects.sort((a, b) => b.width * b.height - a.width * a.height);
  } finally {
    faces.delete();
  }
}

// Detects the photo's main subject face and returns its center as a
// percentage-based focus point for CSS object-position cropping. Runs the
// Haar cascade twice -- first at a strict setting (fewer false positives),
// then, if that finds nothing, again at a looser setting on a
// contrast-equalized copy of the image, since dim or low-contrast promo
// photos (stage lighting, phone camera shots) are the most common cause of a
// missed detection. When multiple candidates come back, a clearly dominant
// one (notably larger than the runner-up, e.g. a solo subject up front with
// smaller faces in the background) is trusted; a photo with several
// similarly-sized faces is genuinely ambiguous and returns null so the
// caller's fallback crop takes over instead of guessing which person is the
// subject.
export function detectFaceFocus(
  rgbData: Buffer,
  width: number,
  height: number
): FaceFocus | null {
  let mat, gray, equalized, classifier;
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

    let rects = runCascade(classifier, gray, width, height, 5);

    if (rects.length === 0) {
      equalized = new cv.Mat();
      cv.equalizeHist(gray, equalized);
      rects = runCascade(classifier, equalized, width, height, 3);
    }

    if (rects.length === 0) return null;

    const [best, runnerUp] = rects;
    if (runnerUp) {
      const bestArea = best.width * best.height;
      const runnerUpArea = runnerUp.width * runnerUp.height;
      if (bestArea < runnerUpArea * 1.5) return null;
    }

    return {
      x: ((best.x + best.width / 2) / width) * 100,
      y: ((best.y + best.height / 2) / height) * 100,
    };
  } catch (err) {
    console.error("Face detection failed:", err);
    return null;
  } finally {
    mat?.delete();
    gray?.delete();
    equalized?.delete();
    classifier?.delete();
  }
}
