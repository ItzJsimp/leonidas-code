import { VOICE_MAX_AUDIO_BYTES } from "@t3tools/contracts";

/** One bounded recording. Both completion and cancellation release the microphone. */
export function recordVoice(stream: MediaStream) {
  const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  let chunks: Blob[] = [];
  let bytes = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const result = new Promise<Blob | null>((resolve, reject) => {
    const release = () => {
      clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    };
    recorder.ondataavailable = ({ data }) => {
      bytes += data.size;
      if (bytes > VOICE_MAX_AUDIO_BYTES) {
        cancelled = true;
        reject(new Error("Recording reached the size limit. Try a shorter take."));
        if (recorder.state === "recording") recorder.stop();
      } else if (!cancelled) chunks.push(data);
    };
    recorder.onerror = () => {
      cancelled = true;
      release();
      chunks = [];
      reject(new Error("The microphone stopped. Check its connection and try again."));
    };
    recorder.onstop = () => {
      release();
      const blob = cancelled ? null : new Blob(chunks, { type: recorder.mimeType });
      chunks = [];
      resolve(blob);
    };
    try {
      recorder.start(1000);
    } catch (error) {
      release();
      reject(error);
      return;
    }
    timer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 600_000);
  });
  return {
    result,
    stop: () => {
      if (recorder.state === "recording") recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state === "recording") recorder.stop();
    },
  };
}

export function voiceAudioBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("The recording could not be read. Try again."));
    reader.readAsDataURL(blob);
  });
}
