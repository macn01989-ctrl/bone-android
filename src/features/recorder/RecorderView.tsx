import { useEffect, useRef, useState } from 'react';
import { Haptics } from '@capacitor/haptics';
import { createNoteId } from '../../services/storage';
import { transcribeSpeechAudio } from '../../services/speech';
import type { AppSettings, BoneNote, NoteAudio } from '../../shared/types';
import { DEFAULT_POLISH_MODEL } from '../../shared/apiConstants';
import { audioExtension, blobToDataUrl, chooseAudioMimeType, extractChatText, formatRecorderTime, normalizeAudioToWav, recommendedAsrTimeout } from '../../shared/media/audio';

export function RecorderView({
  settings,
  onBack,
  onEdit,
  onRegisterBackHandler,
  onToast,
}: {
  settings: AppSettings;
  onBack: () => void;
  onEdit: (note: BoneNote) => void;
  onRegisterBackHandler: (handler: (() => boolean) | null) => void;
  onToast: (message: string) => void;
}) {
  const [currentTime, setCurrentTime] = useState('0:00');
  const [isRecording, setIsRecording] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [isLongPress, setIsLongPress] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [processingType, setProcessingType] = useState<'transcribe' | 'polish' | 'organize' | ''>('');
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const stopTypeRef = useRef<'normal' | 'cancel' | ''>('');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  const isRecordingRef = useRef(false);
  const currentBlobRef = useRef<Blob | null>(null);

  const setRecording = (value: boolean) => {
    isRecordingRef.current = value;
    setIsRecording(value);
  };

  const clearRecorderTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
  };

  const resetRecordingSurface = () => {
    clearRecorderTimer();
    secondsRef.current = 0;
    setCurrentTime('0:00');
    setRecording(false);
    setIsLongPress(false);
  };

  const startTimer = () => {
    clearRecorderTimer();
    secondsRef.current = 0;
    setCurrentTime('0:00');
    timerRef.current = window.setInterval(() => {
      secondsRef.current += 1;
      setCurrentTime(formatRecorderTime(secondsRef.current));

      if (secondsRef.current >= 300) {
        stopRecording('normal');
      }
    }, 1000);
  };

  const stopRecording = (type: 'normal' | 'cancel') => {
    stopTypeRef.current = type;
    clearRecorderTimer();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      stopTracks();
      resetRecordingSurface();
    }
  };

  const transcribeAudio = async (blob: Blob, durationSeconds: number) => {
    const api = settings.api.speechToText;
    setIsTranscribing(true);
    setProcessingType('transcribe');

    if (!api.apiKey.trim()) {
      setTranscriptionText('未配置语音转换 API，请到设置页填写后重试。');
      setIsTranscribing(false);
      setProcessingType('');
      return;
    }

    try {
      const uploadBlob = await normalizeAudioToWav(blob);
      const mimeType = uploadBlob.type || blob.type || 'audio/webm';
      const fileName = `bone-recording-${Date.now()}.${audioExtension(mimeType)}`;
      const text = await transcribeSpeechAudio({
        apiKey: api.apiKey,
        model: api.model,
        blob: uploadBlob,
        fileName,
        mimeType,
        timeoutMs: recommendedAsrTimeout(durationSeconds, api.timeoutMs),
      });
      if (!text.trim()) {
        setTranscriptionText('未能识别出语音内容，请说话清晰一些');
        setIsTranscribing(false);
        setProcessingType('');
        return;
      }

      await polishText(text);
    } catch {
      setTranscriptionText('抱歉，语音转文字失败，请重试');
      setIsTranscribing(false);
      setProcessingType('');
    }
  };

  const polishText = async (originalText: string) => {
    const api = settings.api.speechToText;
    setIsTranscribing(true);
    setProcessingType('polish');

    if (!api.enabled || !api.baseUrl.trim() || !api.apiKey.trim() || !api.model.trim()) {
      setTranscriptionText(originalText);
      setIsTranscribing(false);
      setProcessingType('');
      return;
    }

    try {
      const response = await fetch(api.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.polishModel || DEFAULT_POLISH_MODEL,
          messages: [
            {
              role: 'system',
              content:
                '你是一个专业的文本润色助手。仅纠正错别字、语法错误、冗余和重复表达，不改变原意，不新增总结，不改变段落结构。',
            },
            { role: 'user', content: originalText },
          ],
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(api.timeoutMs || 30000),
      });

      if (!response.ok) throw new Error(`polish api ${response.status}`);
      const result = await response.json();
      setTranscriptionText(extractChatText(result) || originalText);
    } catch {
      setTranscriptionText(originalText);
    } finally {
      setIsTranscribing(false);
      setProcessingType('');
    }
  };

  const startRecording = async () => {
    if (isRecordingRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onToast('当前环境不支持录音');
      return;
    }

    try {
      stopPlayback();
      setShowPopup(false);
      setTranscriptionText('');
      setIsTranscribing(false);
      setProcessingType('');
      setAudioDataUrl('');
      currentBlobRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        onToast('录音出错');
        resetRecordingSurface();
        stopTracks();
      };

      recorder.onstop = () => {
        const stopType = stopTypeRef.current;
        const durationSeconds = secondsRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        stopTracks();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        stopTypeRef.current = '';
        resetRecordingSurface();
        setIsFirstTime(false);

        if (stopType === 'cancel') {
          setShowPopup(false);
          setAudioDataUrl('');
          setTranscriptionText('');
          currentBlobRef.current = null;
          return;
        }

        const name = `bone-recording-${Date.now()}.${audioExtension(blob.type)}`;
        setAudioName(name);
        currentBlobRef.current = blob;
        void blobToDataUrl(blob).then((dataUrl) => {
          setAudioDataUrl(dataUrl);
          setShowPopup(true);
          void transcribeAudio(blob, durationSeconds);
        });
      };

      recorder.start();
      stopTypeRef.current = '';
      setRecording(true);
      startTimer();
    } catch {
      onToast('需要录音权限');
      resetRecordingSurface();
      stopTracks();
    }
  };

  const handleRecording = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }

    if (!isRecordingRef.current) {
      void startRecording();
      return;
    }

    stopRecording('normal');
  };

  const handlePointerDown = () => {
    if (!isRecordingRef.current) return;

    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      ignoreClickRef.current = true;
      clearRecorderTimer();
      secondsRef.current = 0;
      setCurrentTime('0:00');
      setIsLongPress(true);
      void Haptics.vibrate({ duration: 30 }).catch(() => navigator.vibrate?.(30));
    }, 650);
  };

  const handlePointerEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isLongPress) {
      setIsLongPress(false);
      stopRecording('cancel');
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 80);
    }
  };

  const playRecording = () => {
    if (!audioDataUrl) {
      onToast('录音文件不存在');
      return;
    }

    if (isPlaying) {
      stopPlayback();
      return;
    }

    stopPlayback();
    const audio = new Audio(audioDataUrl);
    audioPlayerRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      onToast('播放失败');
      setIsPlaying(false);
    };
    void audio.play().then(() => setIsPlaying(true)).catch(() => onToast('播放失败'));
  };

  const closePopup = () => {
    stopPlayback();
    setShowPopup(false);
    setTranscriptionText('');
    setIsTranscribing(false);
    setProcessingType('');
  };

  const handleEdit = () => {
    if (!transcriptionText.trim()) {
      onToast('没有可编辑的文本');
      return;
    }

    const now = Date.now();
    const audio: NoteAudio | undefined = audioDataUrl
      ? {
          id: `audio-${now}-${Math.random().toString(16).slice(2)}`,
          name: audioName || `bone-recording-${now}.${audioExtension(currentBlobRef.current?.type || '')}`,
          dataUrl: audioDataUrl,
          createdAt: now,
        }
      : undefined;

    stopPlayback();
    onEdit({
      id: createNoteId(),
      title: '',
      content: transcriptionText,
      tags: [],
      images: [],
      audio,
      createdAt: now,
      updatedAt: now,
      pinned: false,
    });
  };

  useEffect(() => {
    void startRecording();

    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      clearRecorderTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        stopTypeRef.current = 'cancel';
        mediaRecorderRef.current.stop();
      }
      stopTracks();
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    onRegisterBackHandler(() => {
      if (showPopup) {
        closePopup();
        return true;
      }

      if (isRecordingRef.current) {
        stopRecording('cancel');
        onBack();
        return true;
      }

      return false;
    });

    return () => onRegisterBackHandler(null);
  }, [onBack, onRegisterBackHandler, showPopup]);

  const buttonText = isLongPress ? 'CANCEL' : isFirstTime ? 'STOP' : isRecording ? 'STOP' : 'START';
  const loadingText =
    processingType === 'polish' ? '正在润色...' : processingType === 'organize' ? '整理文本中...' : '文本转录中...';

  return (
    <section className="recorder-page">
      <div className="recorder-container">
        <div className="recorder-card">
          <div className="recorder-card-title" aria-label="B·one">
            <span className="recorder-title-b">B</span>
            <span className="recorder-title-dot">·</span>
            <span className="recorder-title-o">o</span>
            <span className="recorder-title-n">n</span>
            <span className="recorder-title-e">e</span>
          </div>

          {isPlaying && (
            <div className="recorder-playing-loading">
              <span className="recorder-spin-circle recorder-mondrian-red" />
              <span className="recorder-spin-circle recorder-mondrian-yellow" />
              <span className="recorder-spin-circle recorder-mondrian-blue" />
            </div>
          )}

          <div className={`recorder-timer ${isRecording ? 'recording' : ''}`}>{currentTime}/5:00</div>

          <button
            className={`recorder-button ${!isRecording ? 'start' : ''} ${isLongPress ? 'cancel' : ''}`}
            type="button"
            onClick={handleRecording}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerEnd}
            onPointerUp={handlePointerEnd}
          >
            <span className="recorder-button-top">{buttonText}</span>
            <span className="recorder-button-bottom" />
            <span className="recorder-button-base" />
          </button>

          {isRecording && (
            <div className="recorder-recording-loading">
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
              <span className="recorder-loading-bar" />
            </div>
          )}
        </div>
      </div>

      {showPopup && (
        <div className="recorder-popup-mask show" onClick={closePopup}>
          <section className="recorder-popup-content show" onClick={(event) => event.stopPropagation()}>
            <div className="recorder-transcription-container">
              {isTranscribing && <div className="recorder-loading-text">{loadingText}</div>}
              {isTranscribing && (
                <div className="recorder-loading recorder-processing-loading">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {!isTranscribing && <div className="recorder-transcription-text">{transcriptionText}</div>}
            </div>

            <div className="recorder-preview-actions">
              <button className="recorder-preview-action-item recorder-play-btn" type="button" onClick={playRecording}>
                播放
              </button>
              <button className="recorder-preview-action-item recorder-edit-btn" type="button" onClick={handleEdit}>
                编辑
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
