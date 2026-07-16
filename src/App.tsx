import React, { useState, useEffect, useRef } from "react";
import { 
  Folder, 
  File, 
  Cpu, 
  Play, 
  Square, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Download, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileVideo, 
  Languages, 
  Volume2, 
  Activity, 
  Sliders, 
  Copy, 
  FileText, 
  Search,
  BookOpen,
  Settings,
  Flame,
  Check,
  Mic,
  Music,
  VolumeX,
  Smile,
  Sparkles,
  Eye,
  Globe,
  FileJson,
  FolderArchive,
  Package
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { pythonCodebase, folderStructure, FolderNode, CodeFile } from "./data/pythonCodebase";

interface Subtitle {
  id: number;
  start: string;
  end: string;
  text: string;
  originalText?: string;
  speaker?: string;
}

interface DubbingJob {
  id: string;
  name: string;
  size: string;
  sourceLang: string;
  targetLang: string;
  voiceType: string;
  status: "QUEUED" | "PROCESSING" | "PAUSED" | "COMPLETED" | "FAILED";
  progress: number;
  currentStep: number;
}

const DEFAULT_SUBTITLES: Subtitle[] = [
  { id: 1, start: "00:00:01.200", end: "00:00:04.500", text: "Chào mừng các bạn đã quay trở lại với kênh công nghệ AI của chúng tôi.", speaker: "Speaker A" },
  { id: 2, start: "00:00:05.100", end: "00:00:09.300", text: "Hôm nay, chúng ta sẽ cùng khám phá cách hoạt động của mô hình F5-TTS mới nhất.", speaker: "Speaker A" },
  { id: 3, start: "00:00:09.800", end: "00:00:14.200", text: "Mô hình này cho phép nhân bản giọng nói cực kỳ tự nhiên chỉ với 3 giây âm thanh mẫu.", speaker: "Speaker B" },
  { id: 4, start: "00:00:14.800", end: "00:00:19.000", text: "Hãy cùng thực hành biên dịch và lồng tiếng hoàn toàn tự động ngay bây giờ nhé!", speaker: "Speaker B" }
];

const PIPELINE_STEPS = [
  { num: 1, title: "Import Video", desc: "Xác thực tệp, trích xuất siêu dữ liệu hình ảnh & FPS" },
  { num: 2, title: "Extract Audio", desc: "Sử dụng FFmpeg tách âm thanh gốc ra file WAV 48kHz" },
  { num: 3, title: "Speech Recognition", desc: "Dùng Faster Whisper Large-v3 nhận diện từ ngữ & mốc thời gian" },
  { num: 4, title: "Translation", desc: "Dịch phụ đề bằng Gemini AI / Llama giữ nguyên cấu trúc JSON" },
  { num: 5, title: "Sentence Segmentation", desc: "Phân mảnh câu để tối ưu hóa thời lượng voiceover" },
  { num: 6, title: "Voice Cloning (TTS)", desc: "Nhân bản giọng nói mẫu bằng XTTS v2 hoặc F5-TTS" },
  { num: 7, title: "Duration Matching", desc: "Co dãn thời lượng khớp mốc thời gian bằng RubberBand" },
  { num: 8, title: "Background Music (Demucs)", desc: "Tách vocal & nhạc nền, nén nhiễu âm thanh gốc" },
  { num: 9, title: "Audio Enhancement", desc: "Chuẩn hóa âm lượng (LUFS), nén limiter, mix nhạc nền" },
  { num: 10, title: "Video Export", desc: "Sử dụng FFmpeg ghép luồng âm thanh mới vào video gốc ở đúng FPS" }
];

const SAMPLE_VIDEOS = [
  { name: "AI_Revolution_2026.mp4", size: "48.2 MB", duration: "19s" },
  { name: "Tech_Review_Demo.mov", size: "124.5 MB", duration: "19s" },
  { name: "Cooking_Masterclass.mkv", size: "85.1 MB", duration: "19s" }
];

export default function App() {
  // State quản lý codebase
  const [selectedFileKey, setSelectedFileKey] = useState<string>("requirements");
  const [copied, setCopied] = useState<boolean>(false);
  const [searchCodeQuery, setSearchCodeQuery] = useState<string>("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "local_dubber": true,
    "local_dubber/config": true,
    "local_dubber/workers": true,
    "local_dubber/utils": true,
    "local_dubber/ui": true
  });

  // State quản lý Workspace / Pipeline
  const [queue, setQueue] = useState<DubbingJob[]>([
    {
      id: "job-1",
      name: "AI_Revolution_2026.mp4",
      size: "48.2 MB",
      sourceLang: "Vietnamese",
      targetLang: "English",
      voiceType: "Original Speaker Clone",
      status: "QUEUED",
      progress: 0,
      currentStep: 0
    }
  ]);
  const [activeJobId, setActiveJobId] = useState<string | null>("job-1");
  const [subtitles, setSubtitles] = useState<Subtitle[]>(DEFAULT_SUBTITLES);
  const [sourceLang, setSourceLang] = useState<string>("Vietnamese");
  const [targetLang, setTargetLang] = useState<string>("English");
  const [translatorModel, setTranslatorModel] = useState<string>("Gemini AI");
  const [voiceType, setVoiceType] = useState<string>("Original Speaker Clone");
  const [customVoiceName, setCustomVoiceName] = useState<string>("RTX_Cloned_Voice.wav");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Thao tác chạy tiến trình mô phỏng
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Chỉ số GPU giả lập
  const [gpuLoad, setGpuLoad] = useState<number>(0);
  const [vramUsed, setVramUsed] = useState<number>(1.8); // GB
  const [gpuTemp, setGpuTemp] = useState<number>(45); // C
  const [sysMemory, setSysMemory] = useState<number>(12.2); // GB
  const [estTimeRemaining, setEstTimeRemaining] = useState<string>("--:--");

  // Thao tác thêm tệp thủ công / Drag-Drop
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 2 & 3 & 4 & 5 ===
  const [activeRightTab, setActiveRightTab] = useState<"code" | "database" | "mixer" | "exporter" | "cloner" | "monitor" | "lipsync" | "subtitles" | "separation" | "publisher">("cloner"); // Mặc định mở Tab Cloner để người dùng thấy ngay Giai đoạn 5!
  const [dbTable, setDbTable] = useState<"jobs" | "transcripts" | "schema">("jobs");
  const [simulateCrashOnStep6, setSimulateCrashOnStep6] = useState<boolean>(true);
  const [hasCrashed, setHasCrashed] = useState<boolean>(false);
  const [dbJobs, setDbJobs] = useState<any[]>([
    {
      id: 1,
      video_name: "AI_Revolution_2026.mp4",
      video_path: "C:/local_dubber/inputs/AI_Revolution_2026.mp4",
      source_lang: "Vietnamese",
      target_lang: "English",
      voice_clone_type: "XTTS_v2_Clone",
      status: "QUEUED",
      progress: 0,
      current_step: 0,
      error_message: null,
      updated_at: "2026-07-16 10:30:00"
    }
  ]);
  const [dbTranscripts, setDbTranscripts] = useState<any[]>([]);

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 6: GIÁM SÁT HIỆU NĂNG & CHẨN ĐOÁN HỆ THỐNG (QA & PERFORMANCE TRACKING) ===
  const [isStressTesting, setIsStressTesting] = useState<boolean>(false);
  const [stressProgress, setStressProgress] = useState<number>(0);
  const [stressVramHistory, setStressVramHistory] = useState<number[]>([4.1, 4.3, 4.2, 4.5, 4.3, 4.1, 4.2]);
  const [stressLoadHistory, setStressLoadHistory] = useState<number[]>([15, 20, 18, 25, 22, 19, 15]);
  const [diagnosticsLogs, setDiagnosticsLogs] = useState<string[]>([]);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditCompleted, setAuditCompleted] = useState<boolean>(false);
  const [ioLatencyScore, setIoLatencyScore] = useState<number>(0.125); // seconds for 50MB
  const [qaAudioDelay, setQaAudioDelay] = useState<number>(0); // delay correction offset ms
  const [qaWaveActive, setQaWaveActive] = useState<boolean>(false);
  const [activeTabDiagnostics, setActiveTabDiagnostics] = useState<"diagnostics" | "stress" | "qa_calibration">("diagnostics");

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 7: AI LIP-SYNC & HẬU KỲ VIDEO (WAV2LIP & GFPGAN PIPELINE) ===
  const [lipsyncModel, setLipsyncModel] = useState<"wav2lip" | "wav2lip_gan" | "sad_talker">("wav2lip_gan");
  const [faceRestorer, setFaceRestorer] = useState<"gfpgan" | "codeformer" | "none">("gfpgan");
  const [lipsyncPadding, setLipsyncPadding] = useState<number>(10); // pixels padding
  const [lipsyncScale, setLipsyncScale] = useState<number>(1.0);
  const [lipsyncMouthDilate, setLipsyncMouthDilate] = useState<number>(1.2);
  const [isLipsyncing, setIsLipsyncing] = useState<boolean>(false);
  const [lipsyncProgress, setLipsyncProgress] = useState<number>(0);
  const [lipsyncCompleted, setLipsyncCompleted] = useState<boolean>(false);
  const [lipsyncLogs, setLipsyncLogs] = useState<string[]>([]);
  const [gfpganStrength, setGfpganStrength] = useState<number>(0.8);
  const [lipsyncCompareActive, setLipsyncCompareActive] = useState<boolean>(false);
  const [lipsyncLandmarksActive, setLipsyncLandmarksActive] = useState<boolean>(true);

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 8: PHÂN HỆ PHỤ ĐỀ & CHÈN CỨNG ASS/SRT (SUBTITLE TRANSLATION & OVERLAY) ===
  const [subTranslationEngine, setSubTranslationEngine] = useState<"gemini" | "deepl" | "google_trans">("gemini");
  const [subStylePreset, setSubStylePreset] = useState<"default" | "netflix" | "youtube" | "cinematic">("netflix");
  const [subFontColor, setSubFontColor] = useState<string>("#eab308"); // Yellow as nice default
  const [subStrokeColor, setSubStrokeColor] = useState<string>("#000000");
  const [subFontSize, setSubFontSize] = useState<number>(24);
  const [subStrokeWidth, setSubStrokeWidth] = useState<number>(3);
  const [isBurningSubtitles, setIsBurningSubtitles] = useState<boolean>(false);
  const [burnProgress, setBurnProgress] = useState<number>(0);
  const [burnCompleted, setBurnCompleted] = useState<boolean>(false);
  const [burnLogs, setBurnLogs] = useState<string[]>([]);
  const [activeTabSubtitles, setActiveTabSubtitles] = useState<"translate" | "style" | "burn">("translate");
  const [subtitlesPreviewLines, setSubtitlesPreviewLines] = useState<any[]>([
    { start: "00:00:01,200", end: "00:00:04,500", text_vi: "Chào mừng các bạn đến với cuộc cách mạng trí tuệ nhân tạo năm 2026.", text_en: "Welcome to the artificial intelligence revolution of 2026." },
    { start: "00:00:04,600", end: "00:00:08,100", text_vi: "Hôm nay, chúng ta sẽ cùng tìm hiểu về sức mạnh của lồng tiếng AI local.", text_en: "Today, we will learn about the power of local AI dubbing." },
    { start: "00:00:08,200", end: "00:00:12,300", text_vi: "Hệ thống local_dubber sẽ tự động hóa hoàn toàn quy trình này.", text_en: "The local_dubber system will completely automate this process." },
  ]);

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 9: TÁCH ÂM THANH AI (AI VOCAL & BGM SEPARATION) ===
  const [sepModel, setSepModel] = useState<"htdemucs" | "mdxnet" | "wavelet">("htdemucs");
  const [sepStems, setSepStems] = useState<number>(2); // 2 stems (vocal + background) or 4 stems
  const [sepOverlap, setSepOverlap] = useState<number>(0.25);
  const [isSeparatingAudio, setIsSeparatingAudio] = useState<boolean>(false);
  const [sepProgress, setSepProgress] = useState<number>(0);
  const [sepCompleted, setSepCompleted] = useState<boolean>(false);
  const [sepLogs, setSepLogs] = useState<string[]>([]);
  const [activeTabSeparation, setActiveTabSeparation] = useState<"model" | "stems" | "run">("model");
  const [audioVocalVolume, setAudioVocalVolume] = useState<number>(100);
  const [audioBgmVolume, setAudioBgmVolume] = useState<number>(40);
  const [audioSfxVolume, setAudioSfxVolume] = useState<number>(80);

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 10: AI MULTI-LANGUAGE PUBLISHER ===
  const [pubTitle, setPubTitle] = useState<string>("Sự trỗi dậy của Trí tuệ Nhân tạo 2026");
  const [pubDesc, setPubDesc] = useState<string>("Phim tài liệu khoa học khám phá sự tiến hóa thần tốc của AI, quy trình xử lý lồng tiếng và phục chế hình ảnh.");
  const [pubLanguages, setPubLanguages] = useState<string[]>(["vi", "en", "es", "ja"]);
  const [pubFormats, setPubFormats] = useState<string[]>(["mkv", "release_pkg"]);
  const [pubActiveTab, setPubActiveTab] = useState<"metadata" | "tracks" | "build">("metadata");
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [pubProgress, setPubProgress] = useState<number>(0);
  const [pubLogs, setPubLogs] = useState<string[]>([]);
  const [pubCompleted, setPubCompleted] = useState<boolean>(false);


  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 4: CUDA & EXPORT PIPELINE ===
  const [cudaFp16, setCudaFp16] = useState<boolean>(true);
  const [cudaFlashAttr, setCudaFlashAttr] = useState<boolean>(true);
  const [nvencAccel, setNvencAccel] = useState<boolean>(true);
  const [cudaBatchSize, setCudaBatchSize] = useState<number>(2);
  const [gpuDeviceId, setGpuDeviceId] = useState<string>("cuda:0");
  const [videoCodec, setVideoCodec] = useState<string>("h264_nvenc");
  const [subtitleMux, setSubtitleMux] = useState<string>("hardburn");
  const [audioBitrate, setAudioBitrate] = useState<number>(256);
  const [normalizeLufs, setNormalizeLufs] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [exportCompleted, setExportCompleted] = useState<boolean>(false);

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 3: DÒNG THỜI GIAN & BỘ TRỘN ÂM THANH (MIXER & RUBBERBAND TIMELINE) ===
  const [vocalVolume, setVocalVolume] = useState<number>(85);
  const [musicVolume, setMusicVolume] = useState<number>(40);
  const [masterVolume, setMasterVolume] = useState<number>(90);
  const [isVocalMuted, setIsVocalMuted] = useState<boolean>(false);
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);
  const [isMasterMuted, setIsMasterMuted] = useState<boolean>(false);
  const [vocalSolo, setVocalSolo] = useState<boolean>(false);
  const [musicSolo, setMusicSolo] = useState<boolean>(false);
  const [segmentOffsets, setSegmentOffsets] = useState<Record<number, number>>({ 1: 0, 2: 120, 3: -50, 4: 80 });
  const [playingSegmentId, setPlayingSegmentId] = useState<number | null>(null);
  const [playbackType, setPlaybackType] = useState<"original" | "dubbed" | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [vuLevels, setVuLevels] = useState<number[]>([0, 0, 0]); // Vocal, Music, Master levels (0-100)

  // === CÁC STATE PHỤC VỤ GIAI ĐOẠN 5: VOICE CLONING LAB & MULTI-SPEAKER DIARIZATION ===
  const [cloneModel, setCloneModel] = useState<"xtts_v2" | "f5_tts">("xtts_v2");
  const [cloneText, setCloneText] = useState<string>("Bản tin công nghệ trí tuệ nhân tạo chạy trực tiếp trên GPU RTX đem lại độ trễ cực thấp và bảo mật tuyệt đối.");
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [cloneProgress, setCloneProgress] = useState<number>(0);
  const [cloneCompleted, setCloneCompleted] = useState<boolean>(false);
  const [clonedAudioPlaying, setClonedAudioPlaying] = useState<boolean>(false);
  const [cloneTemperature, setCloneTemperature] = useState<number>(0.75);
  const [cloneSpeed, setCloneSpeed] = useState<number>(1.0);
  const [cloneSpeechLogs, setCloneSpeechLogs] = useState<string[]>([]);
  const [selectedVoiceRef, setSelectedVoiceRef] = useState<string>("RTX_Cloned_Voice.wav");
  const [voiceRefList, setVoiceRefList] = useState<any[]>([
    { id: 1, name: "RTX_Cloned_Voice.wav", duration: "3.2s", speaker: "Speaker A (Chủ kênh)", isSystem: true, quality: "Studio 24-bit" },
    { id: 2, name: "Morgan_Freeman_Ref.wav", duration: "5.5s", speaker: "Morgan Freeman", isSystem: true, quality: "Professional Warm" },
    { id: 3, name: "Elon_Musk_Ref.wav", duration: "4.1s", speaker: "Elon Musk", isSystem: true, quality: "Clean Distinct" },
    { id: 4, name: "Vietnamese_Female_Ref.wav", duration: "6.0s", speaker: "Speaker B (Nữ MC)", isSystem: true, quality: "Studio Soft" }
  ]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState<boolean>(false);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({
    "Speaker A": "RTX_Cloned_Voice.wav",
    "Speaker B": "Vietnamese_Female_Ref.wav",
    "Speaker C": "Morgan_Freeman_Ref.wav"
  });

  const activeJob = queue.find(j => j.id === activeJobId) || null;

  // Hiệu ứng nhấp nháy thanh âm lượng VU Meter khi đang phát âm thanh
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playingSegmentId !== null) {
      interval = setInterval(() => {
        setPlaybackProgress(prev => {
          if (prev >= 100) {
            setPlayingSegmentId(null);
            setPlaybackType(null);
            setVuLevels([0, 0, 0]);
            return 0;
          }
          return prev + 5;
        });

        // Tạo dao động ngẫu nhiên cho cột VU
        const vocalRaw = isVocalMuted || (musicSolo && !vocalSolo) ? 0 : vocalVolume;
        const musicRaw = isMusicMuted || (vocalSolo && !musicSolo) ? 0 : musicVolume;
        
        const activeVocal = vocalRaw * (0.6 + Math.random() * 0.4);
        const activeMusic = musicRaw * (0.6 + Math.random() * 0.4);
        
        const masterRaw = masterVolume / 100;
        const activeMaster = Math.max(activeVocal, activeMusic) * masterRaw * (0.9 + Math.random() * 0.1);
        
        setVuLevels([
          Math.min(100, Math.round(activeVocal)),
          Math.min(100, Math.round(activeMusic)),
          Math.min(100, Math.round(activeMaster))
        ]);
      }, 100);
    } else {
      setVuLevels([0, 0, 0]);
    }
    return () => clearInterval(interval);
  }, [playingSegmentId, vocalVolume, musicVolume, masterVolume, isVocalMuted, isMusicMuted, vocalSolo, musicSolo]);

  // Tự động cuộn logs xuống cuối cùng
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [simLogs]);

  // Đọc log tiện ích
  const addLog = (msg: string, type: "INFO" | "SUCCESS" | "WARNING" | "CUDA_RUNNER" = "INFO") => {
    const timestamp = new Date().toLocaleTimeString();
    setSimLogs(prev => [...prev, `[${timestamp}] [${type}] ${msg}`]);
  };

  // Giả lập tiến trình xuất video FFmpeg (Giai đoạn 4)
  useEffect(() => {
    if (!isExporting) return;
    
    setExportCompleted(false);
    setExportProgress(0);
    setExportLogs([
      `[INFO] === KHỞI CHẠY PIPELINE BIÊN DỊCH VIDEO FFMPEG NVENC ===`,
      `[CUDA] Nhận diện phần cứng: GPU ID ${gpuDeviceId.toUpperCase()} (${gpuDeviceId === "cuda:0" ? "NVIDIA RTX 4090 24GB" : "NVIDIA RTX 3080 10GB"})`,
      `[CUDA] Cấu hình tăng tốc: FP16 Precision: ${cudaFp16 ? "ON" : "OFF"} | Flash Attention: ${cudaFlashAttr ? "ON" : "OFF"}`
    ]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const progress = step * 10;
      setExportProgress(progress);

      const timestamp = new Date().toLocaleTimeString();
      let logMsg = "";

      if (progress === 10) {
        logMsg = `[FFMPEG] Trích xuất luồng video từ file nguồn: C:/local_dubber/inputs/AI_Revolution_2026.mp4 (Resolution: 1920x1080, FPS: 29.97)`;
      } else if (progress === 20) {
        logMsg = `[CUDA] Đang giải phóng phân mảnh cache PyTorch (empty_cache)... Thu hồi 3.2 GB VRAM`;
      } else if (progress === 30) {
        logMsg = `[FFMPEG] Nạp luồng âm thanh lồng tiếng AI: AI_Vocal_cloned.wav (48kHz, Mono, AAC) - Chỉnh âm lượng: ${vocalVolume}% (+${Math.round((vocalVolume - 85) / 5)} dB)`;
      } else if (progress === 40) {
        logMsg = `[FFMPEG] Nạp luồng nhạc nền Demucs bóc tách: Demucs_BG_Music.wav (48kHz, Stereo, AAC) - Chỉnh âm lượng: ${musicVolume}% (${Math.round((musicVolume - 40) / 5)} dB)`;
      } else if (progress === 50) {
        logMsg = `[RUBBERBAND] Đồng bộ pha thời gian: Áp dụng giãn nở RubberBand CLI tốc độ khớp dòng thời gian...`;
      } else if (progress === 60) {
        logMsg = `[FFMPEG] Khởi tạo bộ phối trộn âm thanh amix (Vocal + Music) với tùy chọn chuẩn hóa LUFS: ${normalizeLufs ? "-14.0 LUFS (YouTube Standard)" : "Giữ nguyên"}`;
      } else if (progress === 70) {
        logMsg = `[FFMPEG] Cấu hình mã hóa hình ảnh phần cứng: Codec=${videoCodec.toUpperCase()} ${nvencAccel ? "(GPU NVENC Accelerated)" : "(CPU libx264)"} | Bitrate=${audioBitrate} kbps`;
      } else if (progress === 80) {
        if (subtitleMux === "hardburn") {
          logMsg = `[FFMPEG] [VF_FILTER] Tiến hành vẽ phụ đề cứng (Hardburn) lên luồng video từ file: C:/local_dubber/outputs/AI_Revolution_2026.srt`;
        } else if (subtitleMux === "soft") {
          logMsg = `[FFMPEG] Đang nhúng phụ đề dạng text rời (Soft Muxing SRT Track) vào container video...`;
        } else {
          logMsg = `[FFMPEG] Bỏ qua nhúng phụ đề theo cấu hình người dùng.`;
        }
      } else if (progress === 90) {
        logMsg = `[FFMPEG] Đang ghi file video đóng gói (Muxing Audio/Video streams into MP4 Container)... Ghi 568 frames...`;
      } else if (progress === 100) {
        logMsg = `[SUCCESS] Video compilation finished! Output file saved: C:/local_dubber/outputs/AI_Revolution_2026_dubbed.mp4`;
        setIsExporting(false);
        setExportCompleted(true);
        addLog("Đã xuất bản video lồng tiếng hoàn chỉnh thành công qua FFmpeg NVENC!", "SUCCESS");
        clearInterval(interval);
      }

      if (logMsg) {
        setExportLogs(prev => [...prev, `[${timestamp}] ${logMsg}`]);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isExporting, gpuDeviceId, cudaFp16, cudaFlashAttr, vocalVolume, musicVolume, normalizeLufs, videoCodec, nvencAccel, audioBitrate, subtitleMux]);

  // Giả lập sinh giọng đọc lồng tiếng (Voice cloning simulation)
  useEffect(() => {
    if (!isCloning) return;

    setCloneCompleted(false);
    setCloneProgress(0);
    setCloneSpeechLogs([
      `[INFO] === KHỞI CHẠY QUY TRÌNH VOICE INFERENCE CLONING ===`,
      `[DEVICE] Thiết bị suy luận: CUDA GPU (cuda:0) | Tự động chọn FP16 tối ưu`,
      `[MODEL] Đang nạp mô hình: ${cloneModel === "xtts_v2" ? "Coqui-TTS XTTS v2 Hybrid Model" : "F5-TTS Flow Matching Model"}`,
      `[LOAD] Nạp trọng số mô hình từ thư mục cache local... Cần khoảng 2.0s`
    ]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const progress = step * 10;
      setCloneProgress(progress);

      const timestamp = new Date().toLocaleTimeString();
      let logMsg = "";

      if (progress === 10) {
        logMsg = `[AUDIO] Đang bóc tách và phân tích tệp âm thanh mẫu: ${selectedVoiceRef}`;
      } else if (progress === 25) {
        logMsg = `[CUDA] Đang giải phóng phân mảnh bộ nhớ VRAM thừa (torch.cuda.empty_cache)... Thu hồi 1.5 GB VRAM`;
      } else if (progress === 40) {
        logMsg = `[CLONE] Tiến hành mã hóa giọng tham chiếu bằng AutoEncoder... Tạo mã hóa đặc trưng Speaker Embedding`;
      } else if (progress === 55) {
        logMsg = `[CLONE] Đang sinh giọng đọc (Text-to-Speech) qua mạng suy luận hồi quy nâng cao...`;
        logMsg += `\n -> Speed Multiplier: ${cloneSpeed}x | Temperature (Độ sáng tạo): ${cloneTemperature}`;
      } else if (progress === 70) {
        logMsg = `[POST] Áp dụng Vocoder để làm mịn tần số âm thanh (Dithering & Resampling sang 48kHz WAV)...`;
      } else if (progress === 85) {
        logMsg = `[EXPORT] Đang ghi file kết quả WAV tạm thời: C:/local_dubber/temp/segment_playground_cloned.wav`;
      } else if (progress === 100) {
        logMsg = `[SUCCESS] Đã nhân bản thành công! Tệp lồng tiếng sẵn sàng chạy thử.`;
        setIsCloning(false);
        setCloneCompleted(true);
        addLog(`Đã nhân bản giọng nói thành công cho văn bản mẫu bằng ${cloneModel.toUpperCase()}!`, "SUCCESS");
        clearInterval(interval);
      }

      if (logMsg) {
        setCloneSpeechLogs(prev => [...prev, `[${timestamp}] ${logMsg}`]);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isCloning, cloneModel, selectedVoiceRef, cloneSpeed, cloneTemperature]);

  const handleUploadVoiceSimulation = (fileName: string, speakerName: string) => {
    setIsUploadingVoice(true);
    setUploadProgress(0);
    
    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += 20;
      setUploadProgress(progressVal);
      
      if (progressVal >= 100) {
        clearInterval(interval);
        setIsUploadingVoice(false);
        
        // Thêm vào danh sách giọng mẫu
        setVoiceRefList(prev => [
          ...prev,
          {
            id: prev.length + 1,
            name: fileName,
            duration: "4.5s",
            speaker: speakerName || "Người dùng tải lên",
            isSystem: false,
            quality: "User Uploaded (Clean)"
          }
        ]);
        
        addLog(`Đã nhập thành công tệp giọng tham chiếu người dùng: ${fileName}`, "SUCCESS");
      }
    }, 200);
  };

  // Giả lập dao động của GPU
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning && !isPaused) {
        // GPU tải cao khi chạy AI
        const step = PIPELINE_STEPS[currentStepIndex]?.num || 1;
        let baseLoad = 15;
        let baseVram = 2.5;
        let baseTemp = 50;

        if (step === 3) { // Faster Whisper
          baseLoad = 85;
          baseVram = 6.4;
          baseTemp = 68;
        } else if (step === 6 || step === 7) { // TTS / Clone & RubberBand
          baseLoad = 72;
          baseVram = 8.1;
          baseTemp = 71;
        } else if (step === 8) { // Demucs audio separation
          baseLoad = 92;
          baseVram = 9.5;
          baseTemp = 74;
        } else if (step === 10) { // FFmpeg hardware encoding
          baseLoad = 45;
          baseVram = 3.2;
          baseTemp = 61;
        }

        const fluctuation = Math.floor(Math.random() * 12) - 6;
        setGpuLoad(Math.max(5, Math.min(100, baseLoad + fluctuation)));
        setGpuTemp(Math.max(40, Math.min(85, baseTemp + Math.floor(fluctuation / 2))));
        setVramUsed(parseFloat(Math.max(1.5, Math.min(16.0, baseVram + (fluctuation / 10))).toFixed(1)));
        setSysMemory(parseFloat((11.5 + Math.random() * 2).toFixed(1)));
      } else {
        // Chế độ chờ (Idle)
        setGpuLoad(Math.max(2, Math.floor(Math.random() * 5 + 3)));
        setGpuTemp(Math.max(40, Math.floor(Math.random() * 3 + 42)));
        setVramUsed(1.8);
        setSysMemory(12.2);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, currentStepIndex]);

  // Bộ điều khiển vòng lặp Tiến trình (Pipeline Simulation)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && !isPaused) {
      const stepDuration = 3000; // 3 giây một bước
      timer = setTimeout(() => {
        if (currentStepIndex < PIPELINE_STEPS.length - 1) {
          const nextIndex = currentStepIndex + 1;

          // GIẢ LẬP LỖI GPU OOM TẠI BƯỚC 6 (VOICE CLONING / TTS)
          if (simulateCrashOnStep6 && nextIndex === 5 && !hasCrashed) {
            setIsRunning(false);
            setHasCrashed(true);
            addLog("[CRITICAL_ERROR] CUDA Out of Memory (OOM) while running XTTS v2 on GPU:0 (Failed allocating 4.2GB VRAM)", "WARNING");
            addLog("[DATABASE] SQLite Checkpoint Manager: Saved incomplete state at Step 5. 2 segments đầu đã lưu cache.", "INFO");
            
            // Cập nhật Database SQLite giả lập: Jobs thành FAILED
            setDbJobs(prev => prev.map(job => {
              if (job.id === 1) {
                return {
                  ...job,
                  status: "FAILED",
                  current_step: 6,
                  progress: 50,
                  error_message: "CUDA Out of Memory (OOM) on GPU:0",
                  updated_at: new Date().toLocaleTimeString()
                };
              }
              return job;
            }));

            // Cập nhật Transcripts SQLite giả lập: 2 segment đầu hoàn thành, segment 3 bị lỗi
            setDbTranscripts(prev => prev.map((row, idx) => {
              if (idx < 2) {
                return { ...row, cache_status: "CACHED", cache_wav: `cache_seg_${row.id}.wav` };
              } else if (idx === 2) {
                return { ...row, cache_status: "FAILED", cache_wav: null };
              } else {
                return { ...row, cache_status: "PENDING", cache_wav: null };
              }
            }));

            // Cập nhật hàng đợi công việc chính của UI
            setQueue(prev => prev.map(job => {
              if (job.id === activeJobId) {
                return { ...job, status: "FAILED", progress: 50, currentStep: 6 };
              }
              return job;
            }));
            return;
          }

          setCurrentStepIndex(nextIndex);
          const percent = Math.floor((nextIndex / PIPELINE_STEPS.length) * 100);
          setOverallProgress(percent);

          // Cập nhật trạng thái Job trong hàng đợi
          setQueue(prev => prev.map(job => {
            if (job.id === activeJobId) {
              return { ...job, progress: percent, currentStep: nextIndex + 1, status: "PROCESSING" };
            }
            return job;
          }));

          // Cập nhật SQLite Database giả lập
          setDbJobs(prev => prev.map(job => {
            if (job.id === 1) {
              return {
                ...job,
                status: "PROCESSING",
                current_step: nextIndex + 1,
                progress: percent,
                error_message: null,
                updated_at: new Date().toLocaleTimeString()
              };
            }
            return job;
          }));

          // Ghi log chi tiết tương ứng với bước và cập nhật SQLite Transcripts
          const currentStep = PIPELINE_STEPS[nextIndex];
          if (currentStep.num === 2) {
            addLog("Đang gọi FFmpeg để chuyển đổi định dạng âm thanh gốc thành WAV PCM 48kHz mono...", "INFO");
          } else if (currentStep.num === 3) {
            addLog("Khởi động Faster-Whisper Large-v3. Đang ánh xạ mốc thời gian từ ngữ (Word-level timestamps)...", "CUDA_RUNNER");
            addLog("Phát hiện ngôn ngữ nói gốc: Tiếng Việt (Confidence: 99.8%)", "SUCCESS");

            // Đưa dữ liệu mốc thời gian vào SQLite Transcripts table
            const initialRows = subtitles.map((sub, idx) => ({
              id: sub.id,
              job_id: 1,
              start_time: sub.start,
              end_time: sub.end,
              original_text: sub.originalText || sub.text,
              translated_text: null,
              audio_dur_ratio: 1.0,
              cache_status: "PENDING",
              cache_wav: null
            }));
            setDbTranscripts(initialRows);
            addLog("[DATABASE] SQLite: Đã lưu thành công 4 bản ghi transcripts (Word-level timestamps) từ Faster-Whisper.", "INFO");

          } else if (currentStep.num === 4) {
            addLog("Đang đồng bộ hóa dịch kịch bản bằng Gemini API 3.5 Flash...", "INFO");
            // Kích hoạt dịch tự động thật nếu người dùng chưa bấm dịch trước đó
            triggerAutoTranslation();

          } else if (currentStep.num === 5) {
            addLog("Sentence Segmentation: Phân đoạn câu nói giúp tối ưu hóa luồng co dãn của RubberBand...", "INFO");
            // Cập nhật bản dịch trong SQLite Transcripts
            setDbTranscripts(prev => prev.map((row, idx) => ({
              ...row,
              translated_text: subtitles[idx]?.text || "...",
              cache_status: "SEGMENTED"
            })));
            addLog("[DATABASE] SQLite: Đã ghi nhận bản dịch ngôn ngữ đích vào cột 'translated_text' của bảng transcripts.", "INFO");

          } else if (currentStep.num === 6) {
            addLog(`Khởi chạy GPU XTTS v2. Nhân bản giọng nói theo cấu hình: ${voiceType}...`, "CUDA_RUNNER");
            
            // Nếu không có crash, cache toàn bộ segment vào SQLite
            setDbTranscripts(prev => prev.map(row => ({
              ...row,
              cache_status: "CACHED",
              cache_wav: `cache_seg_${row.id}.wav`
            })));
            addLog("[DATABASE] SQLite Checkpoint: 4/4 segments đã được sinh giọng nói thành công và cache vào transcripts.", "SUCCESS");

          } else if (currentStep.num === 7) {
            addLog("Phát hiện chênh lệch thời lượng câu gốc và câu lồng tiếng AI. Đang gọi RubberBand CLI để co dãn...", "INFO");
            addLog("RubberBand: Đồng bộ hoàn tất với sai số lệch pha < 15ms cho tất cả 4 phân đoạn câu.", "SUCCESS");
            setDbTranscripts(prev => prev.map(row => ({
              ...row,
              audio_dur_ratio: parseFloat((0.9 + Math.random() * 0.2).toFixed(2))
            })));

          } else if (currentStep.num === 8) {
            addLog("Kích hoạt module Facebook Demucs tách vocal và nhạc nền (Vocal/Drums/Bass/Other)...", "CUDA_RUNNER");
            addLog("Tách luồng nhạc nền (Background Music) thành công. Giữ nguyên độ phân giải âm thanh gốc.", "SUCCESS");
          } else if (currentStep.num === 9) {
            addLog("Đang tinh chỉnh chất lượng âm thanh: Normalize -14 LUFS, áp dụng Noise Limiter và EQ nhẹ...", "INFO");
          } else if (currentStep.num === 10) {
            addLog("FFmpeg: Tiến hành đóng gói âm thanh mới và video gốc, mã hóa phần cứng GPU (h264_nvenc)...", "CUDA_RUNNER");
          }

          // Cập nhật thời gian còn lại ước tính
          const remainingSeconds = (PIPELINE_STEPS.length - nextIndex) * 3;
          setEstTimeRemaining(`00:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`);

        } else {
          // Hoàn thành hoàn toàn
          setOverallProgress(100);
          setIsRunning(false);
          addLog("=== QUY TRÌNH DUBBING VIDEO HOÀN THÀNH XUẤT SẮC ===", "SUCCESS");
          addLog("Đường dẫn xuất tệp: local_dubber/outputs/AI_Revolution_2026_dubbed.mp4", "SUCCESS");
          setEstTimeRemaining("00:00");

          setQueue(prev => prev.map(job => {
            if (job.id === activeJobId) {
              return { ...job, progress: 100, status: "COMPLETED" };
            }
            return job;
          }));

          // Cập nhật SQLite Jobs thành COMPLETED
          setDbJobs(prev => prev.map(job => {
            if (job.id === 1) {
              return {
                ...job,
                status: "COMPLETED",
                progress: 100,
                error_message: null,
                updated_at: new Date().toLocaleTimeString()
              };
            }
            return job;
          }));

          // Giải phóng/Dọn dẹp checkpoint dở dang khi thành công hoàn toàn
          addLog("[DATABASE] SQLite Checkpoint Manager: Dọn dẹp bản ghi dở dang thành công (Database cleanup).", "INFO");
        }
      }, stepDuration);
    }

    return () => clearTimeout(timer);
  }, [isRunning, isPaused, currentStepIndex, activeJobId, simulateCrashOnStep6, hasCrashed]);

  // Thực hiện gọi API dịch bằng Gemini 3.5 Flash trên Server thực tế!
  const handleTranslateWithGemini = async () => {
    if (isTranslating) return;
    setIsTranslating(true);
    addLog(`Đang gửi yêu cầu dịch phụ đề qua Gemini API thực tế: ${sourceLang} ➔ ${targetLang}...`, "INFO");

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtitles,
          sourceLang,
          targetLang
        })
      });

      const data = await response.json();
      if (data.success && data.subtitles) {
        setSubtitles(data.subtitles);
        addLog("Dịch thuật kịch bản bằng Gemini AI thành công! Trực quan hóa phụ đề đã được cập nhật.", "SUCCESS");
      } else {
        throw new Error(data.error || "Không nhận được phản hồi chính xác từ Server.");
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Lỗi dịch thuật: ${err.message || err}. Đang áp dụng bản dịch dự phòng.`, "WARNING");
      // Bản dịch dự phòng
      const fallbackTranslations: Record<string, string[]> = {
        "English": [
          "Welcome back to our AI technology channel.",
          "Today, we will explore how the latest F5-TTS model works.",
          "This model allows extremely natural voice cloning with just 3 seconds of audio sample.",
          "Let's practice translating and dubbing completely automatically right now!"
        ],
        "Japanese": [
          "AIテクノロジーチャンネルへようこそ。",
          "今日、最新のF5-TTSモデルの仕組みを探ります。",
          "このモデルは、わずか3秒の音声サンプルで非常に自然な音声クローンを作成できます。",
          "今すぐ完全に自動化された翻訳とダビングを練習しましょう！"
        ]
      };

      const selectedFallback = fallbackTranslations[targetLang] || fallbackTranslations["English"];
      setSubtitles(prev => prev.map((sub, idx) => ({
        ...sub,
        text: selectedFallback[idx] || sub.text,
        originalText: sub.text
      })));
    } finally {
      setIsTranslating(false);
    }
  };

  const triggerAutoTranslation = () => {
    // Tự động kích hoạt dịch không đồng bộ khi chạy tới bước Dịch phụ đề trong Pipeline
    handleTranslateWithGemini();
  };

  // Trình khởi chạy lồng tiếng
  const handleStartDubbing = () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsPaused(false);
    setHasCrashed(false);
    setCurrentStepIndex(0);
    setOverallProgress(5);
    setEstTimeRemaining("00:27");
    
    setSimLogs([]);
    addLog("Khởi động môi trường xử lý lồng tiếng cục bộ (Local Windows 11)...", "INFO");
    addLog(`Đang quét thiết bị phần cứng hỗ trợ... Phát hiện GPU: NVIDIA GeForce RTX 4090 24GB`, "SUCCESS");
    addLog("Đang tải các thông số cấu hình từ local_dubber/config/settings.py...", "INFO");
    addLog("Tạo thư mục đệm tạm thời: local_dubber/temp/", "INFO");
    
    setQueue(prev => prev.map(job => {
      if (job.id === activeJobId) {
        return { ...job, status: "PROCESSING", progress: 5, currentStep: 1 };
      }
      return job;
    }));

    // Thiết lập lại database jobs về ban đầu khi bắt đầu chạy mới
    setDbJobs(prev => prev.map(job => {
      if (job.id === 1) {
        return {
          ...job,
          status: "PROCESSING",
          progress: 5,
          current_step: 1,
          error_message: null,
          updated_at: new Date().toLocaleTimeString()
        };
      }
      return job;
    }));
    setDbTranscripts([]);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      addLog("Khôi phục quy trình xử lý lồng tiếng. Tiếp tục từ Checkpoint an toàn...", "SUCCESS");
      setQueue(prev => prev.map(job => {
        if (job.id === activeJobId) return { ...job, status: "PROCESSING" };
        return job;
      }));
    } else {
      setIsPaused(true);
      addLog("Tạm ngắt tiến trình lồng tiếng. Hệ thống đã lưu trữ trạng thái âm thanh đã tách và transcript (Checkpoint).", "WARNING");
      setQueue(prev => prev.map(job => {
        if (job.id === activeJobId) return { ...job, status: "PAUSED" };
        return job;
      }));
    }
  };

  const handleCancelDubbing = () => {
    setIsRunning(false);
    setIsPaused(false);
    addLog("Hủy bỏ quy trình xử lý lồng tiếng theo yêu cầu của người dùng. Giải phóng VRAM GPU...", "WARNING");
    setQueue(prev => prev.map(job => {
      if (job.id === activeJobId) return { ...job, status: "QUEUED", progress: 0, currentStep: 0 };
      return job;
    }));
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setHasCrashed(false);
    setOverallProgress(0);
    setCurrentStepIndex(0);
    setSubtitles(DEFAULT_SUBTITLES.map(s => ({ ...s, text: s.text })));
    setSimLogs([]);
    setEstTimeRemaining("--:--");
    setQueue(prev => prev.map(job => {
      if (job.id === activeJobId) return { ...job, status: "QUEUED", progress: 0, currentStep: 0 };
      return job;
    }));
    setDbJobs(prev => prev.map(job => {
      if (job.id === 1) {
        return {
          ...job,
          status: "QUEUED",
          progress: 0,
          current_step: 0,
          error_message: null,
          updated_at: new Date().toLocaleTimeString()
        };
      }
      return job;
    }));
    setDbTranscripts([]);
    addLog("Đã cài đặt lại toàn bộ tham số môi trường và SQLite Database.", "INFO");
  };

  const handleRecoverCheckpoint = () => {
    setHasCrashed(false);
    setIsRunning(true);
    setIsPaused(false);
    
    addLog("[RECOVERY] === KÍCH HOẠT CHECKPOINT RECOVERY (STAGE 2) ===", "SUCCESS");
    addLog("[DATABASE] Đang kết nối SQLite... Đọc bản ghi trạng thái từ bảng 'dubbing_jobs'...", "INFO");
    addLog("[DATABASE] SQLite Checkpoint Manager: Phát hiện trạng thái lỗi tại Bước 6. Bản ghi 'transcripts' chứa 2/4 segment đã hoàn thành TTS.", "SUCCESS");
    addLog("[RECOVERY] Trích xuất thành công dữ liệu đệm: cache_seg_1.wav (2.5s) & cache_seg_2.wav (3.8s)", "INFO");
    addLog("[RECOVERY] Hệ thống sẽ tự động BỎ QUA Bước 1-5 và BỎ QUA sinh giọng cho Segment #1, #2.", "SUCCESS");
    addLog("[RECOVERY] Cấu hình XTTS v2: Giải phóng bộ nhớ đệm VRAM và kích hoạt chế độ CPU Fallback để chống quá tải (OOM).", "WARNING");
    addLog("[RECOVERY] Tiếp tục thực thi pipeline trực tiếp từ Bước 6 (Voice Cloning) - Segment #3...", "INFO");
    
    // Khôi phục SQLite Jobs giả lập
    setDbJobs(prev => prev.map(job => {
      if (job.id === 1) {
        return {
          ...job,
          status: "PROCESSING",
          current_step: 6,
          progress: 55,
          error_message: null,
          updated_at: new Date().toLocaleTimeString()
        };
      }
      return job;
    }));
    
    // Khôi phục SQLite Transcripts giả lập: Chuyển 2 segment đầu thành CACHED, segment 3 & 4 về PENDING để tiếp tục
    setDbTranscripts(prev => prev.map((row, idx) => {
      if (idx < 2) {
        return { ...row, cache_status: "CACHED", cache_wav: `cache_seg_${row.id}.wav` };
      } else {
        return { ...row, cache_status: "PENDING", cache_wav: null };
      }
    }));
    
    // Tiếp tục chạy pipeline từ Bước 6 (index 5)
    setCurrentStepIndex(5);
    setOverallProgress(55);
    
    // Đồng bộ hàng đợi
    setQueue(prev => prev.map(job => {
      if (job.id === activeJobId) {
        return { ...job, status: "PROCESSING", progress: 55, currentStep: 6 };
      }
      return job;
    }));
  };

  // Drag-Drop Handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const newJob: DubbingJob = {
        id: `job-${Date.now()}`,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        sourceLang,
        targetLang,
        voiceType,
        status: "QUEUED",
        progress: 0,
        currentStep: 0
      };
      setQueue(prev => [...prev, newJob]);
      setActiveJobId(newJob.id);
      addLog(`Đã tải tệp video người dùng thả vào: ${file.name} (${newJob.size})`, "SUCCESS");
    }
  };

  const handleAddSampleVideo = (video: typeof SAMPLE_VIDEOS[0]) => {
    const newJob: DubbingJob = {
      id: `job-${Date.now()}`,
      name: video.name,
      size: video.size,
      sourceLang,
      targetLang,
      voiceType,
      status: "QUEUED",
      progress: 0,
      currentStep: 0
    };
    setQueue(prev => [...prev, newJob]);
    setActiveJobId(newJob.id);
    addLog(`Đã thêm video mẫu vào danh sách xử lý: ${video.name}`, "SUCCESS");
  };

  const handleDeleteJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue(prev => prev.filter(j => j.id !== id));
    if (activeJobId === id) {
      const remaining = queue.filter(j => j.id !== id);
      setActiveJobId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Copy Code Handler
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Đệ quy hiển thị Folder Tree
  const renderTree = (nodes: FolderNode[]) => {
    return (
      <div className="pl-3 space-y-1">
        {nodes.map((node) => {
          const isFolder = node.type === "folder";
          const isExpanded = expandedNodes[node.path];
          const isSelected = node.fileKey === selectedFileKey;

          return (
            <div key={node.path} className="text-sm">
              <div 
                className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer transition ${
                  isSelected ? "bg-slate-800 text-teal-400 font-medium" : "text-slate-300 hover:bg-slate-800/50"
                }`}
                onClick={() => {
                  if (isFolder) {
                    setExpandedNodes(prev => ({ ...prev, [node.path]: !prev[node.path] }));
                  } else if (node.fileKey) {
                    setSelectedFileKey(node.fileKey);
                  }
                }}
              >
                {isFolder ? (
                  <span className="text-slate-500">
                    <ChevronRight className={`h-4 w-4 transform transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </span>
                ) : (
                  <span className="w-4" />
                )}
                {isFolder ? (
                  <Folder className="h-4 w-4 text-amber-400 fill-amber-400/10" />
                ) : (
                  <File className={`h-4 w-4 ${isSelected ? "text-teal-400" : "text-slate-400"}`} />
                )}
                <span className="truncate">{node.name}</span>
              </div>

              {isFolder && isExpanded && node.children && (
                <div className="border-l border-slate-800 ml-3 pl-1">
                  {renderTree(node.children)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Lọc kịch bản code dựa theo tìm kiếm
  const activeFile = pythonCodebase[selectedFileKey] || pythonCodebase["requirements"];

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-200 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-[#111114] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/10">AD</div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              AI DUBBER PRO
              <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                v2.4.0-build.local
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6 text-[10px] uppercase tracking-wider font-medium text-slate-400">
          <div className="hidden sm:flex flex-col items-end">
            <span className="flex items-center gap-1"><Cpu className="h-3 w-3 text-blue-400" /> GPU: NVIDIA RTX 4090 ({gpuTemp}°C)</span>
            <div className="w-24 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${gpuLoad}%` }}
              ></div>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end">
            <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-amber-500" /> VRAM: {vramUsed}GB / 24GB</span>
            <div className="w-24 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${(vramUsed / 24) * 100}%` }}
              ></div>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleTranslateWithGemini}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-900/10"
          >
            QUY TRÌNH GEMINI API
          </button>
        </div>
      </header>

      {/* Main Workspace with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Nav */}
        <nav className="w-16 bg-[#111114] border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0">
          <div className="p-2.5 bg-blue-600/10 text-blue-500 rounded-lg" title="AI Dubbing Studio">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="p-2.5 text-slate-500 hover:text-white transition-colors cursor-pointer" title="Queue Monitor">
            <Activity className="w-5 h-5" />
          </div>
          <div className="p-2.5 text-slate-500 hover:text-white transition-colors cursor-pointer" title="Workspace settings">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="mt-auto p-2.5 text-slate-500 hover:text-white transition-colors cursor-pointer" title="Settings">
            <Settings className="w-5 h-5" />
          </div>
        </nav>

        {/* Workspace Panels Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* CỘT TRÁI (XL: 7) */}
              <div className="xl:col-span-7 space-y-6">
                
                {/* Panel 1: Import & Cấu hình */}
                <div className="bg-[#121214] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <FileVideo className="h-4 w-4 text-blue-500" />
                      1. Import Video & Cấu hình Ngôn ngữ
                    </h2>
                    <span className="text-[10px] font-mono text-slate-500">Supported: MP4, MOV, AVI, MKV, WEBM</span>
                  </div>

                  {/* Vùng kéo thả */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isDragActive ? "border-blue-500 bg-blue-500/5" : "border-white/10 hover:border-white/20 bg-[#16161a]"
                    }`}
                  >
                    <FileVideo className="h-8 w-8 text-slate-500 mb-2" />
                    <p className="text-xs font-medium text-slate-300">
                      Kéo & thả video của bạn vào đây để nạp vào hàng đợi lồng tiếng
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Hệ thống tự động kích hoạt tiến trình trích xuất âm thanh</p>
                    
                    {/* Nút thêm nhanh video mẫu */}
                    <div className="flex gap-2 mt-4 flex-wrap justify-center">
                      {SAMPLE_VIDEOS.map((v) => (
                        <button 
                          key={v.name}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAddSampleVideo(v); }}
                          className="px-2 py-1 text-[10px] bg-[#111114] hover:bg-slate-800 text-slate-300 rounded border border-white/5 flex items-center gap-1 transition"
                        >
                          <Plus className="h-3 w-3 text-blue-400" />
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cấu hình Ngôn ngữ */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#16161a] p-4 rounded-xl border border-white/5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Languages className="h-3 w-3 text-blue-400" />
                        Nguồn (Source)
                      </label>
                      <select 
                        value={sourceLang} 
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="w-full bg-[#111114] border border-white/5 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Vietnamese">Vietnamese (VN)</option>
                        <option value="English">English (US)</option>
                        <option value="Japanese">Japanese (JP)</option>
                        <option value="French">French (FR)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Languages className="h-3 w-3 text-emerald-400" />
                        Đích (Target)
                      </label>
                      <select 
                        value={targetLang} 
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full bg-[#111114] border border-white/5 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="English">English (US)</option>
                        <option value="Vietnamese">Vietnamese (VN)</option>
                        <option value="Japanese">Japanese (JP)</option>
                        <option value="French">French (FR)</option>
                        <option value="Chinese">Chinese (ZH)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Settings className="h-3 w-3 text-amber-500" />
                        Dịch Thuật (LLM)
                      </label>
                      <select 
                        value={translatorModel} 
                        onChange={(e) => setTranslatorModel(e.target.value)}
                        className="w-full bg-[#111114] border border-white/5 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Gemini AI">Gemini 3.5 Flash (API Server)</option>
                        <option value="Google Gemma">Google Gemma 2B (Local)</option>
                        <option value="Llama">Llama 3 8B (Local GPU)</option>
                        <option value="NLLB">Meta NLLB-200</option>
                      </select>
                    </div>
                  </div>

                  {/* Cấu hình lồng giọng */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#16161a] p-4 rounded-xl border border-white/5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-blue-400" />
                        Nhân bản giọng nói (Voice Clone)
                      </label>
                      <select 
                        value={voiceType} 
                        onChange={(e) => setVoiceType(e.target.value)}
                        className="w-full bg-[#111114] border border-white/5 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Original Speaker Clone">Original Speaker Clone (XTTS v2)</option>
                        <option value="Male AI">Giọng Nam AI chuẩn thương mại</option>
                        <option value="Female AI">Giọng Nữ AI chuẩn thương mại</option>
                        <option value="Custom Voice">Custom Voice (.wav mẫu)</option>
                      </select>
                    </div>

                    {voiceType === "Custom Voice" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Tên file âm thanh mẫu
                        </label>
                        <input 
                          type="text" 
                          value={customVoiceName}
                          onChange={(e) => setCustomVoiceName(e.target.value)}
                          className="w-full bg-[#111114] border border-white/5 rounded-lg py-1.5 px-3 text-xs font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                          placeholder="path_to_voice_sample.wav"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Tasks Queue */}
                <div className="bg-[#121214] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-blue-500" />
                      Hàng đợi mã hóa lồng tiếng (Video Tasks Queue)
                    </h2>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                      Queue: {queue.length} video
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {queue.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-white/5 rounded-lg text-slate-600 text-xs font-mono">
                        QUEUE EMPTY. PLEASE LOAD OR DRAG A VIDEO FILE above.
                      </div>
                    ) : (
                      queue.map((job) => {
                        const isActive = job.id === activeJobId;
                        return (
                          <div 
                            key={job.id}
                            onClick={() => setActiveJobId(job.id)}
                            className={`p-3 rounded-lg border transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                              isActive 
                                ? "bg-[#16161a] border-blue-500/40 shadow-sm shadow-blue-500/5" 
                                : "bg-[#111114]/40 border-white/5 hover:bg-[#16161a]/60"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileVideo className={`h-8 w-8 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-500'}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{job.name}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 mt-0.5">
                                  <span>Dung lượng: {job.size}</span>
                                  <span className="text-blue-400 font-mono">{job.sourceLang} ➔ {job.targetLang}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                job.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                job.status === "PROCESSING" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse" :
                                job.status === "PAUSED" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                "bg-[#111114] text-slate-500 border border-white/5"
                              }`}>
                                {job.status}
                              </span>

                              {job.progress > 0 && (
                                <span className="text-xs font-bold font-mono text-blue-400">
                                  {job.progress}%
                                </span>
                              )}

                              <button 
                                type="button"
                                onClick={(e) => handleDeleteJob(job.id, e)}
                                className="p-1 text-slate-600 hover:text-rose-400 transition"
                                title="Xóa khỏi hàng đợi"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Panel 3: Pipeline Control & Steps Visualizer */}
                <div className="bg-[#121214] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        2. Tiến trình tự động hóa (Pipeline Controller)
                      </h2>
                      {activeJob && (
                        <p className="text-[10px] font-mono text-blue-400 mt-1">Đang cấu hình luồng: {activeJob.name}</p>
                      )}
                    </div>

                    {/* Điều khiển luồng */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {!isRunning ? (
                        <button 
                          type="button"
                          onClick={handleStartDubbing}
                          className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition text-xs uppercase tracking-wider"
                        >
                          <Play className="h-3.5 w-3.5 fill-white" />
                          START AUTOMATION
                        </button>
                      ) : (
                        <>
                          <button 
                            type="button"
                            onClick={handlePauseResume}
                            className="flex-1 sm:flex-none px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center justify-center gap-1.5 transition text-xs"
                          >
                            {isPaused ? <Play className="h-3.5 w-3.5 fill-slate-950" /> : <Pause className="h-3.5 w-3.5 fill-slate-950" />}
                            {isPaused ? "RESUME" : "PAUSE"}
                          </button>
                          <button 
                            type="button"
                            onClick={handleCancelDubbing}
                            className="flex-1 sm:flex-none px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition text-xs"
                          >
                            <Square className="h-3.5 w-3.5 fill-white" />
                            CANCEL
                          </button>
                        </>
                      )}
                      <button 
                        type="button"
                        onClick={handleReset}
                        className="p-2 bg-[#16161a] hover:bg-[#1e1e24] text-slate-400 rounded-lg border border-white/5 transition"
                        title="Reset"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tiến trình Pipeline */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Trạng thái máy ảo: {isRunning ? (isPaused ? "PAUSED_SAFE_CHECKPOINT" : "GPU_INFERENCE_RUNNING") : "SYSTEM_READY"}</span>
                      <span className="text-blue-400 font-bold">{overallProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111114] rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${overallProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-400" />
                        Thời gian hoàn tất ước tính (Est):
                      </span>
                      <span className="text-blue-400 font-bold">{estTimeRemaining}</span>
                    </div>
                  </div>

                  {/* Visualizer 10 bước */}
                  <div className="border border-white/5 rounded-xl overflow-hidden bg-[#111114]/40 p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                      {/* 5 bước đầu */}
                      <div className="p-1 space-y-1">
                        {PIPELINE_STEPS.slice(0, 5).map((step, idx) => {
                          const isPassed = overallProgress > ((step.num) / PIPELINE_STEPS.length) * 100;
                          const isCurrent = isRunning && currentStepIndex === idx;
                          return (
                            <div 
                              key={step.num}
                              className={`flex items-start gap-3 p-1.5 rounded-lg transition ${
                                isCurrent ? "bg-blue-500/5 border-l-2 border-blue-500" : "border-l-2 border-transparent"
                              }`}
                            >
                              <div className={`mt-0.5 h-4.5 w-4.5 shrink-0 rounded flex items-center justify-center text-[9px] font-bold ${
                                isPassed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" :
                                isCurrent ? "bg-blue-600 text-white" :
                                "bg-[#16161a] text-slate-600 border border-white/5"
                              }`}>
                                {isPassed ? <Check className="h-3 w-3 text-emerald-400" /> : step.num}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold ${isCurrent ? 'text-blue-400' : isPassed ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {step.title}
                                </p>
                                <p className="text-[9px] text-slate-500 truncate">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 5 bước sau */}
                      <div className="p-1 space-y-1">
                        {PIPELINE_STEPS.slice(5, 10).map((step, idx) => {
                          const realIdx = idx + 5;
                          const isPassed = overallProgress > ((step.num) / PIPELINE_STEPS.length) * 100;
                          const isCurrent = isRunning && currentStepIndex === realIdx;
                          return (
                            <div 
                              key={step.num}
                              className={`flex items-start gap-3 p-1.5 rounded-lg transition ${
                                isCurrent ? "bg-blue-500/5 border-l-2 border-blue-500" : "border-l-2 border-transparent"
                              }`}
                            >
                              <div className={`mt-0.5 h-4.5 w-4.5 shrink-0 rounded flex items-center justify-center text-[9px] font-bold ${
                                isPassed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" :
                                isCurrent ? "bg-blue-600 text-white" :
                                "bg-[#16161a] text-slate-600 border border-white/5"
                              }`}>
                                {isPassed ? <Check className="h-3 w-3 text-emerald-400" /> : step.num}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold ${isCurrent ? 'text-blue-400' : isPassed ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {step.title}
                                </p>
                                <p className="text-[9px] text-slate-500 truncate">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 4: Timestamps & Subtitle Manager */}
                <div className="bg-[#121214] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        3. Phân Đoạn Giọng Nói & Dịch Phụ Đề
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Chỉnh sửa lời dịch hoặc dịch nhanh trực tiếp bằng <span className="text-blue-400 font-bold">Gemini API thực tế</span>
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={handleTranslateWithGemini}
                      disabled={isTranslating}
                      className="px-3 py-1.5 bg-[#16161a] hover:bg-[#1e1e24] text-xs font-semibold rounded border border-white/5 text-blue-400 hover:text-blue-300 flex items-center gap-2.5 transition self-end sm:self-auto disabled:opacity-40"
                    >
                      <Languages className="h-3.5 w-3.5" />
                      {isTranslating ? "Calling Gemini SDK..." : "Dịch qua Gemini"}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {subtitles.map((sub) => (
                      <div key={sub.id} className="bg-black/40 p-3.5 rounded-xl border border-white/5 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-bold">SEGMENT #{sub.id}</span>
                            <span>[{sub.start} ➔ {sub.end}]</span>
                          </div>
                          <span className="px-2 py-0.5 bg-[#16161a] text-slate-400 border border-white/5 rounded text-[8px] font-bold">
                            {sub.speaker || "Speaker"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-[9px] uppercase font-bold text-slate-600">Phát âm gốc ({sourceLang}):</p>
                            <p className="text-xs text-slate-400 italic">{sub.originalText || sub.text}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[9px] uppercase font-bold text-blue-400 flex items-center gap-1">
                              Lời dịch Lồng tiếng ({targetLang}):
                              {sub.originalText && (
                                <span className="px-1 bg-blue-500/10 text-blue-400 text-[8px] rounded border border-blue-500/20">
                                  Gemini Translated
                                </span>
                              )}
                            </p>
                            <input 
                              type="text"
                              value={sub.text}
                              onChange={(e) => {
                                const newText = e.target.value;
                                setSubtitles(prev => prev.map(s => s.id === sub.id ? { ...s, text: newText } : s));
                              }}
                              className="w-full bg-[#111114] border border-white/5 focus:border-blue-500 rounded px-2 py-1 text-xs text-blue-300 focus:outline-none font-sans"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel 5: Logs */}
                <div className="bg-[#121214] rounded-xl border border-white/5 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-emerald-500" />
                      Nhật ký thực thi (Execution Terminal)
                    </h2>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">Localhost:3000 // stable</span>
                  </div>

                  <div 
                    ref={logContainerRef}
                    className="bg-black h-40 rounded-lg p-4 font-mono text-[10px] overflow-y-auto space-y-1 border border-white/5 text-slate-400"
                  >
                    {simLogs.length === 0 ? (
                      <p className="text-slate-600 italic">SYSTEM IDLE. CLICK "START AUTOMATION" TO INITIALIZE LOG BUFFER.</p>
                    ) : (
                      simLogs.map((log, idx) => {
                        let color = "text-slate-400";
                        if (log.includes("[SUCCESS]")) color = "text-emerald-400 font-medium";
                        if (log.includes("[WARNING]")) color = "text-amber-400 font-medium";
                        if (log.includes("[CUDA_RUNNER]")) color = "text-blue-400 font-bold";
                        return (
                          <div key={idx} className={`${color} leading-relaxed`}>
                            {log}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* CỘT PHẢI (XL: 5) */}
              <div className="xl:col-span-5 space-y-6">
                
                {/* Tab Control: Codebase vs Database */}
                <div className="bg-[#121214] rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-[560px]">
                  {/* Tab Headers */}
                  <div className="bg-[#111114] border-b border-white/5 px-4 pt-3 flex items-end justify-between shrink-0">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("cloner")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition ${
                          activeRightTab === "cloner" 
                            ? "border-purple-500 text-purple-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        🎙️ XTTS & F5 Cloner
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("exporter")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition ${
                          activeRightTab === "exporter" 
                            ? "border-amber-500 text-amber-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        🚀 CUDA & FFmpeg Export
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("mixer")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition ${
                          activeRightTab === "mixer" 
                            ? "border-blue-500 text-blue-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        🎛️ Audio Timeline & Mixer
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("code")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition ${
                          activeRightTab === "code" 
                            ? "border-blue-500 text-blue-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        📁 Python Source Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("database")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 ${
                          activeRightTab === "database" 
                            ? "border-emerald-500 text-emerald-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        🗄️ SQLite DB & Recovery
                        {hasCrashed && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("monitor")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 ${
                          activeRightTab === "monitor" 
                            ? "border-rose-500 text-rose-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        📊 QA & Diagnostics
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("lipsync")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 ${
                          activeRightTab === "lipsync" 
                            ? "border-cyan-500 text-cyan-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        👄 AI Lip-Sync
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("subtitles")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 ${
                          activeRightTab === "subtitles" 
                            ? "border-yellow-500 text-yellow-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        📝 Subtitles Burner
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("separation")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 ${
                          activeRightTab === "separation" 
                            ? "border-emerald-500 text-emerald-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        🎛️ AI Audio Separation
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("publisher")}
                        className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition flex items-center gap-1.5 ${
                          activeRightTab === "publisher" 
                            ? "border-indigo-500 text-indigo-400" 
                            : "border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        🚀 AI Publisher
                      </button>
                    </div>

                    <span className="text-[9px] uppercase text-slate-500 font-bold mb-2 font-mono">
                      {activeRightTab === "code" ? "Phase 1: Architecture" : activeRightTab === "database" ? "Phase 2: Database" : activeRightTab === "mixer" ? "Phase 3: Integration" : activeRightTab === "cloner" ? "Phase 5: Voice Cloning Lab" : activeRightTab === "monitor" ? "Phase 6: QA & Telemetry" : activeRightTab === "lipsync" ? "Phase 7: AI Lip-Sync & Restoration" : activeRightTab === "subtitles" ? "Phase 8: Subtitle Burner & Translation" : activeRightTab === "separation" ? "Phase 9: AI Audio Separation & Mixing" : activeRightTab === "publisher" ? "Phase 10: AI Multi-Language Publisher & Packager" : "Phase 4: CUDA & Export"}
                    </span>
                  </div>

                  {/* TAB 0: XTTS & F5 VOICE CLONING LAB */}
                  {activeRightTab === "cloner" && (
                    <div className="p-5 flex-1 flex flex-col space-y-6 overflow-y-auto max-h-[750px]">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Mic className="h-4 w-4 text-purple-400" />
                            Phòng Thí Nghiệm Nhân Bản Giọng Nói (Coqui XTTS v2 / F5-TTS)
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Sinh giọng đọc lồng tiếng tùy ý qua tham chiếu tệp mẫu 3s-10s hoàn toàn LOCAL trên NVIDIA GPU
                          </p>
                        </div>
                        <span className="text-[9px] bg-purple-950/40 text-purple-400 px-2.5 py-0.5 rounded border border-purple-500/20 font-bold font-mono uppercase tracking-wider">
                          CUDA Accelerated
                        </span>
                      </div>

                      {/* Main Workspace Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* LEFT COLUMN: SYNTHESIZER PLAYGROUND */}
                        <div className="lg:col-span-7 space-y-4">
                          <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-4.5 space-y-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                              Bộ Thử Nghiệm Sinh Giọng Nói (Synthesizer Sandbox)
                            </span>

                            {/* Model switch & settings */}
                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-slate-500">Mô hình AI TTS</label>
                                <select
                                  value={cloneModel}
                                  onChange={(e) => setCloneModel(e.target.value as any)}
                                  className="w-full bg-[#111114] border border-white/5 focus:border-purple-500 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                                >
                                  <option value="xtts_v2">XTTS v2 (Auto-Regressive + Diffusion)</option>
                                  <option value="f5_tts">F5-TTS (Flow Matching - Siêu nhanh)</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-slate-500">Giọng tham chiếu</label>
                                <select
                                  value={selectedVoiceRef}
                                  onChange={(e) => setSelectedVoiceRef(e.target.value)}
                                  className="w-full bg-[#111114] border border-white/5 focus:border-purple-500 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                                >
                                  {voiceRefList.map((voice) => (
                                    <option key={voice.id} value={voice.name}>
                                      {voice.name} ({voice.speaker})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Advanced parameters */}
                            <div className="grid grid-cols-2 gap-4 bg-[#111114]/40 p-3 rounded-lg border border-white/5">
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[9px]">
                                  <span className="uppercase font-bold text-slate-500">Temperature</span>
                                  <span className="font-mono text-purple-400 font-bold">{cloneTemperature}</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.3"
                                  max="1.2"
                                  step="0.05"
                                  value={cloneTemperature}
                                  onChange={(e) => setCloneTemperature(Number(e.target.value))}
                                  className="w-full accent-purple-500 h-1.5 bg-zinc-900 rounded-lg cursor-pointer"
                                />
                                <span className="text-[8px] text-slate-500 block leading-tight">
                                  Cao hơn = Cảm xúc nhiều hơn, thấp hơn = Ổn định
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[9px]">
                                  <span className="uppercase font-bold text-slate-500">Tốc độ (Speed)</span>
                                  <span className="font-mono text-purple-400 font-bold">{cloneSpeed}x</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.7"
                                  max="1.5"
                                  step="0.05"
                                  value={cloneSpeed}
                                  onChange={(e) => setCloneSpeed(Number(e.target.value))}
                                  className="w-full accent-purple-500 h-1.5 bg-zinc-900 rounded-lg cursor-pointer"
                                />
                                <span className="text-[8px] text-slate-500 block leading-tight">
                                  Tỷ lệ co dãn giọng đọc lồng tiếng trực tiếp
                                </span>
                              </div>
                            </div>

                            {/* Script text area */}
                            <div className="space-y-1">
                              <label className="text-[9px] uppercase font-bold text-slate-500">Văn bản lồng tiếng thử nghiệm</label>
                              <textarea
                                value={cloneText}
                                onChange={(e) => setCloneText(e.target.value)}
                                className="w-full bg-[#111114] border border-white/5 focus:border-purple-500 rounded p-2.5 text-xs text-slate-300 focus:outline-none font-sans h-20 resize-none leading-relaxed"
                                placeholder="Nhập văn bản cần sinh giọng lồng tiếng..."
                              />
                            </div>

                            {/* Action Button */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setIsCloning(true)}
                                disabled={isCloning || !cloneText}
                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider shadow-lg shadow-purple-950/20 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-40"
                              >
                                {isCloning ? (
                                  <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Đang suy diễn giọng đọc ({cloneProgress}%)
                                  </>
                                ) : (
                                  <>
                                    <Flame className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                                    Bắt đầu nhân bản & Sinh âm thanh
                                  </>
                                )}
                              </button>

                              {cloneCompleted && (
                                <button
                                  type="button"
                                  onClick={() => setClonedAudioPlaying(!clonedAudioPlaying)}
                                  className={`px-4 py-2.5 rounded-lg text-xs font-bold border transition flex items-center gap-2 ${
                                    clonedAudioPlaying
                                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                                      : "bg-zinc-900 border-white/5 text-slate-300 hover:text-white"
                                  }`}
                                >
                                  {clonedAudioPlaying ? (
                                    <>
                                      <Pause className="h-3.5 w-3.5" />
                                      Tạm dừng
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3.5 w-3.5" />
                                      Phát thử giọng sinh
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Waveform Animator */}
                            {(isCloning || cloneCompleted) && (
                              <div className="bg-[#111114] p-3 rounded-lg border border-white/5 flex items-center gap-3">
                                <div className="text-[9px] font-mono text-purple-400 w-12 shrink-0">
                                  {isCloning ? "SYNTH..." : "CLONED"}
                                </div>
                                <div className="flex-1 h-8 flex items-center justify-between gap-0.5 overflow-hidden">
                                  {Array.from({ length: 42 }).map((_, idx) => {
                                    let height = 3 + Math.sin(idx * 0.4) * 12 + Math.cos(idx * 0.1) * 8;
                                    if (isCloning) {
                                      height = Math.max(2, height * (0.2 + Math.random() * 0.8));
                                    } else if (!clonedAudioPlaying) {
                                      height = 2;
                                    } else {
                                      height = Math.max(3, height * (0.5 + Math.sin(Date.now() * 0.01 + idx) * 0.4));
                                    }
                                    return (
                                      <div
                                        key={idx}
                                        style={{ height: `${Math.max(2, Math.min(28, height))}px` }}
                                        className={`w-1 rounded-full transition-all duration-150 ${
                                          isCloning ? "bg-purple-600/50" : clonedAudioPlaying ? "bg-emerald-500" : "bg-purple-500/40"
                                        }`}
                                      />
                                    );
                                  })}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {isCloning ? "Generating" : clonedAudioPlaying ? "0:02 / 0:04" : "0:00 / 0:04"}
                                </span>
                              </div>
                            )}

                            {/* Cloning live logs */}
                            {cloneSpeechLogs.length > 0 && (
                              <div className="bg-black/80 rounded-lg p-3 border border-white/5 font-mono text-[9.5px] text-slate-400 h-28 overflow-y-auto space-y-1 leading-relaxed">
                                {cloneSpeechLogs.map((log, idx) => (
                                  <div key={idx} className={log.includes("[SUCCESS]") ? "text-emerald-400 font-semibold" : ""}>
                                    {log}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RIGHT COLUMN: SPEAKER DIARIZATION & REFERENCE MANAGER */}
                        <div className="lg:col-span-5 space-y-5">
                          {/* Reference Speaker List */}
                          <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-4 space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-purple-400" />
                                Thư Viện Giọng Đọc Mẫu (WAV Samples)
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">Count: {voiceRefList.length}</span>
                            </div>

                            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                              {voiceRefList.map((voice) => (
                                <div
                                  key={voice.id}
                                  onClick={() => setSelectedVoiceRef(voice.name)}
                                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                                    selectedVoiceRef === voice.name
                                      ? "bg-purple-950/15 border-purple-500/30 text-slate-200"
                                      : "bg-black/30 border-white/5 text-slate-400 hover:bg-black/50"
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-[11px] font-mono font-bold text-slate-200">{voice.name}</p>
                                      {voice.isSystem && (
                                        <span className="text-[8px] px-1 bg-zinc-800 text-slate-400 rounded">Preset</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium">Speaker: {voice.speaker}</p>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[8.5px] px-1.5 py-0.5 bg-purple-950/40 text-purple-400 rounded border border-purple-500/15 font-bold font-mono">
                                      {voice.quality}
                                    </span>
                                    <p className="text-[9px] text-slate-500 mt-0.5 font-mono">Dur: {voice.duration}</p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Drag Drop Mock Upload Interface */}
                            <div className="border border-dashed border-white/10 hover:border-purple-500/30 rounded-xl p-3 bg-black/20 text-center transition">
                              {isUploadingVoice ? (
                                <div className="py-2 space-y-1.5">
                                  <div className="w-full bg-zinc-900 rounded-full h-1 max-w-[120px] mx-auto overflow-hidden">
                                    <div style={{ width: `${uploadProgress}%` }} className="bg-purple-500 h-full transition-all duration-150" />
                                  </div>
                                  <p className="text-[9.5px] text-purple-400 font-mono">Đang tải tệp giọng lên ({uploadProgress}%)</p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 font-semibold">Tải lên giọng nói tham chiếu mới</p>
                                  <p className="text-[8.5px] text-slate-500 leading-normal">
                                    Hỗ trợ .WAV / .MP3 dung lượng dưới 10MB (Khuyên dùng giọng đơn thể có độ dài 3-10 giây)
                                  </p>
                                  <div className="flex justify-center gap-1.5 pt-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUploadVoiceSimulation("Obama_Dubbed_Ref.wav", "Barack Obama")}
                                      className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded text-[8.5px] text-slate-300 transition"
                                    >
                                      + Barack Obama
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUploadVoiceSimulation("Kylie_Jenner_Ref.wav", "Kylie Jenner")}
                                      className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded text-[8.5px] text-slate-300 transition"
                                    >
                                      + Kylie Jenner
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Diarization & Multi-speaker mapping */}
                          <div className="bg-zinc-950/60 border border-white/5 rounded-xl p-4 space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Sliders className="h-3.5 w-3.5 text-purple-400" />
                              Phân Vai Giọng Đọc Đa Kênh (Speaker Diarization Mapping)
                            </span>
                            <p className="text-[9px] text-slate-500 leading-normal">
                              Áp dụng gán giọng đọc mẫu đã huấn luyện tương ứng cho các Speaker phát hiện từ Faster-Whisper.
                            </p>

                            <div className="space-y-2 bg-[#111114]/55 p-2.5 rounded-lg border border-white/5">
                              {Object.keys(speakerMapping).map((spk) => (
                                <div key={spk} className="flex items-center justify-between gap-3 text-[10.5px]">
                                  <span className="font-mono font-bold text-slate-300">{spk}:</span>
                                  <select
                                    value={speakerMapping[spk]}
                                    onChange={(e) => {
                                      const mapped = e.target.value;
                                      setSpeakerMapping(prev => ({ ...prev, [spk]: mapped }));
                                      addLog(`Đã cập nhật cấu hình giọng đọc: ${spk} ➔ ${mapped}`, "INFO");
                                    }}
                                    className="bg-black border border-white/5 text-purple-400 text-[10px] focus:outline-none focus:border-purple-500 rounded px-2 py-0.5 max-w-[145px]"
                                  >
                                    {voiceRefList.map((v) => (
                                      <option key={v.id} value={v.name}>{v.name}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                addLog("Đã đồng bộ hóa thiết lập cấu hình giọng đọc đa kênh (Multi-Speaker Map) vào SQLite database thành công!", "SUCCESS");
                                setDbTranscripts(prev => prev.map(t => {
                                  const refVoiceName = speakerMapping[t.speaker] || "RTX_Cloned_Voice.wav";
                                  return { ...t, cache_wav: refVoiceName, cache_status: "SEGMENTED" };
                                }));
                              }}
                              className="w-full py-1.5 bg-[#111114] hover:bg-zinc-900 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition"
                            >
                              Lưu cấu hình phân vai vào SQLite DB
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Developer Blueprint: XTTS v2 vs F5-TTS */}
                      <div className="bg-gradient-to-r from-purple-950/10 to-[#121214] p-4.5 rounded-xl border border-purple-500/15 space-y-2">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">
                          Sổ Tay Thiết Kế & Nguyên Lý Công Nghệ (Voice Cloning Blueprint)
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9.5px] leading-relaxed text-slate-400">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-300">1. Coqui XTTS v2 (Auto-Regressive & Diffusion)</p>
                            <p>
                              Mô hình lai kết hợp sinh mã âm thanh tự hồi quy (GPT-style) và khôi phục tần số khuếch tán (Diffusion). 
                              Ưu điểm vượt trội ở biểu cảm giọng đọc cực cao, giữ nguyên ngữ điệu, hơi thở và hỗ trợ nhân bản xuyên ngôn ngữ (Cross-lingual cloning).
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-slate-300">2. F5-TTS (Flow Matching Engine)</p>
                            <p>
                              Mô hình sinh giọng nói tiên tiến sử dụng kỹ thuật Flow Matching loại bỏ hoàn toàn cấu trúc autoregressive phức tạp. 
                              Tốc độ suy luận đạt kỷ lục thời gian thực (RTF ~0.15 trên card RTX 40-series). Hoạt động cực kỳ ổn định.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 1: CODEBASE EXPLORER */}
                  {activeRightTab === "code" && (
                    <div className="p-5 flex-1 flex flex-col space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            Cấu Trúc Source Code Python (Giai đoạn 1)
                          </h2>
                          <span className="text-[9px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                            PHASE 1
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Nhấp vào tệp tin để xem trước mã nguồn hoàn chỉnh đã thiết kế cho Windows 11
                        </p>
                      </div>

                      {/* Cấu trúc hai bảng folder & code */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden min-h-[420px]">
                        
                        {/* Bảng folder bên trái */}
                        <div className="md:col-span-5 bg-black/40 rounded-xl p-3 border border-white/5 overflow-y-auto max-h-[220px] md:max-h-none">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                            Cấu trúc Thư mục:
                          </span>
                          {renderTree(folderStructure)}
                        </div>

                        {/* Bảng code bên phải */}
                        <div className="md:col-span-7 flex flex-col bg-black rounded-xl border border-white/5 overflow-hidden">
                          <div className="bg-[#111114] px-4 py-2 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <File className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <span className="text-[10px] font-mono text-slate-300 truncate">
                                {activeFile.name}
                              </span>
                            </div>

                            <button 
                              type="button"
                              onClick={() => copyToClipboard(activeFile.content)}
                              className="px-2 py-0.5 bg-[#16161a] text-slate-400 hover:text-white rounded border border-white/5 text-[9px] font-medium flex items-center gap-1"
                            >
                              {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                              {copied ? "Copied" : "Copy"}
                            </button>
                          </div>

                          <div className="bg-[#16161a]/60 px-4 py-2 border-b border-white/5 text-[10px] text-slate-400 italic">
                            {activeFile.description}
                          </div>

                          <div className="flex-1 overflow-auto p-4 font-mono text-[10px] leading-relaxed text-slate-300 max-h-[300px] md:max-h-none select-text">
                            <pre className="whitespace-pre">{activeFile.content}</pre>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* TAB 2: SQLITE DATABASE PLAYGROUND & RECOVERY */}
                  {activeRightTab === "database" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5">
                      {/* Checkpoint Banner / Alert banner if crashed */}
                      <AnimatePresence mode="wait">
                        {hasCrashed ? (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 space-y-3 shadow-md shadow-amber-950/20"
                          >
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                              <div className="space-y-1">
                                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                  Hệ Thống Treo - Lỗi GPU VRAM Out Of Memory
                                </h3>
                                <p className="text-[10.5px] text-slate-400 leading-relaxed">
                                  Lồng tiếng bằng <code className="text-amber-400">XTTS v2</code> bị sập dở dang tại Segment #3 do bộ nhớ VRAM 24GB của GPU quá tải. 
                                  Tuy nhiên, nhờ <span className="text-emerald-400 font-bold">CheckpointManager</span>, 2 segments đầu đã được lồng tiếng xong và lưu cache an toàn trong SQLite!
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 pt-1">
                              <button
                                type="button"
                                onClick={handleRecoverCheckpoint}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-[11px] uppercase tracking-wider shadow-lg shadow-emerald-950/30 flex items-center gap-2 transition active:scale-95"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Kích hoạt Checkpoint Recovery
                              </button>
                              <button
                                type="button"
                                onClick={handleReset}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[11px] transition"
                              >
                                Reset lại
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="bg-[#16161a] border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                Bộ giả lập tự phục hồi dở dang (OOM Crash Simulator)
                              </h4>
                              <p className="text-[10px] text-slate-500">
                                Bật tùy chọn này để mô phỏng lỗi sập GPU dở dang nhằm kiểm thử cơ chế phục hồi checkpoint.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-slate-400">
                                {simulateCrashOnStep6 ? "Đã bật giả lập lỗi" : "Tắt giả lập lỗi"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSimulateCrashOnStep6(!simulateCrashOnStep6)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                                  simulateCrashOnStep6 ? "bg-amber-500" : "bg-slate-700"
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                    simulateCrashOnStep6 ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        )}
                      </AnimatePresence>

                      {/* SQLite Tables Explorer */}
                      <div className="space-y-3 flex-1 flex flex-col">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDbTable("jobs")}
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition ${
                                dbTable === "jobs" 
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                                  : "text-slate-500 hover:text-slate-300"
                              }`}
                            >
                              Bảng: dubbing_jobs
                            </button>
                            <button
                              type="button"
                              onClick={() => setDbTable("transcripts")}
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition ${
                                dbTable === "transcripts" 
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                                  : "text-slate-500 hover:text-slate-300"
                              }`}
                            >
                              Bảng: transcripts
                            </button>
                            <button
                              type="button"
                              onClick={() => setDbTable("schema")}
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition ${
                                dbTable === "schema" 
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                                  : "text-slate-500 hover:text-slate-300"
                              }`}
                            >
                              Sơ đồ ER (Schema)
                            </button>
                          </div>

                          <span className="text-[9px] font-mono text-emerald-500/70 font-semibold uppercase">
                            SQLite Connection: Live
                          </span>
                        </div>

                        {/* TABLE: JOBS CONTENT */}
                        {dbTable === "jobs" && (
                          <div className="border border-white/5 rounded-xl overflow-x-auto bg-black/40">
                            <table className="w-full text-[10px] text-slate-300 font-mono text-left">
                              <thead>
                                <tr className="bg-[#111114] border-b border-white/5 text-slate-500 uppercase text-[9px] tracking-wider">
                                  <th className="p-2.5">id</th>
                                  <th className="p-2.5">video_name</th>
                                  <th className="p-2.5">status</th>
                                  <th className="p-2.5">progress</th>
                                  <th className="p-2.5">step</th>
                                  <th className="p-2.5">error_message</th>
                                  <th className="p-2.5">updated_at</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {dbJobs.map((job) => (
                                  <tr key={job.id} className="hover:bg-white/[0.02]">
                                    <td className="p-2.5 font-bold text-emerald-500">{job.id}</td>
                                    <td className="p-2.5 text-slate-200 max-w-[120px] truncate" title={job.video_name}>{job.video_name}</td>
                                    <td className="p-2.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                        job.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                        job.status === "PROCESSING" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse" :
                                        job.status === "FAILED" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                        "bg-slate-800 text-slate-400"
                                      }`}>
                                        {job.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-blue-400 font-bold">{job.progress}%</td>
                                    <td className="p-2.5 font-bold text-amber-500">{job.current_step}/10</td>
                                    <td className="p-2.5 text-rose-400 max-w-[100px] truncate" title={job.error_message || "None"}>
                                      {job.error_message || "NULL"}
                                    </td>
                                    <td className="p-2.5 text-[9px] text-slate-500">{job.updated_at}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* TABLE: TRANSCRIPTS CONTENT */}
                        {dbTable === "transcripts" && (
                          <div className="border border-white/5 rounded-xl overflow-y-auto bg-black/40 max-h-[280px]">
                            {dbTranscripts.length === 0 ? (
                              <div className="p-8 text-center text-slate-600 font-mono text-[10px] leading-relaxed">
                                TRANSCRIPTS DB EMPTY.<br />
                                Run Pipeline to Step 3 (Speech Recognition) to populate tables.
                              </div>
                            ) : (
                              <table className="w-full text-[10px] text-slate-300 font-mono text-left">
                                <thead className="sticky top-0 bg-[#111114] border-b border-white/5 text-slate-500 uppercase text-[9px]">
                                  <tr>
                                    <th className="p-2">id</th>
                                    <th className="p-2">job_id</th>
                                    <th className="p-2">start_time</th>
                                    <th className="p-2">end_time</th>
                                    <th className="p-2">original_text</th>
                                    <th className="p-2">translated_text</th>
                                    <th className="p-2">cache_status</th>
                                    <th className="p-2">cache_wav</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {dbTranscripts.map((row) => (
                                    <tr key={row.id} className="hover:bg-white/[0.02]">
                                      <td className="p-2 font-bold text-emerald-500">{row.id}</td>
                                      <td className="p-2 text-slate-500">{row.job_id}</td>
                                      <td className="p-2 text-slate-400">{row.start_time}</td>
                                      <td className="p-2 text-slate-400">{row.end_time}</td>
                                      <td className="p-2 text-slate-300 max-w-[100px] truncate" title={row.original_text}>{row.original_text}</td>
                                      <td className="p-2 text-blue-300 max-w-[100px] truncate" title={row.translated_text || "NULL"}>
                                        {row.translated_text || <span className="text-slate-600">NULL</span>}
                                      </td>
                                      <td className="p-2">
                                        <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                          row.cache_status === "CACHED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                          row.cache_status === "SEGMENTED" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                                          row.cache_status === "FAILED" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                          "bg-slate-800 text-slate-500"
                                        }`}>
                                          {row.cache_status}
                                        </span>
                                      </td>
                                      <td className="p-2 text-blue-400 font-semibold max-w-[80px] truncate" title={row.cache_wav || "NULL"}>
                                        {row.cache_wav || "NULL"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {/* DATABASE ER SCHEMA DIAGRAM */}
                        {dbTable === "schema" && (
                          <div className="border border-white/5 rounded-xl p-4 bg-black/60 space-y-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Sơ đồ quan hệ thực thể (SQLite ER Diagram)
                            </span>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center relative">
                              {/* Table dubbing_jobs */}
                              <div className="bg-[#111114] border border-blue-500/30 rounded-lg p-3 space-y-2 text-[10px] font-mono shadow-md">
                                <div className="bg-blue-600/10 px-2 py-1 border-b border-blue-500/20 rounded text-blue-400 font-bold flex justify-between">
                                  <span>[T] dubbing_jobs</span>
                                  <span className="text-xs">🔑 PK</span>
                                </div>
                                <ul className="space-y-1 text-slate-300">
                                  <li><span className="text-blue-400 font-bold">id</span> : INTEGER <span className="text-slate-500">(AutoInc)</span></li>
                                  <li><span>video_path</span> : TEXT</li>
                                  <li><span>video_name</span> : TEXT</li>
                                  <li><span>source_lang</span> : TEXT</li>
                                  <li><span>target_lang</span> : TEXT</li>
                                  <li><span>voice_clone_type</span> : TEXT</li>
                                  <li><span>status</span> : TEXT</li>
                                  <li><span>progress</span> : INTEGER</li>
                                  <li><span>current_step</span> : INTEGER</li>
                                  <li><span>error_message</span> : TEXT</li>
                                  <li><span>updated_at</span> : TIMESTAMP</li>
                                </ul>
                              </div>

                              {/* Table transcripts */}
                              <div className="bg-[#111114] border border-emerald-500/30 rounded-lg p-3 space-y-2 text-[10px] font-mono shadow-md">
                                <div className="bg-emerald-600/10 px-2 py-1 border-b border-emerald-500/20 rounded text-emerald-400 font-bold flex justify-between">
                                  <span>[T] transcripts</span>
                                  <span className="text-xs">🔑 PK / 🔗 FK</span>
                                </div>
                                <ul className="space-y-1 text-slate-300">
                                  <li><span className="text-emerald-400 font-bold">id</span> : INTEGER</li>
                                  <li><span className="text-blue-400">job_id</span> : INTEGER <span className="text-slate-500 font-bold">(🔗 FK)</span></li>
                                  <li><span>start_time</span> : REAL</li>
                                  <li><span>end_time</span> : REAL</li>
                                  <li><span>original_text</span> : TEXT</li>
                                  <li><span>translated_text</span> : TEXT</li>
                                  <li><span>audio_dur_ratio</span> : REAL</li>
                                </ul>
                              </div>

                              {/* Central Relation Dotted Arrow Representation */}
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center bg-zinc-950 border border-white/10 rounded-full w-8 h-8 font-mono text-[9px] text-amber-500 font-bold shadow-lg shadow-black">
                                1:N
                              </div>
                            </div>

                            <p className="text-[9px] text-slate-500 leading-normal font-sans pt-1">
                              * Khóa ngoại <code className="text-blue-400 font-bold">transcripts.job_id</code> liên kết đến <code className="text-blue-400 font-bold">dubbing_jobs.id</code> với điều kiện xóa lan tỏa (<code className="text-emerald-400">ON DELETE CASCADE</code>) giúp dọn dẹp sạch sẽ rác dữ liệu đệm khi dọn dẹp.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TIMELINE & MIXER */}
                  {activeRightTab === "mixer" && (
                    <div className="p-5 flex-1 flex flex-col space-y-6">
                      {/* Section 1: Audio Mixer (Tách Demucs) */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <Volume2 className="h-4 w-4 text-blue-500" />
                              Bộ trộn âm lượng (Facebook Demucs v4 Mixer)
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Điều chỉnh cường độ dB, Mute, Solo và giám sát sóng âm (VU Meter) của giọng đọc và nhạc nền
                            </p>
                          </div>
                          <span className="text-[9px] bg-blue-950/40 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold font-mono">
                            DEMUCS HTDEMUCS
                          </span>
                        </div>

                        {/* Mixer Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 bg-black/40 p-4 rounded-xl border border-white/5">
                          {/* Channel 1: AI Vocal */}
                          <div className="md:col-span-4 flex flex-col items-center p-3 bg-zinc-950/60 rounded-lg border border-white/5 space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                              <Mic className="h-3.5 w-3.5 text-blue-400" /> 🎤 AI VOCAL
                            </span>
                            
                            {/* Fader Track */}
                            <div className="h-36 flex items-center justify-between gap-4 w-full px-2">
                              {/* LED VU Meter */}
                              <div className="w-2.5 h-full bg-black/80 rounded-sm flex flex-col-reverse justify-start overflow-hidden p-0.5 gap-0.5">
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  const levelThreshold = ((idx + 1) / 12) * 100;
                                  const isActive = vuLevels[0] >= levelThreshold;
                                  let colorClass = "bg-slate-800";
                                  if (isActive) {
                                    if (idx < 7) colorClass = "bg-emerald-500 shadow-sm shadow-emerald-500/50";
                                    else if (idx < 10) colorClass = "bg-amber-500 shadow-sm shadow-amber-500/50";
                                    else colorClass = "bg-rose-500 shadow-sm shadow-rose-500/50";
                                  }
                                  return (
                                    <div key={idx} className={`w-full h-2 rounded-[1px] transition-all duration-75 ${colorClass}`} />
                                  );
                                })}
                              </div>

                              {/* Vertical Slider */}
                              <div className="flex-1 flex flex-col items-center relative h-full justify-center">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={vocalVolume}
                                  onChange={(e) => setVocalVolume(Number(e.target.value))}
                                  disabled={isVocalMuted}
                                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                                  className="h-28 w-6 accent-blue-500 bg-zinc-900 rounded-lg cursor-pointer disabled:opacity-30"
                                />
                              </div>
                            </div>

                            {/* Vol DB Info */}
                            <span className="text-[11px] font-mono font-bold text-blue-400">
                              {isVocalMuted ? "MUTED" : `${Math.round((vocalVolume / 100) * 12 - 12)} dB`}
                            </span>

                            {/* Solo / Mute Buttons */}
                            <div className="flex gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => setIsVocalMuted(!isVocalMuted)}
                                className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${
                                  isVocalMuted 
                                    ? "bg-rose-950/40 border-rose-500/30 text-rose-400" 
                                    : "bg-[#111114] border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                MUTE
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setVocalSolo(!vocalSolo);
                                  if (!vocalSolo) setMusicSolo(false);
                                }}
                                className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${
                                  vocalSolo 
                                    ? "bg-blue-950/40 border-blue-500/30 text-blue-400" 
                                    : "bg-[#111114] border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                SOLO
                              </button>
                            </div>
                          </div>

                          {/* Channel 2: Background Music (Demucs) */}
                          <div className="md:col-span-4 flex flex-col items-center p-3 bg-zinc-950/60 rounded-lg border border-white/5 space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                              <Music className="h-3.5 w-3.5 text-emerald-400" /> 🎵 DEMUCS BG
                            </span>
                            
                            {/* Fader Track */}
                            <div className="h-36 flex items-center justify-between gap-4 w-full px-2">
                              {/* LED VU Meter */}
                              <div className="w-2.5 h-full bg-black/80 rounded-sm flex flex-col-reverse justify-start overflow-hidden p-0.5 gap-0.5">
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  const levelThreshold = ((idx + 1) / 12) * 100;
                                  const isActive = vuLevels[1] >= levelThreshold;
                                  let colorClass = "bg-slate-800";
                                  if (isActive) {
                                    if (idx < 7) colorClass = "bg-emerald-500 shadow-sm shadow-emerald-500/50";
                                    else if (idx < 10) colorClass = "bg-amber-500 shadow-sm shadow-amber-500/50";
                                    else colorClass = "bg-rose-500 shadow-sm shadow-rose-500/50";
                                  }
                                  return (
                                    <div key={idx} className={`w-full h-2 rounded-[1px] transition-all duration-75 ${colorClass}`} />
                                  );
                                })}
                              </div>

                              {/* Vertical Slider */}
                              <div className="flex-1 flex flex-col items-center relative h-full justify-center">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={musicVolume}
                                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                                  disabled={isMusicMuted}
                                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                                  className="h-28 w-6 accent-emerald-500 bg-zinc-900 rounded-lg cursor-pointer disabled:opacity-30"
                                />
                              </div>
                            </div>

                            {/* Vol DB Info */}
                            <span className="text-[11px] font-mono font-bold text-emerald-400">
                              {isMusicMuted ? "MUTED" : `${Math.round((musicVolume / 100) * 12 - 12)} dB`}
                            </span>

                            {/* Solo / Mute Buttons */}
                            <div className="flex gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => setIsMusicMuted(!isMusicMuted)}
                                className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${
                                  isMusicMuted 
                                    ? "bg-rose-950/40 border-rose-500/30 text-rose-400" 
                                    : "bg-[#111114] border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                MUTE
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMusicSolo(!musicSolo);
                                  if (!musicSolo) setVocalSolo(false);
                                }}
                                className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${
                                  musicSolo 
                                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" 
                                    : "bg-[#111114] border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                SOLO
                              </button>
                            </div>
                          </div>

                          {/* Channel 3: Master */}
                          <div className="md:col-span-4 flex flex-col items-center p-3 bg-zinc-950/60 rounded-lg border border-white/5 space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                              <Volume2 className="h-3.5 w-3.5 text-purple-400" /> 🎛️ MASTER OUT
                            </span>
                            
                            {/* Fader Track */}
                            <div className="h-36 flex items-center justify-between gap-4 w-full px-2">
                              {/* LED VU Meter */}
                              <div className="w-2.5 h-full bg-black/80 rounded-sm flex flex-col-reverse justify-start overflow-hidden p-0.5 gap-0.5">
                                {Array.from({ length: 12 }).map((_, idx) => {
                                  const levelThreshold = ((idx + 1) / 12) * 100;
                                  const isActive = vuLevels[2] >= levelThreshold;
                                  let colorClass = "bg-slate-800";
                                  if (isActive) {
                                    if (idx < 7) colorClass = "bg-emerald-500 shadow-sm shadow-emerald-500/50";
                                    else if (idx < 10) colorClass = "bg-amber-500 shadow-sm shadow-amber-500/50";
                                    else colorClass = "bg-rose-500 shadow-sm shadow-rose-500/50";
                                  }
                                  return (
                                    <div key={idx} className={`w-full h-2 rounded-[1px] transition-all duration-75 ${colorClass}`} />
                                  );
                                })}
                              </div>

                              {/* Vertical Slider */}
                              <div className="flex-1 flex flex-col items-center relative h-full justify-center">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={masterVolume}
                                  onChange={(e) => setMasterVolume(Number(e.target.value))}
                                  disabled={isMasterMuted}
                                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                                  className="h-28 w-6 accent-purple-500 bg-zinc-900 rounded-lg cursor-pointer disabled:opacity-30"
                                />
                              </div>
                            </div>

                            {/* Vol DB Info */}
                            <span className="text-[11px] font-mono font-bold text-purple-400">
                              {isMasterMuted ? "MUTED" : `${Math.round((masterVolume / 100) * 12 - 12)} dB`}
                            </span>

                            {/* Solo / Mute Buttons */}
                            <div className="flex gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => setIsMasterMuted(!isMasterMuted)}
                                className={`w-full py-1 rounded text-[9px] font-bold border transition ${
                                  isMasterMuted 
                                    ? "bg-rose-950/40 border-rose-500/30 text-rose-400" 
                                    : "bg-[#111114] border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                {isMasterMuted ? "UNMUTE MASTER" : "MUTE MASTER"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Waveform Alignment & RubberBand Timeline */}
                      <div className="space-y-3 flex-1 flex flex-col">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <Activity className="h-4 w-4 text-emerald-500" />
                              Đồng bộ dòng thời gian (RubberBand Time Stretching)
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Cân chỉnh thời gian (offset) và kéo dãn pha tần số khớp với khẩu hình miệng nhân vật trong video
                            </p>
                          </div>
                        </div>

                        {/* Timeline list of segments */}
                        <div className="space-y-3.5 overflow-y-auto pr-1 max-h-[300px]">
                          {subtitles.map((sub) => {
                            const segId = sub.id;
                            const isThisPlaying = playingSegmentId === segId;
                            const currentOffset = segmentOffsets[segId] || 0;
                            
                            // Tạo dãn thời lượng giả lập dựa vào độ dài text lồng tiếng
                            let rawRatio = 1.0;
                            if (segId === 1) rawRatio = 0.95;
                            else if (segId === 2) rawRatio = 1.12;
                            else if (segId === 3) rawRatio = 1.05;
                            else if (segId === 4) rawRatio = 0.88;

                            return (
                              <div key={segId} className={`p-4 bg-black/40 rounded-xl border transition flex flex-col gap-3 ${
                                isThisPlaying ? "border-blue-500/40 bg-blue-950/5" : "border-white/5 hover:border-white/10"
                              }`}>
                                {/* Header segment */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono border-b border-white/5 pb-2">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-blue-400 font-bold">SEGMENT #{segId}</span>
                                    <span className="text-slate-500">[{sub.start} ➔ {sub.end}]</span>
                                  </div>

                                  <div className="flex items-center gap-3 text-[9px]">
                                    <span className="text-slate-500">Tỷ lệ co dãn:</span>
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                                      rawRatio > 1.05 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                      rawRatio < 0.95 ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                                      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    }`}>
                                      {rawRatio.toFixed(2)}x {rawRatio > 1.05 ? "Tăng tốc" : rawRatio < 0.95 ? "Giảm tốc" : "Chuẩn"}
                                    </span>
                                  </div>
                                </div>

                                {/* Main visual timeline with waveforms */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                                  {/* Waveform Visualization column */}
                                  <div className="lg:col-span-8 space-y-2">
                                    {/* Original Track */}
                                    <div className="flex items-center gap-3">
                                      <span className="w-16 text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono shrink-0">Original:</span>
                                      <div className="flex-1 bg-zinc-950 h-7 rounded relative overflow-hidden flex items-center justify-center border border-white/5">
                                        {/* Waveform bars */}
                                        <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2 opacity-35">
                                          {Array.from({ length: 42 }).map((_, bIdx) => {
                                            const val = Math.sin(bIdx * 0.3) * 10 + 12 + Math.random() * 6;
                                            return (
                                              <div key={bIdx} className="w-[1.5px] bg-slate-500 rounded-full" style={{ height: `${val}px` }} />
                                            );
                                          })}
                                        </div>
                                        <span className="absolute left-3 text-[8px] text-slate-600 font-mono font-bold">TRACK_ORIGINAL_CH0</span>
                                      </div>
                                    </div>

                                    {/* Dubbed Track stretched */}
                                    <div className="flex items-center gap-3">
                                      <span className="w-16 text-[8px] font-bold text-blue-400 uppercase tracking-wider font-mono shrink-0">AI Dub:</span>
                                      <div className="flex-1 bg-zinc-950 h-7 rounded relative overflow-hidden flex items-center justify-center border border-blue-500/10">
                                        {/* Waveform bars shifted/stretched based on offset */}
                                        <div 
                                          className="absolute inset-0 flex items-center justify-center gap-0.5 px-2 opacity-85 transition-transform duration-150"
                                          style={{ transform: `translateX(${currentOffset / 5}px)` }}
                                        >
                                          {Array.from({ length: 42 }).map((_, bIdx) => {
                                            const scaleFactor = rawRatio;
                                            const stretchIdx = Math.floor(bIdx / scaleFactor);
                                            const val = Math.sin(stretchIdx * 0.3) * 12 + 12 + Math.random() * 4;
                                            return (
                                              <div 
                                                key={bIdx} 
                                                className={`w-[1.5px] rounded-full transition-colors ${
                                                  isThisPlaying ? "bg-cyan-400" : "bg-blue-500"
                                                }`} 
                                                style={{ height: `${val}px` }} 
                                              />
                                            );
                                          })}
                                        </div>
                                        {isThisPlaying && (
                                          <div 
                                            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow shadow-cyan-400 transition-all duration-75"
                                            style={{ left: `${playbackProgress}%` }}
                                          />
                                        )}
                                        <span className="absolute left-3 text-[8px] text-blue-500 font-mono font-bold">RUBBERBAND_STRETCH_CH0</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Control Column */}
                                  <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col justify-between gap-3 bg-zinc-950/60 p-2.5 rounded-lg border border-white/5">
                                    {/* Shift Offset Control */}
                                    <div className="flex-1 flex flex-col justify-center space-y-1">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Lệch thời gian (Offset):</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSegmentOffsets(prev => ({ ...prev, [segId]: Math.max(-500, (prev[segId] || 0) - 10) }))}
                                          className="w-7 h-6 bg-zinc-900 hover:bg-zinc-850 text-slate-300 rounded font-bold text-xs flex items-center justify-center border border-white/5 active:scale-95"
                                        >
                                          -
                                        </button>
                                        <span className={`flex-1 text-center font-mono text-[10px] font-bold ${
                                          currentOffset > 0 ? "text-amber-400" : currentOffset < 0 ? "text-cyan-400" : "text-slate-400"
                                        }`}>
                                          {currentOffset > 0 ? `+${currentOffset}` : currentOffset} ms
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setSegmentOffsets(prev => ({ ...prev, [segId]: Math.min(500, (prev[segId] || 0) + 10) }))}
                                          className="w-7 h-6 bg-zinc-900 hover:bg-zinc-850 text-slate-300 rounded font-bold text-xs flex items-center justify-center border border-white/5 active:scale-95"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>

                                    {/* Playback Button Group */}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPlayingSegmentId(segId);
                                          setPlaybackType("original");
                                          setPlaybackProgress(0);
                                          addLog(`Khởi chạy nghe kiểm âm gốc Phân đoạn #${segId}`, "CUDA_RUNNER");
                                        }}
                                        disabled={isThisPlaying}
                                        className="flex-1 py-1 px-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition disabled:opacity-35"
                                      >
                                        <Play className="h-2.5 w-2.5" /> GỐC
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPlayingSegmentId(segId);
                                          setPlaybackType("dubbed");
                                          setPlaybackProgress(0);
                                          addLog(`Khởi chạy nghe kiểm giọng lồng tiếng RubberBand Phân đoạn #${segId}`, "CUDA_RUNNER");
                                        }}
                                        disabled={isThisPlaying}
                                        className="flex-1 py-1 px-2 bg-blue-900/40 hover:bg-blue-800/40 text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition disabled:opacity-35"
                                      >
                                        <Volume2 className="h-2.5 w-2.5" /> LỒNG TIẾNG
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer Phase 3 description banner */}
                      <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3.5 flex items-start gap-3">
                        <Sliders className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <h4 className="text-[10.5px] font-bold text-blue-300 uppercase tracking-wider">
                            Đồng bộ và Trộn âm thanh cục bộ (RubberBand & Demucs Sync)
                          </h4>
                          <p className="text-[9.5px] text-slate-400 leading-relaxed font-sans">
                            Khi biên dịch tự động, tiến trình sẽ kích hoạt <code className="text-emerald-400">RubberBand CLI</code> để co dãn tốc độ tệp âm thanh lồng tiếng AI sinh ra cho khớp với mốc gốc ban đầu. Sau đó, công cụ trộn âm sử dụng <code className="text-emerald-400">pydub</code> để kết hợp phần nhạc nền được bóc tách từ <code className="text-emerald-400">Demucs</code> và phần vocal lồng tiếng theo cường độ dã chọn (dB) và thời lượng trễ (Offset ms) trước khi xuất video hoàn chỉnh bằng FFmpeg.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRightTab === "exporter" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[calc(100vh-210px)]">
                      {/* Tiêu đề */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-amber-500" />
                            GPU CUDA & FFmpeg Assembly Studio (Giai đoạn 4)
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Cấu hình tăng tốc phần cứng NVIDIA GPU RTX và quản lý chu trình đóng gói Video bằng FFmpeg NVENC
                          </p>
                        </div>
                        <span className="text-[9px] bg-amber-950/40 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase tracking-wider font-mono">
                          Phase 4
                        </span>
                      </div>

                      {/* Config Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cấu hình tăng tốc CUDA */}
                        <div className="bg-[#18181b]/50 p-3.5 rounded-xl border border-white/5 space-y-3.5">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                            <Sliders className="h-3.5 w-3.5 text-amber-400" />
                            <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">Cấu hình Tăng tốc GPU CUDA</h4>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-400">Chọn Thiết bị GPU:</label>
                              <select
                                value={gpuDeviceId}
                                onChange={(e) => setGpuDeviceId(e.target.value)}
                                className="bg-[#111114] border border-white/5 focus:border-amber-500 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none font-mono"
                              >
                                <option value="cuda:0">CUDA:0 (RTX 4090 24GB)</option>
                                <option value="cuda:1">CUDA:1 (RTX 3080 10GB)</option>
                              </select>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                  FP16 Half-Precision
                                  <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded">Fast</span>
                                </label>
                                <p className="text-[9px] text-slate-500">Mã hóa nhanh hơn 2.5 lần, tiết kiệm 40% VRAM</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={cudaFp16}
                                onChange={(e) => setCudaFp16(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 accent-amber-500 bg-[#111114] border-white/5 rounded focus:ring-0 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                  Flash Attention v2
                                  <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded">Low Memory</span>
                                </label>
                                <p className="text-[9px] text-slate-500">Tự tối ưu hóa bộ nhớ chú ý khi chạy Whisper/TTS</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={cudaFlashAttr}
                                onChange={(e) => setCudaFlashAttr(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 accent-amber-500 bg-[#111114] border-white/5 rounded focus:ring-0 cursor-pointer"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between">
                                <label className="text-[10px] text-slate-400">Số luồng xử lý đồng thời (Batch Size):</label>
                                <span className="text-[10px] text-amber-400 font-mono font-bold">{cudaBatchSize} Videos</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="4"
                                value={cudaBatchSize}
                                onChange={(e) => setCudaBatchSize(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-amber-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Cấu hình FFmpeg Assembly */}
                        <div className="bg-[#18181b]/50 p-3.5 rounded-xl border border-white/5 space-y-3.5">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                            <Terminal className="h-3.5 w-3.5 text-amber-400" />
                            <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider">Thông số Đóng gói FFmpeg</h4>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-400">Codec Hình ảnh (Video Codec):</label>
                              <select
                                value={videoCodec}
                                onChange={(e) => setVideoCodec(e.target.value)}
                                className="bg-[#111114] border border-white/5 focus:border-amber-500 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none"
                              >
                                <option value="h264_nvenc">H.264 NVENC (GPU Nhanh)</option>
                                <option value="hevc_nvenc">H.265/HEVC NVENC (GPU Nén Cao)</option>
                                <option value="libx264">libx264 (CPU - Chất lượng Gốc)</option>
                              </select>
                            </div>

                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-400">Độ phân giải Subtitles (SRT):</label>
                              <select
                                value={subtitleMux}
                                onChange={(e) => setSubtitleMux(e.target.value)}
                                className="bg-[#111114] border border-white/5 focus:border-amber-500 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none"
                              >
                                <option value="hardburn">Vẽ cứng trực tiếp (Hardburn)</option>
                                <option value="soft">Muxing mềm SRT rời (Soft Track)</option>
                                <option value="none">Không đính kèm phụ đề</option>
                              </select>
                            </div>

                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-400">AAC Audio Bitrate:</label>
                              <select
                                value={audioBitrate}
                                onChange={(e) => setAudioBitrate(parseInt(e.target.value))}
                                className="bg-[#111114] border border-white/5 focus:border-amber-500 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none font-mono"
                              >
                                <option value="128">128 kbps (Standard)</option>
                                <option value="192">192 kbps (High Quality)</option>
                                <option value="256">256 kbps (Studio Master)</option>
                                <option value="320">320 kbps (Extreme Hi-Fi)</option>
                              </select>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-[10px] text-slate-400 font-semibold">Chuẩn hóa Âm lượng -14.0 LUFS</label>
                                <p className="text-[9px] text-slate-500">Khớp chuẩn của các nền tảng YouTube, TikTok</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={normalizeLufs}
                                onChange={(e) => setNormalizeLufs(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-500 accent-amber-500 bg-[#111114] border-white/5 rounded focus:ring-0 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CUDA Live VRAM Footprint Allocator */}
                      <div className="bg-zinc-950 p-4 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">CUDA Real-Time VRAM Profiler</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              addLog("Kích hoạt dọn dẹp empty_cache() và giải phóng phân mảnh CUDA VRAM...", "WARNING");
                              const before = (cudaFp16 ? 6.7 : 10.1);
                              const after = (cudaFp16 ? 4.1 : 6.8);
                              addLog(`Dọn dẹp thành công. Đã thu hồi ${Math.round((before - after) * 10) / 10} GB VRAM khỏi cache PyTorch.`, "SUCCESS");
                            }}
                            className="text-[9px] bg-zinc-900 border border-white/10 text-amber-400 hover:bg-zinc-800 hover:text-amber-300 px-2 py-1 rounded transition font-mono uppercase font-bold"
                          >
                            🧹 torch.cuda.empty_cache()
                          </button>
                        </div>

                        {/* VRAM Bar visualization */}
                        <div className="space-y-2">
                          <div className="h-6 bg-[#111114] border border-white/5 rounded-md overflow-hidden flex font-mono text-[9px] text-white font-bold">
                            {/* Segment 1: Whisper */}
                            <div 
                              className="bg-blue-600 border-r border-black/20 flex items-center justify-center transition-all duration-300"
                              style={{ width: cudaFp16 ? "25%" : "40%" }}
                            >
                              <span>Whisper ({cudaFp16 ? "2.8" : "4.8"}G)</span>
                            </div>
                            {/* Segment 2: XTTS */}
                            <div 
                              className="bg-purple-600 border-r border-black/20 flex items-center justify-center transition-all duration-300"
                              style={{ width: cudaFp16 ? "15%" : "28%" }}
                            >
                              <span>XTTS ({cudaFp16 ? "1.8" : "3.2"}G)</span>
                            </div>
                            {/* Segment 3: Demucs */}
                            <div 
                              className="bg-blue-500 border-r border-black/20 flex items-center justify-center transition-all duration-300"
                              style={{ width: "18%" }}
                            >
                              <span>Demucs (2.1G)</span>
                            </div>
                            {/* Segment 4: System Overheads */}
                            <div 
                              className="bg-zinc-800 flex items-center justify-center transition-all duration-300"
                              style={{ width: "12%" }}
                            >
                              <span>OS (1.2G)</span>
                            </div>
                            {/* Empty Space */}
                            <div className="bg-[#111114] flex-1 flex items-center justify-end pr-2 text-slate-500 font-normal">
                              <span>Free: {cudaFp16 ? "4.1G" : "0.7G"}</span>
                            </div>
                          </div>

                          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                            <span>VRAM Đang nạp: {cudaFp16 ? "7.9 GB / 12.0 GB" : "11.3 GB / 12.0 GB"}</span>
                            <span>Trạng thái: {cudaFp16 ? "🟢 An toàn (Đỉnh tải tối ưu)" : "🔴 Cảnh báo VRAM cao (Dễ lỗi GPU OOM)"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Exporter Action & Terminal */}
                      <div className="bg-[#151518]/60 p-4 rounded-xl border border-white/5 space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Trình kết xuất Video hoàn chỉnh (FFmpeg Suite)</h4>
                            <p className="text-[10px] text-slate-400">Phối hợp ghép âm thanh vocal lồng tiếng, nhạc nền bóc tách từ Demucs và video gốc.</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsExporting(true);
                              addLog("Đang khởi tạo pipeline đóng gói FFmpeg...", "INFO");
                            }}
                            disabled={isExporting}
                            className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                              isExporting 
                                ? "bg-zinc-800 text-slate-500 cursor-not-allowed" 
                                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black shadow-lg shadow-amber-500/10 active:scale-95 font-bold"
                            }`}
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            {isExporting ? "Đang mã hóa..." : "Bắt đầu xuất Video lồng tiếng"}
                          </button>
                        </div>

                        {/* Rendering Progress */}
                        {isExporting && (
                          <div className="space-y-2 bg-[#111114] p-3 rounded-lg border border-white/5">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-amber-400 font-bold flex items-center gap-1">
                                <span className="h-1.5 w-1.5 bg-amber-400 rounded-full animate-ping" />
                                Đang xử lý đóng gói FFmpeg...
                              </span>
                              <span className="text-slate-400">{exportProgress}%</span>
                            </div>
                            <div className="h-2 bg-black rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                                style={{ width: `${exportProgress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                              <span>Mã hóa phần cứng: 158 fps (nvenc)</span>
                              <span>Tốc độ: 5.3x Realtime</span>
                            </div>
                          </div>
                        )}

                        {exportCompleted && (
                          <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-lg flex items-start gap-3">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                              <h5 className="text-[10.5px] font-bold text-emerald-400 uppercase tracking-wide font-sans">Xuất bản video thành công!</h5>
                              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                                Tệp video lồng tiếng <code className="text-white">AI_Revolution_2026_dubbed.mp4</code> đã được xuất bản hoàn tất thông qua mã hóa tăng tốc phần cứng <code className="text-amber-400">NVENC</code> tại <code className="text-emerald-400">C:/local_dubber/outputs/</code>.
                              </p>
                              <div className="flex flex-wrap gap-4 pt-1 text-[9.5px] font-mono text-slate-400">
                                <span>Format: MP4 (H.264 / AAC)</span>
                                <span>Size: 42.1 MB (Nén tối ưu -40% VRAM FP16)</span>
                                <span>Audio Track: Dual Mixed Channel (LUFS Normalized)</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Export stdout Terminal */}
                        {exportLogs.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Luồng Đầu Ra FFmpeg (stdout):</span>
                              <span className="text-[8px] font-mono text-slate-600">process_id: 14240</span>
                            </div>
                            <div className="bg-black/85 rounded-lg p-3 font-mono text-[9.5px] text-zinc-400 space-y-1 max-h-32 overflow-y-auto border border-white/5 scrollbar-thin">
                              {exportLogs.map((log, lIdx) => (
                                <p key={lIdx} className={`${log.includes("[SUCCESS]") ? "text-emerald-400" : log.includes("[INFO]") ? "text-slate-400" : "text-zinc-500"}`}>
                                  {log}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeRightTab === "monitor" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[calc(100vh-210px)]">
                      {/* Title */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-rose-500" />
                            Phòng Kiểm Định Chất Lượng & Chẩn Đoán Hệ Thống (Phase 6)
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Giám sát tài nguyên phần cứng local, kiểm tra tương thích CUDA SDK, và tinh chỉnh chất lượng âm học video (QA Calibration)
                          </p>
                        </div>
                        <span className="text-[9px] bg-rose-950/40 text-rose-400 px-2.5 py-0.5 rounded border border-rose-500/20 font-bold font-mono uppercase tracking-wider">
                          Phase 6: QA Studio
                        </span>
                      </div>

                      {/* Sub-tab selection */}
                      <div className="flex gap-2 border-b border-white/5 pb-2">
                        <button
                          type="button"
                          onClick={() => setActiveTabDiagnostics("diagnostics")}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase transition ${
                            activeTabDiagnostics === "diagnostics"
                              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                              : "bg-transparent text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🔍 Chẩn Đoán Hệ Thống
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabDiagnostics("stress")}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase transition ${
                            activeTabDiagnostics === "stress"
                              ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                              : "bg-transparent text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🔥 Stress Test GPU / VRAM
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabDiagnostics("qa_calibration")}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wide uppercase transition ${
                            activeTabDiagnostics === "qa_calibration"
                              ? "bg-purple-500/10 border border-purple-500/30 text-purple-400"
                              : "bg-transparent text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🎛️ Cân Chỉnh Trễ Âm (QA Sync)
                        </button>
                      </div>

                      {/* Sub-tab 1: System Diagnostics */}
                      {activeTabDiagnostics === "diagnostics" && (
                        <div className="space-y-4 flex-1">
                          <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">Bộ Chẩn Đoán CUDA & SDK Environment Auditor</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAuditing(true);
                                  setDiagnosticsLogs([]);
                                  setAuditCompleted(false);
                                  addLog("Bắt đầu tiến hành kiểm chuẩn hệ thống phần cứng local...", "INFO");
                                  
                                  const logs = [
                                    "Khởi tạo tiến trình quét thiết bị phần cứng...",
                                    "Phát hiện Hệ điều hành: Windows 11 Home 24H2 (64-bit)",
                                    "Kiểm tra thư viện PyTorch CUDA binding... [OK]",
                                    "Xác định CUDA Toolkit Version: 12.1.105 | cuDNN: 8.9.7",
                                    "Quét thiết bị đồ họa GPU: NVIDIA GeForce RTX 4090 24GB VRAM (Device index: 0)",
                                    "Đo lường độ trễ IO trên thư mục tạm C:/local_dubber/temp...",
                                    "Đã hoàn thành ghi file mẫu performance_test.tmp dung lượng 50MB...",
                                    "Tốc độ đọc đĩa: 2150 MB/s | Tốc độ ghi đĩa: 1840 MB/s",
                                    "Kiểm tra biến môi trường PATH: ffmpeg.exe [OK], rubberband.exe [OK]",
                                    "Database SQLite Connection Check: OK (local_dubber/database.db)",
                                    "[SUCCESS] Hệ thống sẵn sàng hoàn tất. Đạt chuẩn xử lý Real-time AI Dubbing."
                                  ];

                                  let currentLogIdx = 0;
                                  const intv = setInterval(() => {
                                    if (currentLogIdx < logs.length) {
                                      setDiagnosticsLogs(prev => [...prev, logs[currentLogIdx]]);
                                      currentLogIdx++;
                                    } else {
                                      clearInterval(intv);
                                      setIsAuditing(false);
                                      setAuditCompleted(true);
                                      setIoLatencyScore(0.08 + Math.random() * 0.05);
                                      addLog("Đã chẩn đoán xong môi trường SDK. Hệ thống hoạt động hoàn hảo!", "SUCCESS");
                                    }
                                  }, 300);
                                }}
                                disabled={isAuditing}
                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition ${
                                  isAuditing
                                    ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                                    : "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10 active:scale-95"
                                }`}
                              >
                                {isAuditing ? "Đang quét..." : "Chạy chẩn đoán (Run Audit)"}
                              </button>
                            </div>

                            {/* Verification logs output */}
                            <div className="bg-black/90 border border-white/5 rounded-lg p-3.5 font-mono text-[10px] text-zinc-400 space-y-1.5 h-44 overflow-y-auto scrollbar-thin">
                              {diagnosticsLogs.length === 0 ? (
                                <p className="text-zinc-600 italic">NHẤN "CHẠY CHẨN ĐOÁN" ĐỂ QUÉT PHẦN CỨNG THỰC TẾ & KHẢO SÁT SDK PATHS</p>
                              ) : (
                                diagnosticsLogs.map((log, lidx) => (
                                  <p key={lidx} className={log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" : log.includes("OK") ? "text-blue-400" : "text-zinc-400"}>
                                    ➔ {log}
                                  </p>
                                ))
                              )}
                            </div>

                            {/* Auditor Scorecard */}
                            {auditCompleted && (
                              <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in">
                                <div className="bg-[#111114] border border-white/5 p-2.5 rounded-lg">
                                  <span className="text-[9px] text-slate-500 font-mono">ĐỘ TRỄ DISK I/O TEMP:</span>
                                  <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                                    {(ioLatencyScore * 1000).toFixed(0)} ms / 50MB (NVMe SSD)
                                  </p>
                                </div>
                                <div className="bg-[#111114] border border-white/5 p-2.5 rounded-lg">
                                  <span className="text-[9px] text-slate-500 font-mono">XẾP HẠNG PHẦN CỨNG:</span>
                                  <p className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                                    🌟 STUDIO MASTER (CUDA READY)
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Environmental checklists */}
                          <div className="bg-[#18181b]/30 border border-white/5 rounded-xl p-4 space-y-3">
                            <h5 className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-rose-500" /> Checklist Môi Trường Hệ Thống local_dubber
                            </h5>

                            <div className="space-y-2 text-[10px]">
                              <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                <span className="text-slate-400">Trọng số Mô hình Faster-Whisper Large-v3</span>
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">ĐÃ CACHE (C:/local_dubber/models)</span>
                              </div>
                              <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                <span className="text-slate-400">Trọng số Mô hình XTTS v2 / F5-TTS</span>
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">ĐÃ CACHE (C:/local_dubber/models)</span>
                              </div>
                              <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                <span className="text-slate-400">Công cụ co dãn âm thanh RubberBand CLI</span>
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">PATH OK (rubberband)</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Mã hóa nén hình ảnh NVIDIA NVENC SDK</span>
                                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">SẴN SÀNG (Driver v551.86+)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 2: Stress Testing & VRAM Logger */}
                      {activeTabDiagnostics === "stress" && (
                        <div className="space-y-4 flex-1">
                          <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                              <div className="space-y-0.5">
                                <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">CUDA VRAM Peak Load stress_test()</h4>
                                <p className="text-[9px] text-slate-500">Kích hoạt đỉnh tải giả lập bóc tách Demucs kết hợp nhân bản XTTS để kiểm định giới hạn bộ nhớ tránh sập nguồn.</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setIsStressTesting(true);
                                  setStressProgress(0);
                                  addLog("Khởi động GPU CUDA Stress Test (Whisper + XTTS + Demucs)...", "WARNING");
                                  
                                  let currentProg = 0;
                                  const intv = setInterval(() => {
                                    if (currentProg < 100) {
                                      currentProg += 10;
                                      setStressProgress(currentProg);
                                      
                                      // Thêm dữ liệu giả lập vào biểu đồ
                                      setStressVramHistory(prev => {
                                        const nextVal = parseFloat((6.0 + Math.random() * 5.5).toFixed(1));
                                        return [...prev.slice(1), nextVal];
                                      });
                                      setStressLoadHistory(prev => {
                                        const nextVal = Math.floor(65 + Math.random() * 30);
                                        return [...prev.slice(1), nextVal];
                                      });
                                    } else {
                                      clearInterval(intv);
                                      setIsStressTesting(false);
                                      addLog("Stress test hoàn thành. Đỉnh tải VRAM đạt 11.5GB, hệ thống duy trì ổn định!", "SUCCESS");
                                    }
                                  }, 500);
                                }}
                                disabled={isStressTesting}
                                className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                                  isStressTesting
                                    ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                                    : "bg-[#f97316] hover:bg-[#ea580c] text-black shadow-md shadow-orange-500/10 active:scale-95"
                                }`}
                              >
                                {isStressTesting ? "Đang Stress Test..." : "Bắt đầu Stress Test"}
                              </button>
                            </div>

                            {/* Live Stress Progress */}
                            {isStressTesting && (
                              <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between text-[9px] font-mono">
                                  <span className="text-orange-400 font-bold flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 bg-orange-400 rounded-full animate-ping" />
                                    TEST TIẾN TRÌNH: Đang chạy mô phỏng bóc tách & tổng hợp AI...
                                  </span>
                                  <span>{stressProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                                    style={{ width: `${stressProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* SVG Performance Line Chart */}
                            <div className="space-y-2">
                              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Lịch sử VRAM GPU suy luận (VRAM Peak Chart):</span>
                              <div className="h-32 bg-black/70 border border-white/5 rounded-lg relative overflow-hidden p-2 flex items-end justify-between">
                                {/* Chart grid lines */}
                                <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-10">
                                  <div className="border-b border-white w-full h-px" />
                                  <div className="border-b border-white w-full h-px" />
                                  <div className="border-b border-white w-full h-px" />
                                </div>

                                {/* Peaks visualization */}
                                <div className="absolute top-2 left-2 text-[8px] font-mono text-orange-400">
                                  Max Peak: {Math.max(...stressVramHistory).toFixed(1)} GB
                                </div>

                                {/* Graph Bars/Lines rendered elegantly */}
                                <div className="flex items-end justify-between w-full h-full pt-6 px-4 z-10 gap-3">
                                  {stressVramHistory.map((val, idx) => {
                                    const heightPct = (val / 16) * 100;
                                    return (
                                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                        <div 
                                          className="w-full bg-gradient-to-t from-orange-500/20 to-orange-500 rounded-t-sm transition-all duration-500 relative group"
                                          style={{ height: `${heightPct}%`, minHeight: "4px" }}
                                        >
                                          {/* Tooltip */}
                                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 text-white font-mono text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                                            {val.toFixed(1)} GB
                                          </div>
                                        </div>
                                        <span className="text-[8px] font-mono text-zinc-500">T-{7 - idx}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 3: QA Calibration (Audio latency & Delay matching) */}
                      {activeTabDiagnostics === "qa_calibration" && (
                        <div className="space-y-4 flex-1">
                          <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-4">
                            <div className="border-b border-white/5 pb-3">
                              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                                <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                                Audio Alignment Calibration Suite
                              </h4>
                              <p className="text-[9.5px] text-slate-500 mt-1">
                                Tinh chỉnh đồng bộ mốc thời gian phụ đề dịch và âm thanh tổng hợp. Nếu giọng lồng tiếng của F5-TTS hoặc XTTS bị chậm pha so với khẩu hình của video, sử dụng bộ kiểm định này để bù trễ (ms).
                              </p>
                            </div>

                            {/* Delay control slider */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Trễ điều phối tổng hợp (Audio Latency Offset):</label>
                                <span className={`text-[10.5px] font-mono font-bold ${qaAudioDelay === 0 ? "text-emerald-400" : qaAudioDelay > 0 ? "text-amber-400" : "text-cyan-400"}`}>
                                  {qaAudioDelay === 0 ? "0 ms (ĐỒNG BỘ CHUẨN)" : `${qaAudioDelay > 0 ? "+" : ""}${qaAudioDelay} ms`}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-[9px] text-zinc-500 font-mono">-500 ms</span>
                                <input
                                  type="range"
                                  min="-500"
                                  max="500"
                                  step="10"
                                  value={qaAudioDelay}
                                  onChange={(e) => {
                                    setQaAudioDelay(parseInt(e.target.value));
                                  }}
                                  className="flex-1 h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <span className="text-[9px] text-zinc-500 font-mono">+500 ms</span>
                              </div>

                              <div className="flex justify-between items-center">
                                <button
                                  type="button"
                                  onClick={() => setQaAudioDelay(0)}
                                  className="text-[9px] text-slate-400 hover:text-white transition font-mono border border-white/5 px-2 py-0.5 rounded bg-zinc-950/40"
                                >
                                  Đặt lại (Reset to 0)
                                </button>
                                <p className="text-[8.5px] text-zinc-500 font-mono">Thay đổi offset sẽ cập nhật tệp tin nạp âm của FFmpeg.</p>
                              </div>
                            </div>

                            {/* Visual Oscilloscope wave check */}
                            <div className="bg-[#111114]/80 rounded-lg p-3 border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] uppercase font-bold text-slate-500 font-mono tracking-wide">Bộ Kiểm Soát Pha Sóng Âm (Phases Monitor):</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQaWaveActive(!qaWaveActive);
                                    if (!qaWaveActive) {
                                      addLog("Kích hoạt máy quét dao động sóng âm kiểm định QA...", "INFO");
                                    }
                                  }}
                                  className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono uppercase transition border ${
                                    qaWaveActive 
                                      ? "bg-purple-500/15 border-purple-500/30 text-purple-400" 
                                      : "bg-zinc-900 border-white/5 text-slate-400 hover:text-slate-300"
                                  }`}
                                >
                                  {qaWaveActive ? "⏹️ Tắt Sóng" : "▶️ Chạy Thử Sóng"}
                                </button>
                              </div>

                              {/* Wave animation */}
                              <div className="h-16 bg-black rounded-md flex items-center justify-center overflow-hidden relative">
                                {qaWaveActive ? (
                                  <div className="flex items-end justify-center gap-1.5 h-full w-full py-2 px-10">
                                    {Array.from({ length: 24 }).map((_, idx) => {
                                      const randHeight = 20 + Math.sin(idx * 0.4 + (qaAudioDelay / 100)) * 40 + Math.random() * 20;
                                      return (
                                        <div 
                                          key={idx} 
                                          className="flex-1 bg-purple-500 rounded-full animate-pulse transition-all duration-300"
                                          style={{ 
                                            height: `${Math.max(10, Math.min(100, randHeight))}%`,
                                            animationDelay: `${idx * 40}ms`
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="w-full h-px bg-zinc-800 relative">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-mono text-zinc-600 uppercase tracking-widest bg-black px-3 font-bold">
                                      Signal Audio Offline
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Proximity notice */}
                          <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3.5 flex items-start gap-3">
                            <Sliders className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                              <h4 className="text-[10.5px] font-bold text-purple-300 uppercase tracking-wider">
                                Khảo sát đồng bộ thời gian (Micro-timing sync)
                              </h4>
                              <p className="text-[9.5px] text-slate-400 leading-relaxed font-sans">
                                Độ trễ mặc định của XTTS v2 dao động trong khoảng <code className="text-purple-400">80ms - 150ms</code> do xử lý mã hóa đặc trưng Speaker Embedding. Bằng việc áp dụng bù trễ trực tiếp trong <code className="text-purple-400">utils/diagnostics_tool.py</code>, bạn sẽ đạt độ chuẩn xác hoàn mỹ và chuyên nghiệp, giúp video lồng tiếng trôi chảy tự nhiên không bị giật lag khẩu hình.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeRightTab === "lipsync" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[calc(100vh-210px)]">
                      {/* Title */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Smile className="h-4 w-4 text-cyan-500 animate-pulse" />
                            Phòng Thí Nghiệm Khớp Hình Môi AI & Hậu Kỳ (Phase 7)
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Sử dụng mô hình Wav2Lip để đồng bộ khẩu hình môi với giọng nói lồng tiếng và phục hồi độ nét khuôn mặt (GFPGAN)
                          </p>
                        </div>
                        <span className="text-[9px] bg-cyan-950/40 text-cyan-400 px-2.5 py-0.5 rounded border border-cyan-500/20 font-bold font-mono uppercase tracking-wider">
                          Wav2Lip + GFPGAN
                        </span>
                      </div>

                      {/* Main Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Control settings */}
                        <div className="md:col-span-5 space-y-4">
                          <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                            <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                              <Settings className="h-3.5 w-3.5 text-cyan-400" />
                              Cấu Hình Mô Hình Khớp Hình
                            </h4>

                            <div className="space-y-3 text-[10px]">
                              {/* Lip sync model select */}
                              <div className="space-y-1.5">
                                <label className="text-slate-400">Lip-Sync Model Engine:</label>
                                <select
                                  value={lipsyncModel}
                                  onChange={(e) => setLipsyncModel(e.target.value as any)}
                                  className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-mono text-[10px] focus:outline-none focus:border-cyan-500/50"
                                >
                                  <option value="wav2lip">Wav2Lip Standard (Chính xác cao, mượt)</option>
                                  <option value="wav2lip_gan">Wav2Lip + GAN Discriminator (Nét răng, chuyển động tự nhiên)</option>
                                  <option value="sad_talker">SadTalker CLI (Immersive 3D - Tạo chuyển động đầu cổ)</option>
                                </select>
                              </div>

                              {/* Face restorer select */}
                              <div className="space-y-1.5">
                                <label className="text-slate-400">Face Restoration Model (Phục hồi nét mặt):</label>
                                <select
                                  value={faceRestorer}
                                  onChange={(e) => setFaceRestorer(e.target.value as any)}
                                  className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-mono text-[10px] focus:outline-none focus:border-cyan-500/50"
                                >
                                  <option value="gfpgan">GFPGAN v1.4 (Phục hồi da mặt tự nhiên, nhanh)</option>
                                  <option value="codeformer">CodeFormer Transformer (Cực nét, tốn tài nguyên)</option>
                                  <option value="none">Không sử dụng (Raw Wav2Lip output)</option>
                                </select>
                              </div>

                              {/* GFPGAN strength slider */}
                              {faceRestorer !== "none" && (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <label className="text-slate-400">Sức mạnh phục hồi (Enhancer Strength):</label>
                                    <span className="text-cyan-400 font-mono font-bold">{gfpganStrength.toFixed(1)}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0.1"
                                    max="1.0"
                                    step="0.05"
                                    value={gfpganStrength}
                                    onChange={(e) => setGfpganStrength(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                  />
                                </div>
                              )}

                              {/* Padding slider */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <label className="text-slate-400">Mở rộng vùng đệm mút môi (Mouth Pad Shift):</label>
                                  <span className="text-cyan-400 font-mono font-bold">+{lipsyncPadding}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="30"
                                  step="2"
                                  value={lipsyncPadding}
                                  onChange={(e) => setLipsyncPadding(parseInt(e.target.value))}
                                  className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                              </div>

                              {/* Crop scale */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <label className="text-slate-400">Độ giãn nở khung xương hàm (Mouth Expansion):</label>
                                  <span className="text-cyan-400 font-mono font-bold">{lipsyncMouthDilate.toFixed(1)}x</span>
                                </div>
                                <input
                                  type="range"
                                  min="0.8"
                                  max="1.8"
                                  step="0.1"
                                  value={lipsyncMouthDilate}
                                  onChange={(e) => setLipsyncMouthDilate(parseFloat(e.target.value))}
                                  className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Interactive toggles */}
                          <div className="bg-[#18181b]/30 border border-white/5 rounded-xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Hiển thị mạng lưới mốc khuôn mặt (Facial Mesh):</span>
                              <button
                                type="button"
                                onClick={() => setLipsyncLandmarksActive(!lipsyncLandmarksActive)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                                  lipsyncLandmarksActive ? "bg-cyan-500" : "bg-zinc-800"
                                }`}
                              >
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-200 ${lipsyncLandmarksActive ? "translate-x-4" : "translate-x-0"}`} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">So sánh trực tiếp (Split Compare):</span>
                              <button
                                type="button"
                                onClick={() => setLipsyncCompareActive(!lipsyncCompareActive)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                                  lipsyncCompareActive ? "bg-cyan-500" : "bg-zinc-800"
                                }`}
                              >
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-200 ${lipsyncCompareActive ? "translate-x-4" : "translate-x-0"}`} />
                              </button>
                            </div>
                          </div>

                          {/* Run Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsLipsyncing(true);
                              setLipsyncProgress(0);
                              setLipsyncLogs([]);
                              setLipsyncCompleted(false);
                              addLog("Khởi động tiến trình xử lý khớp hình AI Lip-Sync lồng tiếng...", "INFO");

                              const logs = [
                                "Khởi tạo module Wav2Lip Pipeline từ utils/lipsync_pipeline.py...",
                                "Nạp trọng số mô hình s3fd Face Detector và Wav2Lip+GAN...",
                                "Đọc file video lồng tiếng đã kết xuất: AI_Revolution_2026_dubbed.mp4",
                                "Trích xuất luồng tiếng tham chiếu: RTX_Cloned_Voice.wav",
                                "Nhận diện 68 điểm mốc khuôn mặt trên toàn bộ khung hình... [OK]",
                                "Tiến hành crop mút môi tự động và áp dụng mở rộng " + lipsyncPadding + "px...",
                                "Đang chạy đồng bộ khẩu hình môi dựa trên phổ biên độ âm thanh...",
                                "Áp dụng bộ phục hồi khuôn mặt siêu phân giải " + (faceRestorer === "gfpgan" ? "GFPGAN v1.4" : "CodeFormer") + " với lực đẩy " + gfpganStrength + "...",
                                "Trộn nén tệp tin, làm mịn viền khẩu hình miệng bằng bộ lọc màng lưới...",
                                "Đóng gói luồng đồng bộ đa kênh qua FFmpeg audio-video muxer...",
                                "[SUCCESS] Tiến trình AI Lip-Sync hoàn tất thành công mỹ mãn!"
                              ];

                              let currentLogIdx = 0;
                              const intv = setInterval(() => {
                                if (currentLogIdx < logs.length) {
                                  setLipsyncLogs(prev => [...prev, logs[currentLogIdx]]);
                                  currentLogIdx++;
                                  setLipsyncProgress(Math.min(100, Math.floor((currentLogIdx / logs.length) * 100)));
                                } else {
                                  clearInterval(intv);
                                  setIsLipsyncing(false);
                                  setLipsyncCompleted(true);
                                  addLog("Khớp hình môi AI lồng tiếng & phục hồi độ nét mặt thành công!", "SUCCESS");
                                }
                              }, 400);
                            }}
                            disabled={isLipsyncing}
                            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                              isLipsyncing
                                ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                                : "bg-cyan-500 hover:bg-cyan-600 text-black shadow-lg shadow-cyan-500/15 active:scale-95"
                            }`}
                          >
                            {isLipsyncing ? "Đang xử lý khớp miệng..." : "Bắt đầu AI Lip-Sync & Restoration"}
                          </button>
                        </div>

                        {/* Sandbox visual display comparison */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="bg-[#18181b]/50 border border-white/5 rounded-xl p-4.5 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Eye className="h-4 w-4 text-cyan-400" />
                                Khung Hình Kiểm Định Khẩu Hình (Interactive Viewport)
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono">Camera Frame #142</span>
                            </div>

                            {/* Interactive Face Canvas Frame */}
                            <div className="h-60 bg-black/90 border border-white/10 rounded-lg relative overflow-hidden flex items-center justify-center">
                              {/* The avatar image background representing the character face */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                {/* Custom SVG/Pure CSS Face Representation to ensure lightweight performance and compliance with 'no absolute sizes on canvas' guidelines */}
                                <div className="w-56 h-56 rounded-full bg-slate-900 border border-white/5 relative flex items-center justify-center overflow-hidden">
                                  {/* Hair */}
                                  <div className="absolute top-0 w-full h-1/3 bg-zinc-800" />
                                  
                                  {/* Ears */}
                                  <div className="absolute left-4 w-4 h-8 bg-amber-100/10 rounded-full" />
                                  <div className="absolute right-4 w-4 h-8 bg-amber-100/10 rounded-full" />

                                  {/* Face shape */}
                                  <div className="w-44 h-44 rounded-full bg-[#fcd34d]/10 border border-[#fcd34d]/20 relative flex flex-col justify-center items-center">
                                    {/* Eyes */}
                                    <div className="flex gap-12 -mt-4">
                                      <div className="w-4 h-4 rounded-full bg-slate-950 border border-cyan-500/30 flex items-center justify-center relative">
                                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                        {/* Landmark points */}
                                        {lipsyncLandmarksActive && (
                                          <span className="absolute -top-1 -left-1 w-1 h-1 bg-rose-500 rounded-full" />
                                        )}
                                      </div>
                                      <div className="w-4 h-4 rounded-full bg-slate-950 border border-cyan-500/30 flex items-center justify-center relative">
                                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                        {/* Landmark points */}
                                        {lipsyncLandmarksActive && (
                                          <span className="absolute -top-1 -right-1 w-1 h-1 bg-rose-500 rounded-full" />
                                        )}
                                      </div>
                                    </div>

                                    {/* Nose */}
                                    <div className="w-2 h-6 bg-amber-500/20 rounded-full mt-3 relative">
                                      {lipsyncLandmarksActive && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
                                      )}
                                    </div>

                                    {/* Lips / Mouth (Moves or lights up based on lip-sync progress or active simulation) */}
                                    <div className="mt-4 relative">
                                      <div 
                                        className={`border-2 rounded-full transition-all duration-300 relative ${
                                          isLipsyncing 
                                            ? "w-14 h-7 border-emerald-500 bg-emerald-500/20 animate-bounce" 
                                            : lipsyncCompleted 
                                            ? "w-12 h-4 border-cyan-500 bg-cyan-500/10" 
                                            : "w-10 h-3 border-rose-500/40 bg-rose-500/5"
                                        }`}
                                      >
                                        {/* Teeth inside representation */}
                                        {lipsyncModel === "wav2lip_gan" && (isLipsyncing || lipsyncCompleted) && (
                                          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/60 rounded-full" />
                                        )}
                                        
                                        {/* Landmarks around lips */}
                                        {lipsyncLandmarksActive && (
                                          <>
                                            <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Compare Divider Overlay */}
                              {lipsyncCompareActive && (
                                <div className="absolute inset-0 pointer-events-none">
                                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-cyan-500 z-10">
                                    <span className="absolute top-2 left-1/2 -translate-x-1/2 bg-cyan-500 text-black font-bold font-mono text-[8px] px-1 rounded uppercase">
                                      Split
                                    </span>
                                  </div>
                                  <div className="absolute left-3 top-3 text-[9px] font-bold font-mono text-rose-400 bg-black/70 px-2 py-0.5 rounded border border-rose-500/20">
                                    BEFORE (RAW INPUT)
                                  </div>
                                  <div className="absolute right-3 top-3 text-[9px] font-bold font-mono text-cyan-400 bg-black/70 px-2 py-0.5 rounded border border-cyan-500/20">
                                    AFTER (AI LIP-SYNCED)
                                  </div>
                                </div>
                              )}

                              {/* Rendering face landmarks overlay list if requested */}
                              {lipsyncLandmarksActive && (
                                <div className="absolute bottom-3 left-3 bg-black/80 border border-white/5 px-2 py-1 rounded text-[8px] font-mono text-emerald-400">
                                  🟢 Mesh: Active | Landmarks: 68 points detected
                                </div>
                              )}
                            </div>

                            {/* Lip sync status feedback */}
                            {isLipsyncing && (
                              <div className="bg-black/60 border border-white/5 p-3 rounded-lg space-y-1.5">
                                <div className="flex justify-between text-[9px] font-mono">
                                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 animate-spin text-cyan-400" />
                                    ĐANG HOẠT HỌA KHẨU HÌNH & TĂNG CHI TIẾT DA MẶT...
                                  </span>
                                  <span>{lipsyncProgress}%</span>
                                </div>
                                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                                    style={{ width: `${lipsyncProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {lipsyncCompleted && (
                              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg text-[10px] text-emerald-300 space-y-1 font-mono animate-fade-in">
                                <p className="font-bold text-emerald-400">✓ HOÀN THÀNH TIẾN TRÌNH KHỚP HÌNH MÔI local_dubber!</p>
                                <p className="text-[9px] text-slate-400 font-sans">
                                  Độ phân giải khuôn mặt đã được tối ưu hóa thành công bằng <span className="text-emerald-400 font-bold font-mono">{faceRestorer === "gfpgan" ? "GFPGAN v1.4" : "CodeFormer"}</span>. Tệp tin video đầu ra đạt chất lượng phòng thu đã lưu trữ tại <code className="text-emerald-400">C:/local_dubber/exports/AI_Revolution_2026_lipsynced.mp4</code>.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Logs Terminal */}
                          <div className="bg-black border border-white/5 rounded-xl p-3.5 space-y-2 h-44 overflow-y-auto">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <Terminal className="h-3.5 w-3.5 text-cyan-500" /> Terminal: pipeline_lipsync.log
                            </p>
                            <div className="font-mono text-[9.5px] text-zinc-400 space-y-1">
                              {lipsyncLogs.length === 0 ? (
                                <p className="text-zinc-600 italic">NHẤN "BẮT ĐẦU AI LIP-SYNC" ĐỂ KHỞI ĐỘNG LUỒNG SUY LUẬN local_dubber</p>
                              ) : (
                                lipsyncLogs.map((log, index) => (
                                  <p key={index} className={log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                                    ➔ {log}
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRightTab === "subtitles" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[calc(100vh-210px)]">
                      {/* Title */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Languages className="h-4 w-4 text-yellow-500 animate-pulse" />
                            Phòng Chèn Cứng & Dịch Thuật Phụ Đề (Phase 8)
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Tự động dịch thuật bằng LLM và chèn cứng (burn-in) phụ đề đa kiểu dáng thông qua bộ lọc FFmpeg Subtitles/ASS Filter
                          </p>
                        </div>
                        <span className="text-[9px] bg-yellow-950/40 text-yellow-400 px-2.5 py-0.5 rounded border border-yellow-500/20 font-bold font-mono uppercase tracking-wider">
                          ASS/SRT Burn-In Engine
                        </span>
                      </div>

                      {/* Sub-tabs menu inside Subtitles Tab */}
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 self-start">
                        <button
                          type="button"
                          onClick={() => setActiveTabSubtitles("translate")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            activeTabSubtitles === "translate"
                              ? "bg-yellow-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🌐 Dịch Thuật Subtitles
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabSubtitles("style")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            activeTabSubtitles === "style"
                              ? "bg-yellow-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🎨 ASS Stylist & Presets
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabSubtitles("burn")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            activeTabSubtitles === "burn"
                              ? "bg-yellow-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🔥 Chèn Cứng FFmpeg
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Column Left: Controls */}
                        <div className="md:col-span-5 space-y-4">
                          {activeTabSubtitles === "translate" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Languages className="h-3.5 w-3.5 text-yellow-400" />
                                Động Cơ Dịch Thuật LLM
                              </h4>
                              
                              <div className="space-y-3 text-[10px]">
                                <div className="space-y-1.5">
                                  <label className="text-slate-400">Translation Engine (Bộ dịch):</label>
                                  <select
                                    value={subTranslationEngine}
                                    onChange={(e) => setSubTranslationEngine(e.target.value as any)}
                                    className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-mono text-[10px] focus:outline-none focus:border-yellow-500/50"
                                  >
                                    <option value="gemini">Gemini-2.5-Flash (Dịch ngữ cảnh thông minh, giữ nguyên tag ASS)</option>
                                    <option value="deepl">DeepL Pro WebAPI (Chuẩn ngữ pháp, tự nhiên)</option>
                                    <option value="google_trans">Google Translate (Nhanh, miễn phí)</option>
                                  </select>
                                </div>

                                <div className="space-y-2 bg-black/30 p-2.5 rounded border border-white/5">
                                  <p className="font-bold text-yellow-400 text-[9px] uppercase">Gợi Ý Ngữ Cảnh Dịch (Context Hint):</p>
                                  <p className="text-slate-400 text-[9px] leading-relaxed">
                                    Động cơ sẽ sử dụng prompt chuyên sâu để dịch song ngữ SRT/ASS giữ nguyên định dạng thời gian và nhãn kiểu dáng.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    addLog("Khởi tạo tiến trình dịch thuật tệp phụ đề SRT qua " + subTranslationEngine.toUpperCase() + " API...", "INFO");
                                    setIsBurningSubtitles(true);
                                    setBurnProgress(0);
                                    setBurnLogs([]);
                                    const logs = [
                                      "Nạp tệp gốc: exports/AI_Revolution_2026.srt",
                                      "Đọc cấu trúc và phân đoạn thời gian... 3 phụ đề phân bổ.",
                                      "Gửi yêu cầu dịch hàng loạt sang " + subTranslationEngine.toUpperCase() + "...",
                                      "Dịch đoạn #1: 'Chào mừng...' -> 'Welcome...'",
                                      "Dịch đoạn #2: 'Hôm nay...' -> 'Today...'",
                                      "Dịch đoạn #3: 'Hệ thống...' -> 'The local_dubber...'",
                                      "[SUCCESS] Tạo thành công tệp phụ đề song ngữ: exports/AI_Revolution_2026_translated.srt"
                                    ];
                                    let idx = 0;
                                    const interval = setInterval(() => {
                                      if (idx < logs.length) {
                                        setBurnLogs(prev => [...prev, logs[idx]]);
                                        idx++;
                                        setBurnProgress(Math.min(100, Math.floor((idx / logs.length) * 100)));
                                      } else {
                                        clearInterval(interval);
                                        setIsBurningSubtitles(false);
                                        setBurnCompleted(true);
                                        addLog("Dịch thuật phụ đề thành công bằng " + subTranslationEngine.toUpperCase(), "SUCCESS");
                                      }
                                    }, 350);
                                  }}
                                  className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded text-[10px] uppercase tracking-wider transition"
                                >
                                  Dịch Phụ Đề Sang Anh Ngữ (English)
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTabSubtitles === "style" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Sliders className="h-3.5 w-3.5 text-yellow-400" />
                                Cấu Hình Thiết Kế Phụ Đề (ASS Stylist)
                              </h4>

                              <div className="space-y-3 text-[10px]">
                                <div className="space-y-1.5">
                                  <label className="text-slate-400">Preset Kiểu Dáng (Style Preset):</label>
                                  <select
                                    value={subStylePreset}
                                    onChange={(e) => {
                                      const val = e.target.value as any;
                                      setSubStylePreset(val);
                                      if (val === "netflix") {
                                        setSubFontColor("#ffffff");
                                        setSubStrokeColor("#000000");
                                        setSubFontSize(22);
                                        setSubStrokeWidth(2.5);
                                      } else if (val === "youtube") {
                                        setSubFontColor("#ffffff");
                                        setSubStrokeColor("#000000");
                                        setSubFontSize(20);
                                        setSubStrokeWidth(1.5);
                                      } else if (val === "cinematic") {
                                        setSubFontColor("#fcd34d");
                                        setSubStrokeColor("#000000");
                                        setSubFontSize(24);
                                        setSubStrokeWidth(3.0);
                                      } else {
                                        setSubFontColor("#ffffff");
                                        setSubStrokeColor("#475569");
                                        setSubFontSize(18);
                                        setSubStrokeWidth(1.0);
                                      }
                                    }}
                                    className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-mono text-[10px]"
                                  >
                                    <option value="netflix">Netflix Style (Nền đen bán trong suốt, Chữ trắng)</option>
                                    <option value="youtube">YouTube Style (Bản cơ bản chữ trắng viền đen mảnh)</option>
                                    <option value="cinematic">Cinematic Yellow (Chữ vàng hổ phách viền đen dày)</option>
                                    <option value="default">Classic Slate (Chữ trắng viền xám mờ)</option>
                                  </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-slate-400 text-[9px]">Màu Chữ (Font Color):</label>
                                    <div className="flex gap-1.5">
                                      <input
                                        type="color"
                                        value={subFontColor}
                                        onChange={(e) => setSubFontColor(e.target.value)}
                                        className="w-7 h-6 border border-white/10 rounded cursor-pointer bg-transparent"
                                      />
                                      <span className="font-mono text-[9px] uppercase self-center">{subFontColor}</span>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-slate-400 text-[9px]">Màu Viền (Stroke Outline):</label>
                                    <div className="flex gap-1.5">
                                      <input
                                        type="color"
                                        value={subStrokeColor}
                                        onChange={(e) => setSubStrokeColor(e.target.value)}
                                        className="w-7 h-6 border border-white/10 rounded cursor-pointer bg-transparent"
                                      />
                                      <span className="font-mono text-[9px] uppercase self-center">{subStrokeColor}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <label className="text-slate-400">Cỡ chữ (Font Size):</label>
                                    <span className="text-yellow-400 font-mono font-bold">{subFontSize}pt</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="12"
                                    max="36"
                                    value={subFontSize}
                                    onChange={(e) => setSubFontSize(parseInt(e.target.value))}
                                    className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <label className="text-slate-400">Độ dày viền chữ (Outline Stroke):</label>
                                    <span className="text-yellow-400 font-mono font-bold">{subStrokeWidth}px</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    step="0.5"
                                    value={subStrokeWidth}
                                    onChange={(e) => setSubStrokeWidth(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {activeTabSubtitles === "burn" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Flame className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
                                Quy Trình Chèn Cứng (FFmpeg Hardcode)
                              </h4>

                              <div className="space-y-3 text-[10px] text-slate-400 leading-relaxed">
                                <p>
                                  FFmpeg sẽ kết xuất tệp tin video phụ đề bằng cách nhúng trực tiếp chuỗi phụ đề ASS/SRT vào khung hình, tránh tình trạng lỗi font chữ hoặc biến mất phụ đề khi phát trên thiết bị không hỗ trợ.
                                </p>

                                <div className="bg-black/40 p-2 rounded border border-white/5 font-mono text-[9px] text-yellow-500/80">
                                  ffmpeg -i input.mp4 -vf "subtitles=subs.srt:force_style='FontSize={subFontSize},PrimaryColour={subFontColor.replace("#", "&H")},Outline={subStrokeWidth}'" -c:a copy output.mp4
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsBurningSubtitles(true);
                                    setBurnProgress(0);
                                    setBurnLogs([]);
                                    setBurnCompleted(false);
                                    addLog("Bắt đầu tiến trình chèn cứng phụ đề FFmpeg...", "INFO");

                                    const logs = [
                                      "Kiểm tra luồng video đầu vào: C:/local_dubber/exports/AI_Revolution_2026_lipsynced.mp4",
                                      "Kiểm tra phụ đề SRT đích: C:/local_dubber/exports/AI_Revolution_2026_translated.srt",
                                      "Tạo file cấu hình tạm thời ASS với kích cỡ font " + subFontSize + "pt...",
                                      "Áp dụng bảng màu chính: " + subFontColor + " | Màu viền chữ: " + subStrokeColor,
                                      "Gọi trình quản lý tiến trình FFmpeg subprocess... [NVENC ACCEL ACTIVE]",
                                      "Chạy kết xuất khung hình chèn cứng qua bộ lọc -vf subtitles...",
                                      "Đang encode video: Frame 100/1500 (6.2x Speed)...",
                                      "Đang encode video: Frame 500/1500 (6.5x Speed)...",
                                      "Đang encode video: Frame 1000/1500 (6.3x Speed)...",
                                      "Đang hoàn tất đóng gói ghép audio copy...",
                                      "[SUCCESS] Chèn cứng phụ đề hoàn tất! Lưu file thành công."
                                    ];

                                    let idx = 0;
                                    const interval = setInterval(() => {
                                      if (idx < logs.length) {
                                        setBurnLogs(prev => [...prev, logs[idx]]);
                                        idx++;
                                        setBurnProgress(Math.min(100, Math.floor((idx / logs.length) * 100)));
                                      } else {
                                        clearInterval(interval);
                                        setIsBurningSubtitles(false);
                                        setBurnCompleted(true);
                                        addLog("Kết xuất video chèn cứng phụ đề thành công!", "SUCCESS");
                                      }
                                    }, 400);
                                  }}
                                  disabled={isBurningSubtitles}
                                  className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition ${
                                    isBurningSubtitles
                                      ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                                      : "bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/15 active:scale-95"
                                  }`}
                                >
                                  {isBurningSubtitles ? "Đang Burn Phụ Đề..." : "Bắt Đầu Kết Xuất Video Chèn Cứng"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column Right: Interactive Preview & Terminal */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="bg-[#18181b]/50 border border-white/5 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Eye className="h-4 w-4 text-yellow-400" />
                                Bản Xem Trước Khung Hình Phụ Đề (Video Overlay Preview)
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono">1080p Overlay Mode</span>
                            </div>

                            {/* Simulated Video Frame with Customizable Subtitles */}
                            <div className="h-48 bg-slate-950 border border-white/10 rounded-lg relative overflow-hidden flex flex-col justify-between p-3">
                              {/* Top Status */}
                              <div className="flex justify-between items-center z-10">
                                <span className="bg-black/60 px-2 py-0.5 rounded text-[8px] font-mono text-zinc-400">
                                  00:00:03,800
                                </span>
                                <span className="bg-yellow-500 text-black px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-widest animate-pulse">
                                  Live Preview
                                </span>
                              </div>

                              {/* Simulated Background Video (Dark with abstract shape representing speaker) */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                <div className="w-24 h-24 rounded-full bg-blue-500/20 blur-2xl" />
                                <div className="w-16 h-16 rounded-full bg-yellow-500/10 blur-xl absolute -bottom-4" />
                              </div>

                              {/* Middle representation: Speaker waveform */}
                              <div className="flex gap-0.5 justify-center items-center pointer-events-none">
                                <div className="w-1 h-6 bg-slate-800 rounded animate-pulse" />
                                <div className="w-1 h-12 bg-slate-800 rounded animate-pulse delay-75" />
                                <div className="w-1 h-18 bg-yellow-500/40 rounded animate-pulse delay-150" />
                                <div className="w-1 h-8 bg-slate-800 rounded animate-pulse delay-200" />
                                <div className="w-1 h-4 bg-slate-800 rounded animate-pulse" />
                              </div>

                              {/* Live Customizable Subtitle Text Overlay */}
                              <div className="w-full text-center pb-2 z-10 flex flex-col items-center gap-1.5">
                                <p 
                                  className="font-sans font-bold leading-snug drop-shadow-md select-none transition-all duration-200"
                                  style={{
                                    fontSize: `${subFontSize}px`,
                                    color: subFontColor,
                                    textShadow: `0 0 4px #000, -${subStrokeWidth}px -${subStrokeWidth}px 0 ${subStrokeColor}, ${subStrokeWidth}px -${subStrokeWidth}px 0 ${subStrokeColor}, -${subStrokeWidth}px ${subStrokeWidth}px 0 ${subStrokeColor}, ${subStrokeWidth}px ${subStrokeWidth}px 0 ${subStrokeColor}`
                                  }}
                                >
                                  Chào mừng các bạn đến với cuộc cách mạng trí tuệ nhân tạo năm 2026.
                                </p>
                                <p 
                                  className="font-sans text-[11px] font-medium leading-snug text-slate-300 drop-shadow-md select-none"
                                  style={{
                                    textShadow: "1px 1px 2px #000"
                                  }}
                                >
                                  (Welcome to the artificial intelligence revolution of 2026.)
                                </p>
                              </div>
                            </div>

                            {/* Status block */}
                            {isBurningSubtitles && (
                              <div className="bg-black/60 border border-white/5 p-3 rounded-lg space-y-1.5">
                                <div className="flex justify-between text-[9px] font-mono">
                                  <span className="text-yellow-400 font-bold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 animate-spin text-yellow-400" />
                                    ĐANG CHẠY SUY LUẬN SUY DỊCH & KẾT XUẤT PHỤ ĐỀ...
                                  </span>
                                  <span>{burnProgress}%</span>
                                </div>
                                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-yellow-500 rounded-full transition-all duration-300"
                                    style={{ width: `${burnProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {burnCompleted && (
                              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg text-[10px] text-emerald-300 space-y-1 font-mono animate-fade-in">
                                <p className="font-bold text-emerald-400">✓ HOÀN THÀNH TIẾN TRÌNH SUBTITLE BURN-IN!</p>
                                <p className="text-[9px] text-slate-400 font-sans">
                                  Đã dịch song ngữ thành công và chèn cứng cứng phông ASS vào video. Bạn có thể mở tệp thành phẩm chất lượng cực nét 1080p tại:
                                  <code className="block bg-black/40 p-1.5 rounded mt-1 border border-white/5 text-emerald-400 font-mono">
                                    C:/local_dubber/exports/AI_Revolution_2026_hardcoded.mp4
                                  </code>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Logs terminal for subtitling */}
                          <div className="bg-black border border-white/5 rounded-xl p-3.5 space-y-2 h-44 overflow-y-auto">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <Terminal className="h-3.5 w-3.5 text-yellow-500" /> Terminal: sub_burner_pipeline.log
                            </p>
                            <div className="font-mono text-[9.5px] text-zinc-400 space-y-1">
                              {burnLogs.length === 0 ? (
                                <p className="text-zinc-600 italic">CHỌN TAB CHỈNH SỬA VÀ NHẤN "BẮT ĐẦU" ĐỂ THEO DÕI LOG CHẠY</p>
                              ) : (
                                burnLogs.map((log, index) => (
                                  <p key={index} className={log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                                    ➔ {log}
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRightTab === "separation" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[calc(100vh-210px)]">
                      {/* Title */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Music className="h-4 w-4 text-emerald-500 animate-pulse" />
                            Phân Hệ Tách Luồng Âm Thanh & Nhạc Nền AI (Phase 9)
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Sử dụng mô hình HTDemucs v4 và MDX-Net để tách tách tiếng nói (Vocal) độc lập khỏi nhạc nền (BGM) & âm thanh hiệu ứng (SFX)
                          </p>
                        </div>
                        <span className="text-[9px] bg-emerald-950/40 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold font-mono uppercase tracking-wider">
                          HTDemucs v4 / MDX-Net
                        </span>
                      </div>

                      {/* Sub-tabs menu inside Separation Tab */}
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 self-start">
                        <button
                          type="button"
                          onClick={() => setActiveTabSeparation("model")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            activeTabSeparation === "model"
                              ? "bg-emerald-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🎛️ Lựa Chọn Mô Hình AI
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabSeparation("stems")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            activeTabSeparation === "stems"
                              ? "bg-emerald-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🎼 Tùy Chọn Stems & Mixer
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTabSeparation("run")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            activeTabSeparation === "run"
                              ? "bg-emerald-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🚀 Kích Hoạt Tách Nguồn
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Column Left: Controls */}
                        <div className="md:col-span-5 space-y-4">
                          {activeTabSeparation === "model" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                                Động Cơ Tách Nguồn AI (Separation Core)
                              </h4>
                              
                              <div className="space-y-3 text-[10px]">
                                <div className="space-y-1.5">
                                  <label className="text-slate-400">Separation Model (Mô hình AI):</label>
                                  <select
                                    value={sepModel}
                                    onChange={(e) => setSepModel(e.target.value as any)}
                                    className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-mono text-[10px] focus:outline-none focus:border-emerald-500/50"
                                  >
                                    <option value="htdemucs">HTDemucs v4 (Hybrid Transformer - Chất lượng phòng thu)</option>
                                    <option value="mdxnet">MDX-Net Vocals (Chuyên tách giọng hát Karaoke sạch 99%)</option>
                                    <option value="wavelet">Wavelet Separator (Siêu tốc, tốn ít tài nguyên VRAM)</option>
                                  </select>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <label className="text-slate-400">Độ gối chồng dữ liệu (Overlap):</label>
                                    <span className="text-emerald-400 font-mono font-bold">{sepOverlap}x</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0.1"
                                    max="0.5"
                                    step="0.05"
                                    value={sepOverlap}
                                    onChange={(e) => setSepOverlap(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                  />
                                  <p className="text-[9px] text-zinc-500 italic">Giá trị overlap lớn hơn giúp giảm vết ghép âm thanh nhưng xử lý lâu hơn.</p>
                                </div>

                                <div className="space-y-2 bg-black/30 p-2.5 rounded border border-white/5 text-zinc-400 text-[9px] leading-relaxed">
                                  <p className="font-bold text-emerald-400 uppercase">GPU Acceleration:</p>
                                  <p>
                                    Mô hình được tự động phân bổ trên thiết bị CUDA tối ưu nhờ <code className="text-emerald-400">cuda_optimizer.py</code> giúp tăng tốc đáng kể so với CPU thông thường.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {activeTabSeparation === "stems" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                                Cấu Hình Stems & Live Mixer Preview
                              </h4>

                              <div className="space-y-3 text-[10px]">
                                <div className="space-y-1.5">
                                  <label className="text-slate-400">Số lượng luồng xuất (Stems Output):</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSepStems(2)}
                                      className={`py-1.5 font-bold rounded transition border text-[10px] ${
                                        sepStems === 2
                                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                                          : "bg-black/40 border-white/5 text-slate-400 hover:text-slate-300"
                                      }`}
                                    >
                                      2 Stems (Vocal + No-vocal)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSepStems(4)}
                                      className={`py-1.5 font-bold rounded transition border text-[10px] ${
                                        sepStems === 4
                                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                                          : "bg-black/40 border-white/5 text-slate-400 hover:text-slate-300"
                                      }`}
                                    >
                                      4 Stems (Vocal, BGM, SFX...)
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-3 border-t border-white/5 pt-3">
                                  <p className="font-bold text-emerald-400 text-[9px] uppercase tracking-wider">Live Real-time Volume Mixer</p>
                                  
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[9px]">
                                      <span className="text-slate-400 flex items-center gap-1">🎤 Tiếng Vocal (Dialogue):</span>
                                      <span className="text-emerald-400 font-mono font-bold">{audioVocalVolume}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="150"
                                      value={audioVocalVolume}
                                      onChange={(e) => setAudioVocalVolume(parseInt(e.target.value))}
                                      className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[9px]">
                                      <span className="text-slate-400 flex items-center gap-1">🎵 Nhạc Nền (Background Music):</span>
                                      <span className="text-emerald-400 font-mono font-bold">{audioBgmVolume}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="150"
                                      value={audioBgmVolume}
                                      onChange={(e) => setAudioBgmVolume(parseInt(e.target.value))}
                                      className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                  </div>

                                  {sepStems === 4 && (
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-[9px]">
                                        <span className="text-slate-400 flex items-center gap-1">💥 Hiệu Ứng (Sound SFX):</span>
                                        <span className="text-emerald-400 font-mono font-bold">{audioSfxVolume}%</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max="150"
                                        value={audioSfxVolume}
                                        onChange={(e) => setAudioSfxVolume(parseInt(e.target.value))}
                                        className="w-full h-1 bg-[#111114] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {activeTabSeparation === "run" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Flame className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                                Tiến trình tách nguồn âm thanh (Execution)
                              </h4>

                              <div className="space-y-3 text-[10px] text-slate-400 leading-relaxed">
                                <p>
                                  Sau khi tách nguồn, luồng Vocal gốc sẽ được gửi qua bộ nhân bản giọng nói XTTS để thực hiện dịch lồng tiếng, đồng thời luồng BGM & SFX được giữ nguyên để đóng gói ghép thành phẩm không làm suy giảm chất lượng âm thanh gốc.
                                </p>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSeparatingAudio(true);
                                    setSepProgress(0);
                                    setSepLogs([]);
                                    setSepCompleted(false);
                                    addLog("Khởi chạy bộ tách nguồn âm thanh AI AudioSeparator...", "INFO");

                                    const logs = [
                                      "Nạp luồng âm thanh gốc: inputs/AI_Revolution_2026.wav",
                                      "Đọc cấu trúc file: 48kHz Stereo 16-bit PCM...",
                                      `Khởi tạo mô hình ${sepModel.toUpperCase()} trên luồng GPU CUDA...`,
                                      "Bắt đầu quá trình suy luận (Inference Processing)...",
                                      "Đang tách luồng tiếng nói (Dialogue Stem)... 15%",
                                      "Đang tách luồng tiếng nói (Dialogue Stem)... 45%",
                                      "Đang tách luồng nhạc nền (Background BGM Stem)... 75%",
                                      "Áp dụng thuật toán lọc nhiễu giảm xì (De-noising filter)... 90%",
                                      `Xuất tệp tin thành phẩm ${sepStems} stems...`,
                                      "[SUCCESS] Trích xuất thành công luồng Vocal độc lập và luồng Nhạc nền BGM sạch sẽ!"
                                    ];

                                    let idx = 0;
                                    const interval = setInterval(() => {
                                      if (idx < logs.length) {
                                        setSepLogs(prev => [...prev, logs[idx]]);
                                        idx++;
                                        setSepProgress(Math.min(100, Math.floor((idx / logs.length) * 100)));
                                      } else {
                                        clearInterval(interval);
                                        setIsSeparatingAudio(false);
                                        setSepCompleted(true);
                                        addLog("Tách nguồn âm thanh bằng AI hoàn tất thành công!", "SUCCESS");
                                      }
                                    }, 400);
                                  }}
                                  disabled={isSeparatingAudio}
                                  className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition ${
                                    isSeparatingAudio
                                      ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                                      : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/15 active:scale-95"
                                  }`}
                                >
                                  {isSeparatingAudio ? "Đang Tách Nguồn..." : "Bắt Đầu Tách Nguồn Âm Thanh"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column Right: Interactive Preview & Terminal */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="bg-[#18181b]/50 border border-white/5 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Activity className="h-4 w-4 text-emerald-400" />
                                Bộ Giám Sát Cường Độ Các Luồng Âm (Live Audio Visualizer)
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono">Real-time Mixer Monitor</span>
                            </div>

                            {/* Simulated Interactive Equalizer Waves based on sliders! */}
                            <div className="h-48 bg-slate-950 border border-white/10 rounded-lg p-4 flex flex-col justify-between">
                              {/* Left & Right wave meters */}
                              <div className="grid grid-cols-3 gap-4 h-32 items-end pb-2">
                                {/* Vocal wave meter */}
                                <div className="flex flex-col items-center h-full justify-end space-y-2">
                                  <div className="w-full flex justify-center gap-1 items-end h-24">
                                    {[1, 2, 3, 4, 5, 6].map((i) => {
                                      const baseH = 20 + (i * 12) % 40;
                                      const factor = audioVocalVolume / 100;
                                      const computedH = Math.min(90, Math.max(5, baseH * factor));
                                      return (
                                        <div 
                                          key={i} 
                                          className="w-1.5 bg-emerald-500 rounded-t transition-all duration-200"
                                          style={{ height: `${computedH}%` }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="text-[8px] font-mono text-zinc-400 font-bold uppercase">vocals</span>
                                </div>

                                {/* BGM wave meter */}
                                <div className="flex flex-col items-center h-full justify-end space-y-2">
                                  <div className="w-full flex justify-center gap-1 items-end h-24">
                                    {[1, 2, 3, 4, 5, 6].map((i) => {
                                      const baseH = 30 + (i * 8) % 35;
                                      const factor = audioBgmVolume / 100;
                                      const computedH = Math.min(90, Math.max(5, baseH * factor));
                                      return (
                                        <div 
                                          key={i} 
                                          className="w-1.5 bg-blue-500 rounded-t transition-all duration-200"
                                          style={{ height: `${computedH}%` }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="text-[8px] font-mono text-zinc-400 font-bold uppercase">bgm</span>
                                </div>

                                {/* SFX/Other wave meter */}
                                <div className="flex flex-col items-center h-full justify-end space-y-2">
                                  <div className="w-full flex justify-center gap-1 items-end h-24">
                                    {[1, 2, 3, 4, 5, 6].map((i) => {
                                      const baseH = 15 + (i * 15) % 50;
                                      const factor = (sepStems === 4 ? audioSfxVolume : 0) / 100;
                                      const computedH = Math.min(90, Math.max(5, baseH * factor));
                                      return (
                                        <div 
                                          key={i} 
                                          className="w-1.5 bg-purple-500 rounded-t transition-all duration-200"
                                          style={{ height: `${computedH}%` }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="text-[8px] font-mono text-zinc-400 font-bold uppercase">sfx / other</span>
                                </div>
                              </div>

                              <div className="border-t border-white/5 pt-2 flex justify-between items-center text-[9px] text-zinc-500">
                                <span>Output Stem Quality: Master Lossless FLAC/WAV</span>
                                <span className="font-mono text-emerald-400">LUFS: -14.2 (Stereo)</span>
                              </div>
                            </div>

                            {/* Status block */}
                            {isSeparatingAudio && (
                              <div className="bg-black/60 border border-white/5 p-3 rounded-lg space-y-1.5">
                                <div className="flex justify-between text-[9px] font-mono">
                                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 animate-spin text-emerald-400" />
                                    ĐANG SUY LUẬN TÁCH PHÂN TÁCH LUỒNG ÂM THANH...
                                  </span>
                                  <span>{sepProgress}%</span>
                                </div>
                                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                    style={{ width: `${sepProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {sepCompleted && (
                              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg text-[10px] text-emerald-300 space-y-1 font-mono animate-fade-in">
                                <p className="font-bold text-emerald-400">✓ HOÀN THÀNH TÁCH LUỒNG THÀNH CÔNG (AI COMPLETED)!</p>
                                <p className="text-[9px] text-slate-400 font-sans">
                                  Đã xuất và phân tách luồng thành công. Các tệp tin âm thanh cô lập lưu tại:
                                  <code className="block bg-black/40 p-1.5 rounded mt-1 border border-white/5 text-emerald-400 font-mono">
                                    C:/local_dubber/exports/AI_Revolution_2026_vocals.wav <br/>
                                    C:/local_dubber/exports/AI_Revolution_2026_bgm.wav
                                  </code>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Logs terminal for separation */}
                          <div className="bg-black border border-white/5 rounded-xl p-3.5 space-y-2 h-44 overflow-y-auto">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <Terminal className="h-3.5 w-3.5 text-emerald-500" /> Terminal: audio_separator_pipeline.log
                            </p>
                            <div className="font-mono text-[9.5px] text-zinc-400 space-y-1">
                              {sepLogs.length === 0 ? (
                                <p className="text-zinc-600 italic">CHỌN TAB CHỈNH SỬA VÀ NHẤN "BẮT ĐẦU" ĐỂ THEO DÕI LOG CHẠY TÁCH NGUỒN</p>
                              ) : (
                                sepLogs.map((log, index) => (
                                  <p key={index} className={log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                                    ➔ {log}
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRightTab === "publisher" && (
                    <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[calc(100vh-210px)]">
                      {/* Title */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                            <Package className="h-4 w-4 text-indigo-500 animate-pulse" />
                            Phân Hệ Đóng Gói Phân Phối Đa Ngôn Ngữ AI (Phase 10)
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Biên dịch siêu dữ liệu JSON, đồng bộ bù trễ âm thanh và lồng ghép song song hàng loạt luồng ngôn ngữ vào container MKV/MP4 chất lượng cao.
                          </p>
                        </div>
                        <span className="text-[9px] bg-indigo-950/40 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/20 font-bold font-mono uppercase tracking-wider">
                          FFmpeg Multiplexer
                        </span>
                      </div>

                      {/* Sub-tabs menu inside Publisher Tab */}
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 self-start shrink-0">
                        <button
                          type="button"
                          onClick={() => setPubActiveTab("metadata")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            pubActiveTab === "metadata"
                              ? "bg-indigo-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          📋 Siêu Dữ Liệu Release
                        </button>
                        <button
                          type="button"
                          onClick={() => setPubActiveTab("tracks")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            pubActiveTab === "tracks"
                              ? "bg-indigo-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          📼 Cấu Hình Container
                        </button>
                        <button
                          type="button"
                          onClick={() => setPubActiveTab("build")}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition ${
                            pubActiveTab === "build"
                              ? "bg-indigo-500 text-black"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          🚀 Biên Dịch & Đóng Gói
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Column Left: Controls */}
                        <div className="md:col-span-5 space-y-4">
                          {pubActiveTab === "metadata" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <FileJson className="h-3.5 w-3.5 text-indigo-400" />
                                release_manifest.json (Metadata)
                              </h4>

                              <div className="space-y-3 text-[10px]">
                                <div className="space-y-1">
                                  <label className="text-slate-400">Tiêu đề phát hành (Movie Title):</label>
                                  <input
                                    type="text"
                                    value={pubTitle}
                                    onChange={(e) => setPubTitle(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-sans text-[10px] focus:outline-none focus:border-indigo-500/50"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-slate-400">Mô tả tóm tắt (Description):</label>
                                  <textarea
                                    value={pubDesc}
                                    onChange={(e) => setPubDesc(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-slate-300 font-sans text-[10px] focus:outline-none focus:border-indigo-500/50 resize-none"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-slate-400">Danh sách ngôn ngữ kích hoạt:</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { code: "vi", name: "Tiếng Việt 🇻🇳" },
                                      { code: "en", name: "English 🇺🇸" },
                                      { code: "es", name: "Spanish 🇪🇸" },
                                      { code: "ja", name: "Japanese 🇯🇵" },
                                      { code: "fr", name: "French 🇫🇷" }
                                    ].map((lang) => {
                                      const isSelected = pubLanguages.includes(lang.code);
                                      return (
                                        <button
                                          key={lang.code}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              setPubLanguages(prev => prev.filter(c => c !== lang.code));
                                            } else {
                                              setPubLanguages(prev => [...prev, lang.code]);
                                            }
                                          }}
                                          className={`py-1 px-2 text-[9.5px] rounded border text-left transition flex items-center justify-between ${
                                            isSelected 
                                              ? "bg-indigo-950/40 border-indigo-500 text-indigo-300 font-semibold" 
                                              : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                                          }`}
                                        >
                                          <span>{lang.name}</span>
                                          {isSelected && <Check className="h-3 w-3 text-indigo-400" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {pubActiveTab === "tracks" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                                Định dạng xuất Container
                              </h4>

                              <div className="space-y-3 text-[10px]">
                                <div className="space-y-2">
                                  <label className="text-slate-400">Đóng gói đầu ra (Output Target):</label>
                                  <div className="space-y-2">
                                    {[
                                      { key: "mkv", name: "MKV Multi-Track (Hợp nhất luồng audio & phụ đề)", desc: "Khuyên dùng để phân phối phim chiếu rạp chuyên nghiệp" },
                                      { key: "mp4", name: "Hàng loạt file MP4 Single-Track", desc: "Phù hợp để upload Youtube từng bản dịch biệt lập" },
                                      { key: "release_pkg", name: "Release Package (.zip + manifest.json)", desc: "Gói tiêu chuẩn để đưa lên hệ thống CDN/Server" }
                                    ].map((fmt) => {
                                      const isSelected = pubFormats.includes(fmt.key);
                                      return (
                                        <button
                                          key={fmt.key}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              setPubFormats(prev => prev.filter(f => f !== fmt.key));
                                            } else {
                                              setPubFormats(prev => [...prev, fmt.key]);
                                            }
                                          }}
                                          className={`w-full p-2.5 rounded-lg border text-left transition flex flex-col gap-1 ${
                                            isSelected 
                                              ? "bg-indigo-950/40 border-indigo-500 text-indigo-300" 
                                              : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-bold text-[10px]">{fmt.name}</span>
                                            {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                                          </div>
                                          <p className="text-[8.5px] text-zinc-500 font-sans">{fmt.desc}</p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {pubActiveTab === "build" && (
                            <div className="bg-[#18181b]/40 border border-white/5 rounded-xl p-4 space-y-3">
                              <h4 className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                                Khởi Chạy Bộ Đóng Gói
                              </h4>

                              <div className="space-y-3 text-[10px] text-slate-400 leading-relaxed">
                                <p>
                                  Hệ thống sẽ gọi <code className="text-indigo-400">package_publisher.py</code> để map song song luồng tiếng lồng bằng XTTS v2 cùng tệp phụ đề dịch ASS/SRT tương ứng.
                                </p>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPublishing(true);
                                    setPubProgress(0);
                                    setPubLogs([]);
                                    setPubCompleted(false);
                                    addLog("Khởi chạy bộ xuất bản & đóng gói đa ngôn ngữ PackagePublisher...", "INFO");

                                    const logs = [
                                      "Nạp tệp video gốc: inputs/AI_Revolution_2026_lipsynced.mp4",
                                      `Quét danh mục luồng ngôn ngữ: [${pubLanguages.map(l => l.toUpperCase()).join(", ")}]...`,
                                      "Tạo tệp phát hành release_manifest.json mô tả siêu dữ liệu phim...",
                                      "Khởi chạy lệnh FFmpeg Multi-Stream Container mapping...",
                                      `Liên kết luồng tiếng nói lồng tiếng: ${pubLanguages.map(l => `audio_${l}.wav`).join(", ")}`,
                                      `Liên kết phụ đề đa ngôn ngữ song song: ${pubLanguages.map(l => `subtitles_${l}.srt`).join(", ")}`,
                                      "Áp dụng độ bù trễ đồng bộ môi âm thanh (Audio Lipsync Delay Synchronization)...",
                                      "Ghép nối nén luồng không mất mát (Lossless Multiplexing)... 40%",
                                      "Ghép nối nén luồng không mất mát (Lossless Multiplexing)... 85%",
                                      "Biên dịch gói phân phối release_package.zip...",
                                      "[SUCCESS] Hoàn tất đóng gói toàn diện. Tệp tin MKV đa kênh đã sẵn sàng phát hành!"
                                    ];

                                    let idx = 0;
                                    const interval = setInterval(() => {
                                      if (idx < logs.length) {
                                        setPubLogs(prev => [...prev, logs[idx]]);
                                        idx++;
                                        setPubProgress(Math.min(100, Math.floor((idx / logs.length) * 100)));
                                      } else {
                                        clearInterval(interval);
                                        setIsPublishing(false);
                                        setPubCompleted(true);
                                        addLog("Đóng gói đa ngôn ngữ thành phẩm AI hoàn tất!", "SUCCESS");
                                      }
                                    }, 400);
                                  }}
                                  disabled={isPublishing || pubLanguages.length === 0}
                                  className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition ${
                                    isPublishing || pubLanguages.length === 0
                                      ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                                      : "bg-indigo-500 hover:bg-indigo-600 text-black shadow-lg shadow-indigo-500/15 active:scale-95"
                                  }`}
                                >
                                  {isPublishing ? "Đang Xuất Bản..." : pubLanguages.length === 0 ? "Vui lòng chọn ngôn ngữ" : "Bắt Đầu Đóng Gói & Xuất Bản"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column Right: Interactive Preview & Terminal */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="bg-[#18181b]/50 border border-white/5 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                                <Activity className="h-4 w-4 text-indigo-400" />
                                Bản đồ cấu trúc tệp Container (Container Multiplexing Layout)
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono">File Stream Map</span>
                            </div>

                            {/* CONTAINER FILE MAP VISUALIZER */}
                            <div className="h-48 bg-slate-950 border border-white/10 rounded-lg p-3 overflow-y-auto font-mono text-[9px] text-zinc-400 space-y-2.5">
                              {/* Main Container Header */}
                              <div className="border border-indigo-500/20 bg-indigo-950/20 rounded p-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                                  <span className="text-indigo-300 font-bold">
                                    {pubFormats.includes("mkv") ? "AI_Revolution_2026_multilingual.mkv" : "AI_Revolution_2026_release.mp4"}
                                  </span>
                                </div>
                                <span className="text-[8px] uppercase bg-black px-1.5 py-0.5 rounded text-indigo-400 font-bold">CONTAINER</span>
                              </div>

                              {/* Streams layout */}
                              <div className="grid grid-cols-1 gap-2 pl-3">
                                {/* Video Stream (always 1) */}
                                <div className="border border-cyan-500/10 bg-cyan-950/10 rounded p-2 flex justify-between items-center">
                                  <span className="text-cyan-400 font-bold">🎬 Stream #0: Video (1080p H.264 / NVENC Accel)</span>
                                  <span className="text-[8px] uppercase bg-black px-1 rounded text-cyan-400">copy</span>
                                </div>

                                {/* Audio Streams based on selected languages */}
                                {pubLanguages.map((lang, index) => (
                                  <div key={lang} className="border border-emerald-500/10 bg-emerald-950/10 rounded p-2 flex justify-between items-center">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-emerald-400 font-bold">🎤 Stream #{index + 1}: Audio ({lang.toUpperCase()} Dubbed)</span>
                                      <span className="text-[8px] bg-emerald-900/40 text-emerald-300 px-1 rounded font-sans uppercase">XTTS v2 cloned</span>
                                    </div>
                                    <span className="text-[8px] text-zinc-500 uppercase font-bold">AAC Stereo</span>
                                  </div>
                                ))}

                                {/* Subtitle Streams based on selected languages */}
                                {pubLanguages.map((lang, index) => (
                                  <div key={lang} className="border border-yellow-500/10 bg-yellow-950/10 rounded p-2 flex justify-between items-center">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-yellow-400 font-bold">📝 Stream #{pubLanguages.length + index + 1}: Subtitles ({lang.toUpperCase()})</span>
                                      <span className="text-[8px] bg-yellow-900/40 text-yellow-300 px-1 rounded font-sans uppercase">srt translation</span>
                                    </div>
                                    <span className="text-[8px] text-zinc-500 uppercase font-bold">ASS/SRT</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Status block */}
                            {isPublishing && (
                              <div className="bg-black/60 border border-white/5 p-3 rounded-lg space-y-1.5">
                                <div className="flex justify-between text-[9px] font-mono">
                                  <span className="text-indigo-400 font-bold flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 animate-spin text-indigo-400" />
                                    ĐANG CHẠY SUY LUẬN FFMEG MUX CONTAINER...
                                  </span>
                                  <span>{pubProgress}%</span>
                                </div>
                                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                    style={{ width: `${pubProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {pubCompleted && (
                              <div className="bg-indigo-950/20 border border-indigo-500/30 p-3 rounded-lg text-[10px] text-indigo-300 space-y-1 font-mono animate-fade-in">
                                <p className="font-bold text-indigo-400">✓ HOÀN THÀNH XUẤT BẢN THÀNH CÔNG (AI PUBLISHED)!</p>
                                <p className="text-[9px] text-slate-400 font-sans">
                                  Đã đóng gói hoàn chỉnh gói đa ngôn ngữ lồng tiếng & phụ đề. Các tệp xuất bản lưu tại:
                                  <code className="block bg-black/40 p-1.5 rounded mt-1 border border-white/5 text-indigo-400 font-mono">
                                    C:/local_dubber/releases/AI_Revolution_2026_multilingual.mkv <br/>
                                    C:/local_dubber/releases/release_manifest.json <br/>
                                    C:/local_dubber/releases/release_package.zip
                                  </code>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Logs terminal for publisher */}
                          <div className="bg-black border border-white/5 rounded-xl p-3.5 space-y-2 h-44 overflow-y-auto">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <Terminal className="h-3.5 w-3.5 text-indigo-500" /> Terminal: package_publisher.log
                            </p>
                            <div className="font-mono text-[9.5px] text-zinc-400 space-y-1">
                              {pubLogs.length === 0 ? (
                                <p className="text-zinc-600 italic">CHỌN TAB CHỈNH SỬA VÀ NHẤN "BẮT ĐẦU" ĐỂ THEO DÕI LOG CHẠY ĐÓNG GÓI</p>
                              ) : (
                                pubLogs.map((log, index) => (
                                  <p key={index} className={log.includes("[SUCCESS]") ? "text-indigo-400 font-bold" : "text-zinc-400"}>
                                    ➔ {log}
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Panel 2: Developer Blueprint Guide */}
                <div className="bg-[#121214] rounded-xl border border-white/5 p-5 space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-blue-500" />
                    Sổ tay Nhà phát triển AI Software Engineer
                  </h2>

                  <div className="space-y-3">
                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1">
                      <p className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Clean Architecture & Giao tiếp Module độc lập
                      </p>
                      <p className="text-slate-500 text-[10px] leading-normal">
                        Mỗi bước trong luồng Dubbing (từ 1 đến 10) được tách biệt vào các module Python độc lập. Bạn có thể thay thế các dịch vụ dịch thuật (ví dụ từ Gemini sang Llama local) hoặc TTS Engine chỉ bằng cách điều chỉnh cấu hình.
                      </p>
                    </div>

                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1">
                      <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        QThread Đa luồng phi đồng bộ
                      </p>
                      <p className="text-slate-500 text-[10px] leading-normal">
                        Việc chạy mô hình Whisper Large v3 hoặc XTTS v2 trực tiếp sẽ chặn luồng GUI. BaseWorker trong <code className="text-emerald-400">workers/base_worker.py</code> kế thừa QThread giúp lồng tiếng mượt mà, đồng bộ thông tin về giao diện qua Qt Signals.
                      </p>
                    </div>

                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1">
                      <p className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Hỗ trợ Checkpoint trong SQLite
                      </p>
                      <p className="text-slate-500 text-[10px] leading-normal">
                        Bảng SQLite lưu giữ tiến trình cho phép tạm dừng (Pause), hủy bỏ (Cancel) hoặc phục hồi (Resume) từ vị trí phân đoạn âm thanh bị lỗi mà không cần chạy lại toàn bộ quy trình nặng nề từ đầu.
                      </p>
                    </div>

                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1">
                      <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Tối ưu hóa GPU CUDA & Lắp ráp FFmpeg NVENC (Giai đoạn 4)
                      </p>
                      <p className="text-slate-500 text-[10px] leading-normal">
                        Sử dụng <code className="text-amber-400">torch.cuda.empty_cache()</code> để dọn dẹp bộ nhớ đệm và kích hoạt chế độ <code className="text-amber-400">FP16 Precision</code> giúp Whisper và XTTS v2 tiết kiệm tới 40% VRAM. Luồng đóng gói cuối cùng được đẩy qua <code className="text-amber-400">FFmpeg nvenc</code> tăng tốc phần cứng, đạt tốc độ render vượt trội &gt;5x Realtime trên GPU NVIDIA.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </div>

      {/* Blue Footer Status Bar */}
      <footer className="h-8 bg-blue-600 flex items-center px-6 justify-between shrink-0">
        <div className="flex gap-4">
          <span className="text-[9px] font-bold text-white">STATUS: SYSTEM STABLE</span>
          <span className="text-[9px] font-medium text-blue-100 uppercase tracking-tight hidden md:inline">
            Threads: 12 Active | Models Loaded: Whisper v3, XTTS v2, Demucs v4 | Workspace: local_dubber
          </span>
        </div>
        <div className="text-[9px] font-bold text-white uppercase tracking-wider font-mono">
          Ready for Windows 11 CUDA Batch Processing
        </div>
      </footer>
    </div>
  );
}

