/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AIService, GeneratedScript, VOICES, VoiceName, AIProvider } from './services/aiService';
import { 
  Video, 
  Type, 
  Mic, 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ChevronRight,
  RefreshCw,
  Download,
  Key,
  Volume2,
  Music,
  Pause,
  Upload,
  Copy,
  Check,
  Globe,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const NICHES = [
  "Space Exploration Facts",
  "Ancient History Mysteries",
  "Futuristic Tech Trends",
  "Deep Sea Creatures",
  "Mind-Blowing Science",
  "Productivity Hacks",
  "Stoic Philosophy"
];

const BACKGROUND_MUSIC = [
  { name: "Cinematic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { name: "Lo-Fi", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { name: "Upbeat", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { name: "None", url: "" }
];

const LANGUAGES = [
  "English",
  "Telugu",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Chinese",
  "Arabic"
];

export default function App() {
  const [niche, setNiche] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [language, setLanguage] = useState('English');
  const [customLanguage, setCustomLanguage] = useState('');
  const [voice, setVoice] = useState<VoiceName>('Kore');
  const [musicUrl, setMusicUrl] = useState(BACKGROUND_MUSIC[0].url);
  const [status, setStatus] = useState<'idle' | 'scripting' | 'voiceover' | 'visual' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [langMessage, setLangMessage] = useState<string | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<VoiceName | null>(null);
  const [isPreviewingMusic, setIsPreviewingMusic] = useState<string | null>(null);
  const [customMusic, setCustomMusic] = useState<{ name: string, url: string } | null>(null);

  const [userApiKey, setUserApiKey] = useState(process.env.GEMINI_API_KEY || '');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
  const [sessionRequests, setSessionRequests] = useState(0);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [scriptModel, setScriptModel] = useState('gemini-2.5-flash');
  const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [copiedType, setCopiedType] = useState<'title' | 'tags' | null>(null);
  const [channelName, setChannelName] = useState('');
  const [platform, setPlatform] = useState<'instagram' | 'youtube'>('youtube');
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<number | null>(null);
  const [showEndCard, setShowEndCard] = useState(false);
  const [skipFailedImages, setSkipFailedImages] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  // Canvas rendering loop for recording
  useEffect(() => {
    if (status !== 'done' || !images.length || !script) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const render = () => {
      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (showEndCard) {
        // Draw End Card
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add subtle gradient
        const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
        grad.addColorStop(0, '#1a1a1a');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        
        // Icon/Platform indicator
        ctx.font = 'bold 24px Inter';
        ctx.fillStyle = platform === 'instagram' ? '#E1306C' : '#FF0000';
        ctx.fillText(platform.toUpperCase(), canvas.width / 2, canvas.height / 2 - 80);

        ctx.font = 'bold 60px Inter';
        ctx.fillStyle = 'white';
        const actionText = platform === 'instagram' ? 'FOLLOW' : 'SUBSCRIBE';
        ctx.fillText(actionText, canvas.width / 2, canvas.height / 2);
        
        if (channelName) {
          ctx.font = '30px Inter';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(`@${channelName.replace('@', '')}`, canvas.width / 2, canvas.height / 2 + 60);
        }

        animationFrame = requestAnimationFrame(render);
        return;
      }

      // Draw current image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = images[currentSegmentIndex] || images[0];
      if (img.complete) {
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        
        // Add subtle zoom effect
        const zoom = 1 + (Math.sin(Date.now() / 2000) * 0.05);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        ctx.restore();
      }

      // Draw overlay
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw captions
      if (script.segments[currentSegmentIndex]) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Inter';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        
        const words = script.segments[currentSegmentIndex].text.toUpperCase().split(' ');
        let line = '';
        let y = canvas.height - 200;
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > canvas.width - 100 && n > 0) {
            ctx.fillText(line, canvas.width / 2, y);
            line = words[n] + ' ';
            y += 50;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, canvas.width / 2, y);
      }

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [currentSegmentIndex, images, script, status]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const downloadAsVideo = async () => {
    if (!canvasRef.current || !audioRef.current) return;
    
    setIsRecording(true);
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    const music = musicRef.current;

    // Reset playback
    audio.currentTime = 0;
    if (musicUrl) music.currentTime = 0;
    
    const stream = canvas.captureStream(30);
    
    // Initialize or resume AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioCtx = audioContextRef.current;
    await audioCtx.resume();
    
    if (!audioDestRef.current) {
      audioDestRef.current = audioCtx.createMediaStreamDestination();
    }
    const dest = audioDestRef.current;
    
    // Connect audio element if not already connected
    if (!audioSourceRef.current && audio) {
      try {
        audioSourceRef.current = audioCtx.createMediaElementSource(audio);
        audioSourceRef.current.connect(dest);
        audioSourceRef.current.connect(audioCtx.destination);
      } catch (e) {
        console.warn("Failed to connect audio source:", e);
      }
    }
    
    // Connect music element if not already connected
    if (!musicSourceRef.current && music && musicUrl) {
      try {
        musicSourceRef.current = audioCtx.createMediaElementSource(music);
        musicSourceRef.current.connect(dest);
        musicSourceRef.current.connect(audioCtx.destination);
      } catch (e) {
        console.warn("Failed to connect music source:", e);
      }
    }
    
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const recorderMimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') 
      ? 'video/mp4;codecs=avc1,mp4a.40.2' 
      : MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : MediaRecorder.isTypeSupported('video/webm;codecs=h264')
      ? 'video/webm;codecs=h264'
      : 'video/webm;codecs=vp9,opus';
    
    const recorder = new MediaRecorder(combinedStream, { 
      mimeType: recorderMimeType,
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000
    });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const extension = recorderMimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: recorderMimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `short.${extension}`;
      a.click();
      setIsRecording(false);
      setShowEndCard(false);
    };

    recorder.start();
    audio.play();
    if (musicUrl) music.play();

    audio.onended = async () => {
      // Show end card for 3 seconds
      setShowEndCard(true);
      await new Promise(resolve => setTimeout(resolve, 3000));
      recorder.stop();
      if (musicUrl) music.pause();
    };
  };

  const regenerateImage = async (index: number) => {
    if (!script || isRegeneratingImage !== null) return;
    setIsRegeneratingImage(index);
    try {
      const ai = new AIService(userApiKey, aiProvider, scriptModel, imageModel);
      const newImage = await ai.generateVisual(script.segments[index].visualPrompt);
      const newImages = [...images];
      newImages[index] = newImage;
      setImages(newImages);
    } catch (err) {
      console.error(err);
      setError("Failed to regenerate image");
    } finally {
      setIsRegeneratingImage(null);
    }
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newImages = [...images];
      newImages[index] = url;
      setImages(newImages);
    };
    reader.readAsDataURL(file);
  };
  const previewVoice = async (v: VoiceName) => {
    if (isPreviewingVoice) return;
    setIsPreviewingVoice(v);
    const selectedLanguage = customLanguage || language;
    try {
      const ai = new AIService(userApiKey, aiProvider, scriptModel, imageModel);
      const audioDataUrl = await ai.generateVoicePreview(v, selectedLanguage);
      const audio = new Audio(audioDataUrl);
      audio.onended = () => setIsPreviewingVoice(null);
      audio.play();
    } catch (err) {
      console.error(err);
      setIsPreviewingVoice(null);
    }
  };

  const previewMusic = (url: string) => {
    if (!url) return;
    if (isPreviewingMusic === url) {
      setIsPreviewingMusic(null);
      return;
    }
    setIsPreviewingMusic(url);
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.onended = () => setIsPreviewingMusic(null);
    audio.play();
    
    // Stop after 5 seconds
    setTimeout(() => {
      audio.pause();
      setIsPreviewingMusic(null);
    }, 5000);
  };

  const handleCustomMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setCustomMusic({ name: file.name, url });
      setMusicUrl(url);
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string, type: 'title' | 'tags') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const testConnection = async () => {
    if (!userApiKey) {
      setTestResult({ success: false, message: "Please enter an API key" });
      return;
    }
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const ai = new AIService(userApiKey, aiProvider, scriptModel, imageModel);
      setSessionRequests(prev => prev + 1);
      // Simple test call
      if (aiProvider === 'gemini') {
        await ai.checkLanguageAvailability('English');
        // If that passes, try a very small generation
        const testScript = await ai.generateScript("test", "English");
        if (testScript) {
          setTestResult({ success: true, message: "Connection successful! Your key is working." });
        }
      } else {
        setTestResult({ success: true, message: "Key set. Ready to generate." });
      }
    } catch (err: any) {
      console.error(err);
      setTestResult({ success: false, message: err.message || "Connection failed. Check your key and quota." });
    } finally {
      setIsTestingKey(false);
    }
  };

  const generateFullShort = async () => {
    const selectedNiche = customNiche || niche;
    const selectedLanguage = customLanguage || language;
    if (!selectedNiche) {
      setError("Please select or enter a niche");
      return;
    }

    // Stop any existing playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }

    setStatus('scripting');
    setError(null);
    setProgress(5);
    setImages([]);
    setAudioUrl(null);
    setCurrentSegmentIndex(0);

    try {
      const ai = new AIService(userApiKey, aiProvider, scriptModel, imageModel);
      
      // Check language availability first
      const langStatus = ai.checkLanguageAvailability(selectedLanguage);
      setLangMessage(langStatus);
      setTimeout(() => setLangMessage(null), 3000);
      
      // 1. Script
      setStatus('scripting');
      setSessionRequests(prev => prev + 1);
      const generatedScript = await ai.generateScript(selectedNiche, selectedLanguage);
      setScript(generatedScript);
      setProgress(15);

      // 2. Visuals (Multiple Images) - Now First
      setStatus('visual');
      const generatedImages: string[] = [];
      for (let i = 0; i < generatedScript.segments.length; i++) {
        try {
          setSessionRequests(prev => prev + 1);
          const img = await ai.generateVisual(generatedScript.segments[i].visualPrompt);
          generatedImages.push(img);
          setImages([...generatedImages]); // Update UI incrementally
          setProgress(15 + ((i + 1) / generatedScript.segments.length) * 50);
        } catch (imgErr: any) {
          console.error(`Image ${i} generation failed:`, imgErr);
          if (skipFailedImages) {
            // Use a placeholder if skipping is allowed
            const placeholder = `https://picsum.photos/seed/${encodeURIComponent(generatedScript.segments[i].visualPrompt.slice(0, 20))}/1080/1920`;
            generatedImages.push(placeholder);
            setImages([...generatedImages]);
            setProgress(15 + ((i + 1) / generatedScript.segments.length) * 50);
            continue;
          }
          throw new Error(`Visual generation failed at image ${i+1}/${generatedScript.segments.length}: ${imgErr.message}`);
        }
      }

      // 3. Voiceover - Now Second
      setStatus('voiceover');
      setSessionRequests(prev => prev + 1);
      const fullText = generatedScript.segments.map(s => s.text).join(' ');
      const audioDataUrl = await ai.generateVoiceover(fullText, voice, selectedLanguage);
      setAudioUrl(audioDataUrl);
      setProgress(90);
      
      setStatus('done');
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
      setStatus('error');
    }
  };

  // Slideshow logic: change image based on audio progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !script) return;

    const handleTimeUpdate = () => {
      const duration = audio.duration;
      const currentTime = audio.currentTime;
      if (!duration) return;

      const segmentDuration = duration / script.segments.length;
      const index = Math.min(
        Math.floor(currentTime / segmentDuration),
        script.segments.length - 1
      );
      setCurrentSegmentIndex(index);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', () => {
      setIsPlaying(true);
      setShowEndCard(false);
    });
    audio.addEventListener('pause', () => setIsPlaying(false));
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', () => setIsPlaying(true));
      audio.removeEventListener('pause', () => setIsPlaying(false));
    };
  }, [audioUrl, script]);

  const togglePlayback = () => {
    if (audioRef.current?.paused) {
      audioRef.current.play();
      if (musicUrl) musicRef.current?.play();
    } else {
      audioRef.current?.pause();
      musicRef.current?.pause();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">ShortsAI Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-lg transition-colors flex items-center gap-2",
                showSettings ? "bg-orange-500 text-white" : "hover:bg-white/5 text-white/60 hover:text-white"
              )}
              title="API Settings"
            >
              <Key className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-wider font-bold hidden sm:inline">Settings</span>
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className={cn(
                "w-2 h-2 rounded-full",
                userApiKey !== process.env.GEMINI_API_KEY ? "bg-emerald-500" : "bg-blue-500"
              )} />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
                {userApiKey !== process.env.GEMINI_API_KEY ? "Custom API Active" : "Shared API Active"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-12"
            >
              <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <Key className="w-5 h-5 text-orange-500" />
                    API Configuration
                  </h2>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-white/40">AI Provider</label>
                    <select 
                      value={aiProvider}
                      onChange={(e) => {
                        const provider = e.target.value as AIProvider;
                        setAiProvider(provider);
                        setIsCustomModel(false);
                        if (provider === 'openai') {
                          setScriptModel('gpt-4o');
                          setImageModel('dall-e-3');
                        } else if (provider === 'anthropic') {
                          setScriptModel('claude-3-5-sonnet-20240620');
                          setImageModel('gemini-2.5-flash-image'); // Fallback
                        } else if (provider === 'openrouter') {
                          setScriptModel('google/gemini-2.0-flash-001');
                          setImageModel('gemini-2.5-flash-image'); // Fallback
                        } else {
                          setScriptModel('gemini-2.5-flash');
                          setImageModel('gemini-2.5-flash-image');
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI (GPT/DALL-E)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="openrouter">OpenRouter (All Models)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-white/40">API Key</label>
                      {userApiKey === process.env.GEMINI_API_KEY ? (
                        <span className="text-[10px] text-blue-400 font-bold uppercase">Shared Key</span>
                      ) : (
                        <span className="text-[10px] text-green-400 font-bold uppercase">Custom Key</span>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="password"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        placeholder={`Enter ${aiProvider} API Key...`}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      />
                      {userApiKey !== process.env.GEMINI_API_KEY && (
                        <button 
                          onClick={() => setUserApiKey(process.env.GEMINI_API_KEY || '')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 hover:text-white font-bold"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={testConnection}
                        disabled={isTestingKey}
                        className="text-[10px] text-orange-500 font-bold hover:underline flex items-center gap-1"
                      >
                        {isTestingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Test Connection
                      </button>
                      <a 
                        href="https://aistudio.google.com/app/plan_and_billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-white/40 font-bold hover:text-white flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Check Quota Dashboard
                      </a>
                    </div>
                    {testResult && (
                      <div className={cn(
                        "text-[10px] font-medium p-2 rounded-lg bg-black/20 border border-white/5",
                        testResult.success ? "text-green-400" : "text-red-400"
                      )}>
                        {testResult.message}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-white/20 font-medium">Session Requests:</span>
                      <span className="text-[10px] text-white/40 font-mono">{sessionRequests}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-white/40">Scripting Model</label>
                      <button 
                        onClick={() => setIsCustomModel(!isCustomModel)}
                        className="text-[10px] text-orange-500 font-bold hover:underline"
                      >
                        {isCustomModel ? "Use List" : "Enter Custom"}
                      </button>
                    </div>
                    {isCustomModel ? (
                      <input 
                        type="text"
                        value={scriptModel}
                        onChange={(e) => setScriptModel(e.target.value)}
                        placeholder="Enter model ID (e.g. meta-llama/llama-3-70b)"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      />
                    ) : (
                      <select 
                        value={scriptModel}
                        onChange={(e) => setScriptModel(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none"
                      >
                        {aiProvider === 'gemini' && (
                          <>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced)</option>
                            <option value="gemini-3-flash-preview">Gemini 3 Flash (Fastest)</option>
                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Smartest)</option>
                          </>
                        )}
                        {aiProvider === 'openai' && (
                          <>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                          </>
                        )}
                        {aiProvider === 'anthropic' && (
                          <>
                            <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
                            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                          </>
                        )}
                        {aiProvider === 'openrouter' && (
                          <>
                            <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
                            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                            <option value="deepseek/deepseek-chat">DeepSeek V3</option>
                          </>
                        )}
                      </select>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-white/40">Image Model</label>
                      <button 
                        onClick={() => setIsCustomModel(!isCustomModel)}
                        className="text-[10px] text-orange-500 font-bold hover:underline"
                      >
                        {isCustomModel ? "Use List" : "Enter Custom"}
                      </button>
                    </div>
                    {isCustomModel ? (
                      <input 
                        type="text"
                        value={imageModel}
                        onChange={(e) => setImageModel(e.target.value)}
                        placeholder="Enter image model ID"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      />
                    ) : (
                      <select 
                        value={imageModel}
                        onChange={(e) => setImageModel(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none"
                      >
                        {aiProvider === 'openai' ? (
                          <option value="dall-e-3">DALL-E 3</option>
                        ) : (
                          <>
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                            <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image Pro</option>
                          </>
                        )}
                      </select>
                    )}
                    {aiProvider === 'gemini' && (
                      <p className="text-[10px] text-white/30 italic px-1">
                        Note: Image generation may be restricted on some free tier accounts or regions.
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <div 
                      onClick={() => setSkipFailedImages(!skipFailedImages)}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div 
                        className={clsx(
                          "w-10 h-5 rounded-full transition-colors relative",
                          skipFailedImages ? "bg-orange-500" : "bg-white/10"
                        )}
                      >
                        <div className={clsx(
                          "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                          skipFailedImages ? "left-6" : "left-1"
                        )} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">Skip Failed Images</span>
                        <span className="text-[10px] text-white/40">If generation fails, use a placeholder and continue.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-12 gap-12">
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-8">
          <section className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">AI Shorts Generator</h2>
              <p className="text-white/50">Create multi-scene shorts with voiceovers and background music.</p>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 block">Select Niche</label>
              <div className="grid grid-cols-2 gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n}
                    onClick={() => { setNiche(n); setCustomNiche(''); }}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left",
                      niche === n 
                        ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Or enter custom niche..."
                  value={customNiche}
                  onChange={(e) => { setCustomNiche(e.target.value); setNiche(''); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
                <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 block">Select Language</label>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLanguage(l); setCustomLanguage(''); }}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left",
                      language === l 
                        ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Or enter custom language..."
                  value={customLanguage}
                  onChange={(e) => { setCustomLanguage(e.target.value); setLanguage(''); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
                <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 block">Voice Personality</label>
              <div className="grid grid-cols-1 gap-2">
                {VOICES.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <button
                      onClick={() => setVoice(v)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition-all text-left flex items-center justify-between",
                        voice === v 
                          ? "bg-white text-black border-white" 
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                      )}
                    >
                      {v}
                      {voice === v && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => previewVoice(v)}
                      disabled={isPreviewingVoice !== null}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                      title="Preview Voice"
                    >
                      {isPreviewingVoice === v ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 block">End Card Info</label>
              <div className="flex flex-col gap-3">
                <input 
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Channel/Account Name..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="platform" 
                      value="youtube" 
                      checked={platform === 'youtube'}
                      onChange={() => setPlatform('youtube')}
                      className="hidden"
                    />
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                      platform === 'youtube' ? "border-red-500 bg-red-500/20" : "border-white/10"
                    )}>
                      {platform === 'youtube' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    </div>
                    <span className={cn("text-xs font-medium transition-colors", platform === 'youtube' ? "text-white" : "text-white/40")}>YouTube</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="platform" 
                      value="instagram" 
                      checked={platform === 'instagram'}
                      onChange={() => setPlatform('instagram')}
                      className="hidden"
                    />
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                      platform === 'instagram' ? "border-pink-500 bg-pink-500/20" : "border-white/10"
                    )}>
                      {platform === 'instagram' && <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />}
                    </div>
                    <span className={cn("text-xs font-medium transition-colors", platform === 'instagram' ? "text-white" : "text-white/40")}>Instagram</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 block">Background Music</label>
              <div className="grid grid-cols-1 gap-2">
                {BACKGROUND_MUSIC.map((m) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <button
                      onClick={() => setMusicUrl(m.url)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition-all text-left flex items-center justify-between",
                        musicUrl === m.url 
                          ? "bg-white text-black border-white" 
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4" />
                        {m.name}
                      </div>
                      {musicUrl === m.url && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    {m.url && (
                      <button
                        onClick={() => previewMusic(m.url)}
                        className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                        title="Preview Music"
                      >
                        {isPreviewingMusic === m.url ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))}

                {customMusic && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMusicUrl(customMusic.url)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl text-sm font-semibold border transition-all text-left flex items-center justify-between",
                        musicUrl === customMusic.url 
                          ? "bg-white text-black border-white" 
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{customMusic.name}</span>
                      </div>
                      {musicUrl === customMusic.url && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => previewMusic(customMusic.url)}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      {isPreviewingMusic === customMusic.url ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}

                <div className="mt-2">
                  <input 
                    type="file" 
                    accept="audio/mp3,audio/*" 
                    id="custom-music-upload" 
                    className="hidden" 
                    onChange={handleCustomMusicUpload}
                  />
                  <label 
                    htmlFor="custom-music-upload"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all cursor-pointer text-sm font-bold"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Custom MP3
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={generateFullShort}
              disabled={status !== 'idle' && status !== 'done' && status !== 'error'}
              className="w-full py-5 bg-white text-black font-bold rounded-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
            >
              {status === 'idle' || status === 'done' || status === 'error' ? (
                <>
                  <Play className="w-6 h-6 fill-current" />
                  Generate Short
                </>
              ) : (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {status === 'scripting' && "Translating & Scripting..."}
                  {status === 'voiceover' && "Introducing & Speaking..."}
                  {status === 'visual' && `Creating Visuals (${images.length}/${script?.segments.length || '?'})`}
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
          </section>

          {/* Progress Tracker */}
          {status !== 'idle' && (
            <section className="space-y-4 p-6 bg-white/5 rounded-3xl border border-white/10">
              <div className="flex justify-between items-end">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Generation Progress</h3>
                <span className="text-2xl font-mono font-bold">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-orange-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="space-y-3 pt-2">
                <Step icon={<Type />} label="Translate & Script" active={status === 'scripting'} done={['voiceover', 'visual', 'done'].includes(status)} />
                <Step icon={<Mic />} label="Introduce & Speak" active={status === 'voiceover'} done={['visual', 'done'].includes(status)} />
                <Step icon={<Video />} label="Visual Production" active={status === 'visual'} done={status === 'done'} />
              </div>
              {status === 'done' && (
                <div className="pt-4">
                  <button 
                    onClick={togglePlayback}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    {isPlaying ? 'Pause Preview' : 'Play Preview'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-7">
          <div className="sticky top-28">
            {status !== 'done' ? (
              <div className="aspect-[9/16] max-w-[400px] mx-auto bg-black/40 border border-white/5 rounded-[40px] flex flex-col items-center justify-center p-12 text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white/20" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Preview Locked</h3>
                  <p className="text-sm text-white/40">Complete the generation to unlock the preview and export options.</p>
                </div>
                {status !== 'idle' && (
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                {/* Badges in Locked State */}
                <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
                  {langMessage && (
                    <div className="px-3 py-1 bg-emerald-500/90 backdrop-blur-md rounded-full border border-emerald-400/20 flex items-center gap-2">
                      <Check className="w-3 h-3 text-white" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white">{langMessage}</span>
                    </div>
                  )}
                  {status !== 'idle' && (
                    <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Processing</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-[9/16] max-w-[400px] mx-auto bg-[#111] rounded-[40px] border-[8px] border-[#222] shadow-2xl overflow-hidden relative group">
              {/* Hidden Canvas for Recording */}
              <canvas 
                ref={canvasRef} 
                width={720} 
                height={1280} 
                className="hidden"
              />

              {images.length > 0 ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentSegmentIndex}
                      src={images[currentSegmentIndex] || images[0]}
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </AnimatePresence>

                  {audioUrl && (
                    <audio 
                      ref={audioRef}
                      autoPlay 
                      src={audioUrl} 
                      className="hidden"
                      crossOrigin="anonymous"
                    />
                  )}
                  {musicUrl && (
                    <audio 
                      ref={musicRef}
                      autoPlay 
                      loop
                      src={musicUrl} 
                      className="hidden"
                      crossOrigin="anonymous"
                      onPlay={(e) => (e.currentTarget.volume = 0.2)}
                    />
                  )}

                  {/* Captions Overlay */}
                  <div className="absolute inset-x-0 bottom-24 px-8 text-center pointer-events-none">
                    <AnimatePresence mode="wait">
                      {script && script.segments[currentSegmentIndex] && (
                        <motion.p
                          key={currentSegmentIndex}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-white font-black text-2xl uppercase tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] leading-tight"
                        >
                          {script.segments[currentSegmentIndex].text}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Controls Overlay */}
                  <div className={cn(
                    "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center gap-4",
                    audioUrl ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {audioUrl && (
                      <button 
                        onClick={togglePlayback}
                        className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform shadow-xl"
                      >
                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                      </button>
                    )}
                    {audioUrl && (
                      <button 
                        onClick={downloadAsVideo}
                        disabled={isRecording}
                        className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform disabled:opacity-50 shadow-xl"
                      >
                        {isRecording ? <Loader2 className="w-8 h-8 animate-spin" /> : <Download className="w-8 h-8" />}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                    <Video className="w-10 h-10 text-white/20" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-white/40 font-medium">Short Preview</p>
                    <p className="text-white/20 text-xs">Your multi-scene AI Short will appear here with music and voiceover.</p>
                  </div>
                </div>
              )}

              {/* Status Badge in Ready State */}
              {langMessage && (
                <div className="absolute top-6 left-6 px-3 py-1 bg-emerald-500/90 backdrop-blur-md rounded-full border border-emerald-400/20 flex items-center gap-2 z-10">
                  <Check className="w-3 h-3 text-white" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white">{langMessage}</span>
                </div>
              )}
            </div>
          )}

            {/* Script & Metadata Preview */}
            {script && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 space-y-6"
              >
                {/* YouTube Metadata */}
                <div className="p-6 bg-orange-500/10 rounded-3xl border border-orange-500/20 space-y-4">
                  <div className="flex items-center gap-2 text-orange-500">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="text-sm font-bold uppercase tracking-widest">Upload Metadata</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block">Catchy Title</label>
                        <button 
                          onClick={() => copyToClipboard(script.caption, 'title')}
                          className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white"
                        >
                          {copiedType === 'title' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm font-medium text-white/90 bg-black/20 p-3 rounded-xl border border-white/5">{script.caption}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-white/40 block">Recommended Tags</label>
                        <button 
                          onClick={() => copyToClipboard(script.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '), 'tags')}
                          className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white"
                        >
                          {copiedType === 'tags' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {script.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-mono text-white/60 border border-white/10">
                            #{tag.replace(/\s+/g, '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Script */}
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Full Script</h3>
                  </div>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {script.segments.map((seg, i) => (
                      <div key={i} className={cn(
                        "group relative flex gap-4 p-4 rounded-2xl transition-all border",
                        currentSegmentIndex === i 
                          ? "bg-orange-500/10 border-orange-500/20" 
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      )}>
                        {/* Image Preview & Actions */}
                        <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-white/10">
                          <img 
                            src={images[i]} 
                            alt={`Scene ${i+1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <button 
                              onClick={() => regenerateImage(i)}
                              disabled={isRegeneratingImage !== null}
                              className="p-1.5 bg-white/10 rounded-lg hover:bg-orange-500 transition-colors"
                              title="Regenerate"
                            >
                              {isRegeneratingImage === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            </button>
                            <label className="p-1.5 bg-white/10 rounded-lg hover:bg-orange-500 transition-colors cursor-pointer" title="Upload">
                              <Upload className="w-3 h-3" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleImageUpload(i, e)}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Text */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500/60">Scene {i+1}</span>
                            {currentSegmentIndex === i && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                Playing
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed text-white/80 line-clamp-3">{seg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 text-center">
        <p className="text-white/20 text-xs uppercase tracking-[0.2em]">Anirudh Sai Manepalli</p>
      </footer>
    </div>
  );
}

function Step({ icon, label, active, done }: { icon: React.ReactNode, label: string, active: boolean, done: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 transition-all",
      active ? "text-white" : done ? "text-green-500" : "text-white/20"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
        active ? "bg-white/10 border-white/20" : done ? "bg-green-500/10 border-green-500/20" : "bg-transparent border-white/5"
      )}>
        {done ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <span className="text-sm font-medium">{label}</span>
      {active && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
    </div>
  );
}
