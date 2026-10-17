import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, Check, ChevronDown, CircleAlert, Clock3,
  Download, Dumbbell, History, Play, Plus, RotateCcw, Search, ShieldCheck, Smartphone, Sparkles,
  Square, Trash2, Upload, Video, X,
} from 'lucide-react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { categories, getSkill, skills } from './data/skills'
import { formatTime, SkillAnalyzer } from './lib/analyzer'
import { detectPose, loadPoseLandmarker } from './lib/pose'
import { clearSessions, deleteSession, listSessions, saveSession } from './lib/storage'
import type { AnalysisReport, LiveMetrics, PosePoint, Skill, TrainingSession } from './types'
import './App.css'

type Screen = 'home' | 'select' | 'session' | 'report' | 'history'
type MediaMode = 'camera' | 'upload'
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const initialMetrics: LiveMetrics = { confidence: 0, validReps: 0, partialReps: 0, currentHold: 0, longestHold: 0, totalHold: 0 }
const emptyReport = (): AnalysisReport => ({
  score: null, confidence: 0, insufficientConfidence: true, framesAnalyzed: 0, validReps: 0, partialReps: 0,
  longestHold: 0, totalHold: 0, repConfidence: [], criteria: [], issues: [], positives: [], suggestions: [], timestampExamples: [],
})
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)
const navItems = [
  { id: 'home' as const, label: 'Overview', icon: Activity },
  { id: 'select' as const, label: 'Analyze skill', icon: Plus },
  { id: 'history' as const, label: 'Training log', icon: History },
]
const skeletonLinks = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]]

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [targetReps, setTargetReps] = useState(5)
  const [targetHold, setTargetHold] = useState(20)
  const [measureHold, setMeasureHold] = useState(true)
  const [positionTolerance, setPositionTolerance] = useState(25)
  const [smoothingStrength, setSmoothingStrength] = useState(65)
  const [focus, setFocus] = useState('')
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState('')
  const [pwaError, setPwaError] = useState('')
  const [offlineReady, setOfflineReady] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment')
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [metrics, setMetrics] = useState<LiveMetrics>(initialMetrics)
  const [landmarks, setLandmarks] = useState<PosePoint[] | null>(null)
  const [poseVideoSize, setPoseVideoSize] = useState({ width: 0, height: 0 })
  const [mediaMode, setMediaMode] = useState<MediaMode>('camera')
  const [uploadedVideo, setUploadedVideo] = useState<Blob | null>(null)
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [historySkill, setHistorySkill] = useState('all')
  const [historyCategory, setHistoryCategory] = useState('all')
  const [historyPeriod, setHistoryPeriod] = useState('all')
  const [historyAnchor] = useState(() => Date.now())

  const cameraRef = useRef<HTMLVideoElement>(null)
  const uploadRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const analyzerRef = useRef<SkillAnalyzer | null>(null)
  const analysisSetupRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const pausedRef = useRef(false)
  const countdownTimerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onOfflineReady: () => setOfflineReady(true),
    onRegisterError: (reason: unknown) => {
      console.error('Service worker registration failed.', reason)
      setPwaError('Offline support could not be enabled. The app remains available online; check the secure HTTPS deployment.')
    },
  })

  useEffect(() => {
    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const syncInstalledState = () => setAppInstalled(isStandalone())
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onAppInstalled = () => {
      setAppInstalled(true)
      setInstallPrompt(null)
      setShowInstallHelp(false)
    }

    syncInstalledState()
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    listSessions().then((saved) => setSessions(saved.sort((a, b) => b.date.localeCompare(a.date)))).catch((reason: unknown) => {
      console.error('Could not load local training history.', reason)
      setError('Training history could not be read from this browser.')
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current)
    }
  }, [])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!recording || paused) return
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording, paused])

  const uploadedUrl = useMemo(() => uploadedVideo ? URL.createObjectURL(uploadedVideo) : '', [uploadedVideo])
  useEffect(() => () => { if (uploadedUrl) URL.revokeObjectURL(uploadedUrl) }, [uploadedUrl])

  const filteredSkills = useMemo(() => skills.filter((skill) =>
    (category === 'all' || skill.category === category) &&
    `${skill.name} ${skill.categoryName}`.toLowerCase().includes(query.toLowerCase()),
  ), [category, query])

  const recentSessions = sessions.slice(0, 4)
  const bestScore = sessions.reduce((best, session) => Math.max(best, session.report.score ?? 0), 0)
  const bestHold = sessions.reduce((best, session) => Math.max(best, session.report.longestHold), 0)
  const filteredHistory = sessions.filter((session) => {
    const days = historyPeriod === 'all' ? 0 : Number(historyPeriod)
    const inPeriod = days === 0 || historyAnchor - new Date(session.date).getTime() <= days * 24 * 60 * 60 * 1000
    return (historySkill === 'all' || session.skillId === historySkill) &&
      (historyCategory === 'all' || session.category === historyCategory) && inPeriod
  })

  const chooseSkill = (skill: Skill) => {
    setSelectedSkill(skill)
    setMeasureHold(skill.type !== 'dynamic')
    setScreen('session')
    setError('')
  }

  const stopInference = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    lastVideoTimeRef.current = -1
    setAnalysisRunning(false)
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
    if (cameraRef.current) cameraRef.current.srcObject = null
  }, [])

  const navigateTo = (destination: Screen) => {
    if (recording || analysisRunning || countdown > 0 || loading) {
      setError('Finish or stop the active analysis before leaving this screen.')
      return
    }
    stopInference()
    stopCamera()
    setScreen(destination)
  }

  const installApp = async () => {
    if (!installPrompt) {
      setShowInstallHelp((visible) => !visible)
      return
    }
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') setAppInstalled(true)
      setInstallPrompt(null)
    } catch (reason) {
      console.error('App installation prompt failed.', reason)
      setPwaError('The browser could not open its install prompt. Use the browser menu to install this app.')
    }
  }

  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported by this browser. Upload a video instead.')
      return
    }
    if (!window.isSecureContext) {
      setError('Camera access requires HTTPS or localhost. Open this app on a secure connection, or upload a video.')
      return
    }
    setLoading(true)
    setLoadingMessage('Requesting camera access…')
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setCameraFacing(facing)
      setMediaMode('camera')
      setCameraActive(true)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream
        await cameraRef.current.play()
      }
    } catch (reason) {
      console.error('Camera initialization failed.', reason)
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in browser settings or upload a video.'
        : 'Could not start the camera. Check that another app is not using it, or upload a video instead.')
      setCameraActive(false)
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const ensurePoseModel = async () => {
    if (landmarkerRef.current) return landmarkerRef.current
    const landmarker = await loadPoseLandmarker(setLoadingMessage)
    landmarkerRef.current = landmarker
    return landmarker
  }

  const inferenceLoop = (video: HTMLVideoElement, time: () => number) => {
    stopInference()
    setPoseVideoSize({ width: video.videoWidth, height: video.videoHeight })
    setAnalysisRunning(true)
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      if (pausedRef.current || !landmarkerRef.current || !analyzerRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
      if (video.currentTime === lastVideoTimeRef.current) return
      lastVideoTimeRef.current = video.currentTime
      try {
        const points = detectPose(landmarkerRef.current, video)
        setLandmarks(points)
        setMetrics(analyzerRef.current.consume(points, time()))
      } catch (reason) {
        console.error('Pose inference failed.', reason)
        setError('Pose analysis stopped unexpectedly. You can still save this session without a technique score.')
        stopInference()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const createAndSaveSession = async (video?: Blob) => {
    const report = analyzerRef.current?.report() ?? emptyReport()
    const session: TrainingSession = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      skillId: selectedSkill?.id ?? '',
      skillName: selectedSkill?.name ?? 'Unknown skill',
      category: selectedSkill?.category ?? 'handstand',
      report,
      settings: { targetReps, measureHold, targetHold, focus, positionTolerance, smoothingStrength },
      ...(video ? { video } : {}),
    }
    setActiveSession(session)
    try {
      await saveSession(session)
      setSessions((previous) => [session, ...previous])
    } catch (reason) {
      console.error('Could not save training session locally.', reason)
      setSessions((previous) => [session, ...previous])
      setError('The report is ready, but browser storage could not save it. Your recording may exceed available local storage.')
    }
    stopInference()
    stopCamera()
    setRecording(false)
    setPaused(false)
    setCountdown(0)
    setScreen('report')
  }

  const beginRecording = async () => {
    if (analysisSetupRef.current) return
    if (!selectedSkill || !cameraRef.current || !cameraActive) {
      setError('Select a skill and start the camera before recording.')
      return
    }
    analysisSetupRef.current = true
    setError('')
    setLoading(true)
    setLoadingMessage('Preparing pose analysis…')
    try {
      await ensurePoseModel()
      analyzerRef.current = new SkillAnalyzer(selectedSkill, { targetReps, measureHold, targetHold, focus, positionTolerance, smoothingStrength })
      setMetrics(initialMetrics)
      setElapsed(0)
      setLandmarks(null)
      setCountdown(3)
      let remaining = 3
      countdownTimerRef.current = window.setInterval(() => {
        remaining -= 1
        setCountdown(Math.max(remaining, 0))
        if (remaining <= 0) {
          if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
          const stream = streamRef.current
          if (!stream || !cameraRef.current) {
            setError('The camera disconnected before recording began.')
            setCountdown(0)
            return
          }
          chunksRef.current = []
          if (typeof MediaRecorder !== 'undefined') {
            try {
              const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
              recorderRef.current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
              recorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data)
              }
              recorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'video/webm' })
                void createAndSaveSession(blob.size > 0 ? blob : undefined)
              }
              recorderRef.current.start(500)
              setRecording(true)
            } catch (reason) {
              console.error('MediaRecorder failed to start.', reason)
              setError('Recording is not supported in this browser. You can still analyze the live camera feed, then stop to save the report.')
              setRecording(true)
            }
          } else {
            setError('This browser cannot save video recordings; live pose analysis is still available.')
            setRecording(true)
          }
          startedAtRef.current = performance.now()
          inferenceLoop(cameraRef.current, () => (performance.now() - startedAtRef.current) / 1000)
        }
      }, 1000)
    } catch (reason) {
      console.error('Pose model could not be initialized.', reason)
      setError(`Pose analysis could not initialize from the app's local assets. Check the deployed site's models/pose_landmarker_lite.task and mediapipe/wasm files. ${errorMessage(reason)}`)
      setCountdown(0)
    } finally {
      analysisSetupRef.current = false
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const pauseRecording = () => {
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.pause()
      setPaused(true)
    } catch (reason) {
      console.error('Could not pause recording.', reason)
      setError('Recording could not be paused by this browser.')
    }
  }

  const resumeRecording = () => {
    try {
      if (recorderRef.current?.state === 'paused') recorderRef.current.resume()
      setPaused(false)
    } catch (reason) {
      console.error('Could not resume recording.', reason)
      setError('Recording could not be resumed by this browser.')
    }
  }

  const stopRecording = () => {
    stopInference()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    else void createAndSaveSession()
  }

  const selectVideo = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Choose a supported video file.')
      return
    }
    setError('')
    stopCamera()
    setMediaMode('upload')
    setUploadedVideo(file)
    setLandmarks(null)
    setPoseVideoSize({ width: 0, height: 0 })
    setMetrics(initialMetrics)
    analyzerRef.current = null
  }

  const analyzeUploadedVideo = async () => {
    if (analysisSetupRef.current) return
    const video = uploadRef.current
    if (!selectedSkill || !video || !uploadedVideo) return
    analysisSetupRef.current = true
    setError('')
    setLoading(true)
    setLoadingMessage('Preparing local pose analysis…')
    try {
      await ensurePoseModel()
      analyzerRef.current = new SkillAnalyzer(selectedSkill, { targetReps, measureHold, targetHold, focus, positionTolerance, smoothingStrength })
      setMetrics(initialMetrics)
      setLandmarks(null)
      await video.play()
      inferenceLoop(video, () => video.currentTime)
    } catch (reason) {
      console.error('Uploaded video analysis failed.', reason)
      setError(`Could not start pose analysis for this video. Check that it is a supported MP4 or WebM and that the local pose assets loaded. ${errorMessage(reason)}`)
    } finally {
      analysisSetupRef.current = false
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const finishUploadedAnalysis = () => {
    if (!analyzerRef.current) return
    stopInference()
    void createAndSaveSession(uploadedVideo ?? undefined)
  }

  const showHistory = () => setScreen('history')

  const removeSession = async (id: string) => {
    try {
      await deleteSession(id)
      setSessions((previous) => previous.filter((session) => session.id !== id))
      if (activeSession?.id === id) setActiveSession(null)
    } catch (reason) {
      console.error('Could not delete training session.', reason)
      setError('Could not delete this session from local storage.')
    }
  }

  const removeAllSessions = async () => {
    if (!window.confirm('Delete all locally stored training sessions and videos? This cannot be undone.')) return
    try {
      await clearSessions()
      setSessions([])
      setActiveSession(null)
    } catch (reason) {
      console.error('Could not clear training history.', reason)
      setError('Could not clear local training history.')
    }
  }

  const resetWorkflow = () => {
    stopInference()
    stopCamera()
    setSelectedSkill(null)
    setActiveSession(null)
    setUploadedVideo(null)
    setScreen('select')
    setError('')
  }

  const openSession = (session: TrainingSession) => {
    setActiveSession(session)
    setScreen('report')
  }

  const sessionVideo = activeSession?.video
  const videoUrl = useMemo(() => sessionVideo ? URL.createObjectURL(sessionVideo) : '', [sessionVideo])
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])
  const poseVideoWidth = poseVideoSize.width || 1
  const poseVideoHeight = poseVideoSize.height || 1

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigateTo('home')} aria-label="CaliTracker home">
          <span className="brand-mark"><Activity size={20} strokeWidth={2.5} /></span>
          <span>CALITRACKER</span>
        </button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => navigateTo(id)}>
              <Icon size={18} /><span>{label}</span>
              {id === 'history' && sessions.length > 0 && <span className="nav-count">{sessions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={17} />
            <div><strong>Your data stays yours</strong><span>Analysis runs on this device.</span></div>
          </div>
          <div className="profile-mini"><div className="avatar">A</div><div><strong>Athlete</strong><span>Personal workspace</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>TRAINING</span><span className="crumb-slash">/</span><strong>{screen === 'home' ? 'Overview' : screen === 'select' ? 'Skill library' : screen === 'session' ? 'New analysis' : screen === 'report' ? 'Session report' : 'Training log'}</strong></div>
          <div className="topbar-actions">
            {!appInstalled && <button className="topbar-cta install-action" onClick={() => void installApp()} aria-label={installPrompt ? 'Install CaliTracker' : 'Show installation instructions'}><Download size={15} /><span>{installPrompt ? 'Install app' : 'Install'}</span></button>}
            <button className="topbar-cta" onClick={() => { setError(''); navigateTo('select') }}><Plus size={16} /> New analysis</button>
          </div>
        </header>

        {showInstallHelp && !appInstalled && <div className="pwa-notice" role="status"><Smartphone size={17} /><span>To install, open this site’s browser menu and choose “Install app” or “Add to Home screen”. Installation requires HTTPS.</span><button aria-label="Dismiss installation instructions" onClick={() => setShowInstallHelp(false)}><X size={16} /></button></div>}
        {offlineReady && <div className="pwa-notice" role="status"><ShieldCheck size={17} /><span>The app shell is available offline. Pose model files are cached after they are first loaded while online.</span><button aria-label="Dismiss offline status" onClick={() => setOfflineReady(false)}><X size={16} /></button></div>}
        {needRefresh && <div className="pwa-notice" role="status"><RotateCcw size={17} /><span>An app update is ready. Finish any active recording before updating.</span><button className="pwa-update" onClick={() => void updateServiceWorker(true)} disabled={recording || analysisRunning || countdown > 0 || loading}>Update now</button><button aria-label="Dismiss update notice" onClick={() => setNeedRefresh(false)}><X size={16} /></button></div>}
        {pwaError && <div className="global-alert" role="alert"><CircleAlert size={17} /><span>{pwaError}</span><button aria-label="Dismiss offline support error" onClick={() => setPwaError('')}><X size={16} /></button></div>}
        {error && <div className="global-alert" role="alert"><CircleAlert size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}

        {screen === 'home' && (
          <section className="page-content">
            <div className="welcome-row">
              <div><div className="eyebrow"><span className="live-dot" /> YOUR PERSONAL MOVEMENT LAB</div><h1>Train with <em>intention.</em></h1><p className="lede">Build strength skill by skill. Your progress, measured on your terms.</p></div>
              <button className="button-primary welcome-action" onClick={() => setScreen('select')}><Plus size={18} /> Start a session <ArrowRight size={16} /></button>
            </div>
            <div className="stat-grid">
              <StatCard label="Sessions logged" value={String(sessions.length).padStart(2, '0')} note="On this device" icon={<Dumbbell size={18} />} />
              <StatCard label="Best technique score" value={bestScore ? `${bestScore}` : '—'} suffix={bestScore ? '/ 100' : ''} note={bestScore ? 'Across analyzed sessions' : 'Complete your first analysis'} icon={<Sparkles size={18} />} />
              <StatCard label="Longest valid hold" value={bestHold ? formatTime(bestHold) : '—'} note="Personal best · technique-qualified" icon={<Clock3 size={18} />} />
            </div>
            <div className="home-grid">
              <section className="panel progress-panel">
                <div className="panel-heading"><div><div className="eyebrow">YOUR JOURNEY</div><h2>Recent sessions</h2></div><button className="text-button" onClick={showHistory}>View all <ArrowRight size={15} /></button></div>
                {recentSessions.length ? <div className="session-list">
                  {recentSessions.map((session) => <SessionRow key={session.id} session={session} onClick={() => openSession(session)} />)}
                </div> : <EmptyState title="Your training starts here" text="Run your first skill analysis to build a personal progress timeline." action="Choose a skill" onClick={() => setScreen('select')} />}
                {sessions.some((session) => session.report.score !== null) && <ScoreTrend sessions={sessions} />}
              </section>
              <section className="panel spotlight-panel">
                <div className="eyebrow">BUILT FOR YOUR NEXT REP</div><h2>One camera.<br /><em>Better awareness.</em></h2>
                <p>Get a consistent view of body-line alignment, movement phases and hold time — right from your phone.</p>
                <div className="spotlight-stats"><div><Activity size={16} /><span>Pose tracking</span></div><div><ShieldCheck size={16} /><span>Private by design</span></div></div>
                <button className="spotlight-link" onClick={() => setScreen('select')}>Explore skill library <ArrowRight size={16} /></button>
                <div className="spotlight-orbit orbit-one" /><div className="spotlight-orbit orbit-two" /><div className="spotlight-core"><Activity size={38} /></div>
              </section>
            </div>
            <div className="section-heading"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Explore progressions</h2></div><button className="text-button" onClick={() => setScreen('select')}>All skills <ArrowRight size={15} /></button></div>
            <div className="quick-skills">{skills.slice(0, 4).map((skill, index) => <button className="quick-skill" key={skill.id} onClick={() => chooseSkill(skill)}><span className={`skill-number n-${index + 1}`}>0{index + 1}</span><span><strong>{skill.name}</strong><small>{skill.categoryName} · Level {skill.level}</small></span><ArrowRight size={16} /></button>)}</div>
          </section>
        )}

        {screen === 'select' && (
          <section className="page-content">
            <div className="page-heading"><div><div className="eyebrow">BUILD YOUR SESSION</div><h1>Choose your <em>skill.</em></h1><p className="lede">Select a specific progression before recording. Each skill has its own movement checks.</p></div></div>
            <div className="library-tools"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills…" aria-label="Search skills" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
              <div className="category-pills">{categories.map((item) => <button key={item.id} className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>
            </div>
            {categories.filter((item) => item.id !== 'all' && (category === 'all' || category === item.id)).map((item) => {
              const group = filteredSkills.filter((skill) => skill.category === item.id)
              if (!group.length) return null
              return <div className="skill-group" key={item.id}><div className="group-title"><span className="category-indicator" />{item.label}<span className="group-count">{String(group.length).padStart(2, '0')}</span></div><div className="skill-grid">
                {group.map((skill) => <SkillCard key={skill.id} skill={skill} onChoose={() => chooseSkill(skill)} />)}
              </div></div>
            })}
            {filteredSkills.length === 0 && <EmptyState title="No matching skills" text="Try a different search term or category." action="Clear filters" onClick={() => { setQuery(''); setCategory('all') }} />}
          </section>
        )}

        {screen === 'session' && selectedSkill && (
          <section className="page-content session-page">
            <div className="page-heading compact-heading">            <div><button className="back-link" onClick={() => navigateTo('select')}>← Skill library</button><div className="eyebrow">{selectedSkill.categoryName.toUpperCase()} · LEVEL {selectedSkill.level}</div><h1>{selectedSkill.name}</h1><p className="lede">{selectedSkill.description}</p></div></div>
            <div className="session-layout">
              <div className="session-left">
                <div className="camera-stage">
                  {mediaMode === 'camera' ? <video ref={cameraRef} className="preview-video" autoPlay muted playsInline /> : <video ref={uploadRef} className="preview-video" src={uploadedUrl} controls playsInline onEnded={finishUploadedAnalysis} />}
                  <div className="camera-vignette" />
                  {landmarks && (cameraActive || analysisRunning) && <svg className="skeleton-overlay" viewBox={`0 0 ${poseVideoWidth} ${poseVideoHeight}`} preserveAspectRatio="xMidYMid meet" aria-label="Detected pose overlay">{skeletonLinks.map(([a, b]) => {
                    const pointA = landmarks[a]; const pointB = landmarks[b]
                    return pointA && pointB && pointA.visibility > 0.35 && pointB.visibility > 0.35 ? <line key={`${a}-${b}`} x1={pointA.x * poseVideoWidth} y1={pointA.y * poseVideoHeight} x2={pointB.x * poseVideoWidth} y2={pointB.y * poseVideoHeight} /> : null
                  })}{landmarks.map((point, index) => point.visibility > 0.45 ? <circle key={index} cx={point.x * poseVideoWidth} cy={point.y * poseVideoHeight} r={poseVideoWidth * .009} /> : null)}</svg>}
                  {!cameraActive && mediaMode === 'camera' && <div className="camera-placeholder"><div className="camera-placeholder-icon"><Video size={26} /></div><strong>Set up your camera</strong><span>Position your phone so your full body stays in frame.</span><button className="button-primary" onClick={() => void startCamera()} disabled={loading}><Video size={16} /> Enable camera</button></div>}
                  {mediaMode === 'upload' && !uploadedUrl && <div className="camera-placeholder"><div className="camera-placeholder-icon"><Upload size={26} /></div><strong>Choose a video</strong><span>MP4 and WebM are supported where your browser can decode them.</span><button className="button-primary" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Browse files</button></div>}
                  {cameraActive && <div className="camera-topline"><span><i className={recording ? 'recording-dot' : 'ready-dot'} />{recording ? paused ? 'PAUSED' : 'RECORDING' : analysisRunning ? 'ANALYZING' : 'CAMERA READY'}</span><span>FULL BODY · SIDE VIEW</span></div>}
                  {countdown > 0 && <div className="countdown-overlay"><span>GET READY</span><strong>{countdown}</strong></div>}
                  {paused && <div className="paused-overlay"><span>RECORDING PAUSED</span></div>}
                  {recording && <div className="recording-clock"><span className="recording-dot" /> REC&nbsp; {formatTime(elapsed)}</div>}
                  {analysisRunning && <div className="live-metric-chip">{selectedSkill.type === 'dynamic' ? <><span>REPS</span><strong>{metrics.validReps}</strong></> : <><span>HOLD</span><strong>{formatTime(metrics.currentHold)}</strong></>}</div>}
                </div>
                <div className="camera-controls">
                  {mediaMode === 'camera' ? <>
                    <button className="camera-switch" onClick={() => void startCamera(cameraFacing === 'environment' ? 'user' : 'environment')} disabled={!cameraActive || recording || loading}><RotateCcw size={16} /> Flip camera</button>
                    {!cameraActive ? <button className="button-primary" onClick={() => void startCamera()} disabled={loading}>{loading ? <><span className="spinner" />{loadingMessage}</> : <><Video size={16} /> Start camera</>}</button>
                      : !recording ? <button className="button-primary record-button" onClick={() => void beginRecording()} disabled={loading || countdown > 0}>{loading ? <><span className="spinner" />{loadingMessage || 'Loading model…'}</> : <><span className="record-dot" /> Record session</>}</button>
                        : <div className="record-buttons">{paused ? <button className="button-primary" onClick={resumeRecording}><Play size={15} /> Resume</button> : <button className="button-secondary" onClick={pauseRecording}><span className="pause-symbol" /> Pause</button>}<button className="button-danger" onClick={stopRecording}><Square size={14} fill="currentColor" /> Finish</button></div>}
                    <button className="upload-inline" onClick={() => fileInputRef.current?.click()} disabled={recording || loading}><Upload size={16} /> Upload</button>
                  </> : <>
                    <button className="camera-switch" onClick={() => { setMediaMode('camera'); setUploadedVideo(null) }} disabled={loading}><Video size={16} /> Use camera</button>
                    <button className="button-primary" onClick={() => analysisRunning ? finishUploadedAnalysis() : void analyzeUploadedVideo()} disabled={loading || !uploadedUrl}>{loading ? <><span className="spinner" />{loadingMessage}</> : analysisRunning ? <><Square size={14} fill="currentColor" /> Finish analysis</> : <><Activity size={16} /> Analyze video</>}</button>
                    <button className="upload-inline" onClick={() => fileInputRef.current?.click()} disabled={loading}><Upload size={16} /> Replace</button>
                  </>}
                  <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={(event) => { selectVideo(event.target.files?.[0]); event.target.value = '' }} />
                </div>
                {analysisRunning && <div className="live-readout"><div><span>POSE CONFIDENCE</span><strong>{Math.round(metrics.confidence * 100)}%</strong></div><div><span>{selectedSkill.type === 'dynamic' ? 'COMPLETED REPS' : 'LONGEST HOLD'}</span><strong>{selectedSkill.type === 'dynamic' ? metrics.validReps : formatTime(metrics.longestHold)}</strong></div><div><span>VALID HOLD TIME</span><strong>{formatTime(metrics.totalHold)}</strong></div></div>}
                <div className="camera-note"><ShieldCheck size={16} /><span>Video analysis runs locally on this device. No video is uploaded.</span></div>
              </div>
              <aside className="session-right">
                <section className="panel setup-panel"><div className="panel-heading"><div><div className="eyebrow">SESSION SETUP</div><h2>Make it yours</h2></div></div>
                  {selectedSkill.type === 'dynamic' && <div className="form-row"><label htmlFor="target-reps">Rep target</label><div className="number-control"><button onClick={() => setTargetReps(Math.max(1, targetReps - 1))} aria-label="Decrease rep target">−</button><input id="target-reps" type="number" min="1" max="50" value={targetReps} onChange={(event) => setTargetReps(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} /><button onClick={() => setTargetReps(Math.min(50, targetReps + 1))} aria-label="Increase rep target">+</button></div></div>}
                  {selectedSkill.type !== 'dynamic' && <><label className="toggle-row"><span><strong>Measure valid holds</strong><small>Track only time in a qualified position</small></span><input type="checkbox" checked={measureHold} onChange={(event) => setMeasureHold(event.target.checked)} /><i /></label>
                    {measureHold && <div className="form-row"><label htmlFor="target-hold">Target hold</label><div className="number-control"><button onClick={() => setTargetHold(Math.max(5, targetHold - 5))}>−</button><input id="target-hold" type="number" min="5" max="300" step="5" value={targetHold} onChange={(event) => setTargetHold(Math.min(300, Math.max(5, Number(event.target.value) || 5)))} /><button onClick={() => setTargetHold(Math.min(300, targetHold + 5))}>+</button></div></div>}</>}
                  {selectedSkill.type !== 'dynamic' && <div className="sensitivity-control"><label htmlFor="position-tolerance">Hold position tolerance <b>±{positionTolerance}°</b></label><input id="position-tolerance" type="range" min="12" max="35" value={positionTolerance} onChange={(event) => setPositionTolerance(Number(event.target.value))} /><small>Higher tolerance accepts more position drift.</small><label htmlFor="smoothing-strength">Pose smoothing <b>{smoothingStrength}%</b></label><input id="smoothing-strength" type="range" min="45" max="85" value={smoothingStrength} onChange={(event) => setSmoothingStrength(Number(event.target.value))} /><small>Higher smoothing filters brief landmark noise.</small></div>}
                  <div className="form-field"><label htmlFor="focus">Technique focus <span>OPTIONAL</span></label><input id="focus" value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="e.g. keep hips level" maxLength={70} /></div>
                  <div className="setup-divider" /><div className="checklist-heading"><span className="mini-check"><Check size={12} /></span><strong>Technique checkpoints</strong></div>
                  <ul className="checkpoint-list">{selectedSkill.checkpoints.map((checkpoint) => <li key={checkpoint}><span />{checkpoint}</li>)}</ul>
                  <div className="camera-position"><span className="camera-position-icon"><Video size={16} /></span><div><small>RECOMMENDED CAMERA</small><p>{selectedSkill.camera}</p></div></div>
                </section>
                <div className="disclaimer"><CircleAlert size={15} /><p>2D pose estimates are directional, not clinical measurements. Camera angle and occlusion can affect results.</p></div>
              </aside>
            </div>
          </section>
        )}

        {screen === 'report' && activeSession && (
          <section className="page-content report-page">
            <div className="report-top"><div><button className="back-link" onClick={showHistory}>← Training log</button><div className="eyebrow">SESSION COMPLETE · {new Date(activeSession.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div><h1>{activeSession.skillName}</h1><p className="lede">Your analysis is ready. Treat 2D estimates as training feedback, not a precise biomechanical measurement.</p><p className="report-settings">{getSkill(activeSession.skillId)?.type === 'dynamic' ? `${activeSession.settings.targetReps} rep target · ` : ''}{activeSession.settings.measureHold ? `${activeSession.settings.targetHold}s hold target · ±${activeSession.settings.positionTolerance}° tolerance` : 'hold timer off'} · {activeSession.settings.smoothingStrength}% smoothing{activeSession.settings.focus ? ` · Focus: ${activeSession.settings.focus}` : ''}</p></div><button className="button-primary" onClick={resetWorkflow}><RotateCcw size={16} /> Analyze again</button></div>
            {activeSession.report.insufficientConfidence && <div className="confidence-alert"><CircleAlert size={18} /><div><strong>Not enough reliable pose evidence for a score</strong><span>Try brighter lighting, a steady side-on camera and a fully visible body. No score was invented.</span></div></div>}
            <div className="report-summary">
              <div className="score-card panel"><div className="eyebrow">TECHNIQUE SCORE</div><div className={`score-number ${activeSession.report.score === null ? 'no-score' : ''}`}>{activeSession.report.score ?? '—'}<small>{activeSession.report.score !== null && '/100'}</small></div><div className="score-caption">{activeSession.report.score === null ? 'Insufficient confidence' : 'Estimated from visible pose frames'}</div><div className="score-bar"><i style={{ width: `${activeSession.report.score ?? 0}%` }} /></div><div className="score-foot"><span>POSE CONFIDENCE</span><strong>{activeSession.report.confidence}%</strong></div></div>
              <div className="result-metrics panel">
                <Metric label="Valid repetitions" value={String(activeSession.report.validReps)} helper={`Partial / incomplete · ${activeSession.report.partialReps}`} icon={<Activity size={17} />} />
                <Metric label="Longest valid hold" value={formatTime(activeSession.report.longestHold)} helper="Continuous qualified position" icon={<Clock3 size={17} />} />
                <Metric label="Total valid hold" value={formatTime(activeSession.report.totalHold)} helper={`${activeSession.report.framesAnalyzed} pose frames analyzed`} icon={<ShieldCheck size={17} />} />
              </div>
              {activeSession.video && videoUrl && <div className="report-video panel"><div className="panel-heading"><div><div className="eyebrow">SESSION RECORDING</div><h2>Review your movement</h2></div></div><video controls playsInline src={videoUrl} /></div>}
            </div>
            <div className="report-details">
              <div className="panel criteria-panel"><div className="panel-heading"><div><div className="eyebrow">SKILL-SPECIFIC BREAKDOWN</div><h2>Technique signals</h2></div></div>
                {activeSession.report.criteria.length ? <div className="criteria-list">{activeSession.report.criteria.map((criterion) => <div className="criterion" key={criterion.name}><div className="criterion-top"><div><strong>{criterion.name}</strong><small>{criterion.detail}</small></div><b>{activeSession.report.score === null ? '—' : criterion.score}</b></div><div className="criterion-bar"><i style={{ width: `${activeSession.report.score === null ? 0 : criterion.score}%` }} /></div></div>)}</div> : <p className="muted-text">No pose frames were recorded for this session.</p>}
                {activeSession.report.repConfidence.length > 0 && <div className="rep-confidence"><strong>REP LANDMARK CONFIDENCE</strong><div>{activeSession.report.repConfidence.map((confidence, index) => <span key={`${index}-${confidence}`}>#{index + 1} <b>{Math.round(confidence * 100)}%</b></span>)}</div><small>Visibility confidence at each completed rep; not a form-quality score.</small></div>}
              </div>
              <div className="panel notes-panel"><div className="eyebrow">COACHING NOTES</div><h2>What we noticed</h2>
                <div className="note-section"><strong className="note-positive">GOOD SIGNALS</strong>{activeSession.report.positives.map((item) => <p key={item}><Check size={14} />{item}</p>)}</div>
                {activeSession.report.issues.length > 0 && <div className="note-section"><strong className="note-warning">AREAS TO REVIEW</strong>{activeSession.report.issues.map((item) => { const example = activeSession.report.timestampExamples.find((entry) => entry.issue === item); return <p key={item}><ArrowDownRight size={14} />{example && <time className="issue-timestamp">{formatTime(example.time)}</time>}{item}</p> })}</div>}
                <div className="note-section"><strong className="note-suggestion">NEXT SESSION</strong>{activeSession.report.suggestions.map((item, index) => <p key={item}><span className="suggestion-index">0{index + 1}</span>{item}</p>)}</div>
              </div>
            </div>
            <div className="report-actions"><button className="button-secondary" onClick={showHistory}><History size={16} /> Training log</button><button className="button-primary" onClick={resetWorkflow}><Plus size={17} /> New analysis</button></div>
          </section>
        )}

        {screen === 'history' && (
          <section className="page-content">
            <div className="history-heading"><div><div className="eyebrow">YOUR LOCAL TRAINING LOG</div><h1>Keep showing up.</h1><p className="lede">Your sessions are stored on this device. They are never sent to a server.</p></div><div className="history-tools"><select aria-label="Filter by category" value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}><option value="all">All categories</option>{categories.filter((item) => item.id !== 'all').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label="Filter by skill" value={historySkill} onChange={(event) => setHistorySkill(event.target.value)}><option value="all">All skills</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select><select aria-label="Filter by date" value={historyPeriod} onChange={(event) => setHistoryPeriod(event.target.value)}><option value="all">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>{sessions.length > 0 && <button className="icon-button destructive" onClick={() => void removeAllSessions()} aria-label="Delete all training history"><Trash2 size={16} /></button>}</div></div>
            {filteredHistory.length ? <div className="history-table panel"><div className="history-table-head"><span>SESSION</span><span>TECHNIQUE</span><span>REPS / HOLD</span><span>DATE</span><span /></div>
              {filteredHistory.map((session) => <div className="history-table-row" key={session.id}><button className="history-session" onClick={() => openSession(session)}><span className="history-thumb"><Activity size={16} /></span><span><strong>{session.skillName}</strong><small>{getSkill(session.skillId)?.categoryName ?? 'Calisthenics'}</small></span></button><div className="history-score">{session.report.score === null ? <span className="score-muted">No score</span> : <><strong>{session.report.score}</strong><small>/100</small></>}</div><div className="history-stat">{session.report.validReps ? `${session.report.validReps} reps` : formatTime(session.report.longestHold)}</div><div className="history-date">{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div><button className="icon-button" onClick={() => void removeSession(session.id)} aria-label={`Delete ${session.skillName} session`}><Trash2 size={15} /></button></div>)}
              </div> : <EmptyState title={sessions.length ? 'No sessions match these filters' : 'No sessions yet'} text={sessions.length ? 'Choose a wider date range or clear one of the filters.' : 'Choose a skill, record or upload a video, and save your first analysis.'} action={sessions.length ? 'Clear filters' : 'Choose a skill'} onClick={() => sessions.length ? (setHistorySkill('all'), setHistoryCategory('all'), setHistoryPeriod('all')) : setScreen('select')} />}
            <div className="storage-note"><ShieldCheck size={16} /><span>Local storage · {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} · Delete any session or clear all data at any time.</span></div>
          </section>
        )}

        <footer className="app-footer"><span>CALITRACKER <i>·</i> TRAIN SMARTER, STAY GROUNDED</span><span>BUILT FOR MOVEMENT <Activity size={13} /></span></footer>
      </main>
    </div>
  )
}

function StatCard({ label, value, suffix, note, icon }: { label: string; value: string; suffix?: string; note: string; icon: ReactNode }) {
  return <div className="stat-card panel"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}<small>{suffix}</small></div><div className="stat-note">{note}</div></div>
}

function ScoreTrend({ sessions }: { sessions: TrainingSession[] }) {
  const scored = sessions.filter((session) => session.report.score !== null).slice(0, 8).reverse()
  const points = scored.map((session, index) => ({
    x: scored.length === 1 ? 160 : 10 + index * (300 / (scored.length - 1)),
    y: 67 - ((session.report.score ?? 0) / 100) * 55,
  }))
  return <div className="score-trend">
    <div className="trend-heading"><span>TECHNIQUE SCORE TREND</span><strong>{scored[scored.length - 1]?.report.score} <small>latest</small></strong></div>
    <svg viewBox="0 0 320 82" role="img" aria-label="Technique score trend across recent sessions">
      <line x1="8" y1="12" x2="312" y2="12" /><line x1="8" y1="67" x2="312" y2="67" />
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
      {points.map((point, index) => <circle key={scored[index].id} cx={point.x} cy={point.y} r="3.2"><title>{scored[index].skillName}: {scored[index].report.score}/100</title></circle>)}
    </svg>
    <div className="trend-dates"><span>{new Date(scored[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>{scored.length} scored sessions</span><span>{new Date(scored[scored.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
  </div>
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Activity size={20} /></span><strong>{title}</strong><p>{text}</p><button className="button-secondary" onClick={onClick}>{action} <ArrowRight size={15} /></button></div>
}

function SessionRow({ session, onClick }: { session: TrainingSession; onClick: () => void }) {
  return <button className="session-row" onClick={onClick}><span className="session-row-icon"><Activity size={17} /></span><span className="session-row-main"><strong>{session.skillName}</strong><small>{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {session.report.validReps ? `${session.report.validReps} reps` : `${formatTime(session.report.longestHold)} hold`}</small></span><span className={`session-score ${session.report.score === null ? 'score-muted' : ''}`}>{session.report.score ?? '—'}<small>{session.report.score !== null && '/100'}</small></span><ArrowRight className="session-arrow" size={16} /></button>
}

function SkillCard({ skill, onChoose }: { skill: Skill; onChoose: () => void }) {
  return <button className="skill-card panel" onClick={onChoose}><div className="skill-card-top"><span className={`skill-type ${skill.type}`}>{skill.type}</span><span className="level-label">LEVEL <b>{skill.level}</b></span></div><h3>{skill.name}</h3><p>{skill.description}</p><div className="skill-card-bottom"><span>{skill.categoryName}</span><span className="skill-select">Select <ArrowRight size={14} /></span></div></button>
}

function Metric({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: ReactNode }) {
  return <div className="metric"><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{helper}</span></div></div>
}

export default App
