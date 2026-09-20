import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import sampleUiUrl from '../sample_ui.png'

type CameraId = 'front' | 'left' | 'right'
type Arm = 'L' | 'R'
type XrMode = 'immersive-ar' | 'immersive-vr'
type VoiceCommand = 'connect' | 'hold' | 'resume' | 'estop' | 'reset-estop' | 'teleop-start' | 'teleop-stop' | 'unknown'

interface VoiceRecognitionResultEvent { results: ArrayLike<{ 0: { transcript: string } }> }
interface VoiceRecognition { lang: string; continuous: boolean; interimResults: boolean; onstart: (() => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null; onresult: ((event: VoiceRecognitionResultEvent) => void) | null; start: () => void; stop: () => void }
type VoiceRecognitionConstructor = new () => VoiceRecognition

declare global {
  interface Window { SpeechRecognition?: VoiceRecognitionConstructor; webkitSpeechRecognition?: VoiceRecognitionConstructor }
}

const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const paths: Record<string, ReactNode> = {
    camera: <><path d="M4 7.5h3l1.3-2h3.4l1.3 2H16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z"/><circle cx="10" cy="12" r="3"/></>,
    link: <><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/></>,
    robot: <><path d="M10 3v3M7 8h6M5 10h10v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6ZM8 19v2m4-2v2M3 12v4m14-4v4"/><circle cx="8" cy="13" r=".6" fill="currentColor"/><circle cx="12" cy="13" r=".6" fill="currentColor"/></>,
    target: <><circle cx="10" cy="10" r="7"/><path d="M10 1v4m0 10v4M1 10h4m10 0h4"/><circle cx="10" cy="10" r="2"/></>,
    wifi: <><path d="M2 8.5a12 12 0 0 1 16 0M5 12a7.5 7.5 0 0 1 10 0M8 15.5a3.5 3.5 0 0 1 4 0"/><circle cx="10" cy="18" r=".7" fill="currentColor"/></>,
    clock: <><circle cx="10" cy="10" r="7.5"/><path d="M10 5v5l3 2"/></>,
    play: <path d="m7 4 9 6-9 6V4Z" fill="currentColor" stroke="none"/>,
    home: <><path d="m3 10 7-6 7 6v7H3v-7Z"/><path d="M8 17v-4h4v4"/></>,
    pause: <><path d="M6 4v12M14 4v12"/></>,
    alert: <><path d="m10 2 8 15H2L10 2Z"/><path d="M10 7v4m0 3v.1"/></>,
    sliders: <><path d="M4 4v12m6-12v12m6-12v12"/><path d="M2 7h4m6 5h4M8 9h4m4 5h4"/></>,
    expand: <><path d="M3 8V3h5M17 8V3h-5M3 12v5h5m9-5v5h-5"/></>,
    headset: <><path d="M3 12a7 7 0 0 1 14 0v5h-3v-5h3M3 12v5h3v-5H3Z"/></>,
    mic: <><rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6"/></>,
    chevron: <path d="m6 8 4 4 4-4"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function StatusDot({ label, tone = 'good' }: { label: string; tone?: 'good' | 'warn' | 'bad' | 'muted' }) {
  return <span className={`status ${tone}`}><i />{label}</span>
}

function CornerFrame({ className = '' }: { className?: string }) {
  return <span className={`corner-frame ${className}`} aria-hidden="true" />
}

const cameraNames: Record<CameraId, string> = { front: 'FRONT STEREO', left: 'LEFT WRIST', right: 'RIGHT WRIST' }

function parseVoiceCommand(value: string): VoiceCommand {
  const text = value.toLowerCase().replace(/[.,!?]/g, ' ')
  if (/(e\s*stop|emergency stop|비상 정지|비상정지|긴급 정지|긴급정지)/i.test(text)) return 'estop'
  if (/(reset stop|release e stop|clear stop|정지 해제|비상 정지 해제)/i.test(text)) return 'reset-estop'
  if (/(start teleop|teleop start|begin teleoperation|start operation|텔레옵 시작|텔레오퍼레이션 시작|작업 시작)/i.test(text)) return 'teleop-start'
  if (/(stop teleop|teleop stop|stop operation|pause teleop|텔레옵 중지|텔레오퍼레이션 중지|작업 중지)/i.test(text)) return 'teleop-stop'
  if (/(resume|continue|재개|계속)/i.test(text)) return 'resume'
  if (/(hold|pause|일시 정지|홀드|멈춰)/i.test(text)) return 'hold'
  if (/(connect|연결|접속|커넥트)/i.test(text)) return 'connect'
  return 'unknown'
}

function App() {
  const [activeCamera, setActiveCamera] = useState<CameraId>('front')
  const [mode, setMode] = useState<'teleop' | 'autonomous'>('teleop')
  const [arm, setArm] = useState<Arm>('L')
  const [speed, setSpeed] = useState(70)
  const [motion, setMotion] = useState<'XYZ' | 'RPY'>('XYZ')
  const [isHeld, setIsHeld] = useState(false)
  const [isStopped, setIsStopped] = useState(false)
  const [xrMessage, setXrMessage] = useState('')
  const [browserPreview, setBrowserPreview] = useState(false)
  const [robotIp, setRobotIp] = useState('192.168.0.42')
  const [showConsole, setShowConsole] = useState(false)
  const [showFlyLab, setShowFlyLab] = useState(() => typeof window !== 'undefined' && window.location.pathname !== '/teleop')
  const [connectionError, setConnectionError] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const voiceCommandRef = useRef<(text: string) => void>(() => undefined)

  const focus = useMemo(() => ({ front: 70, left: 15, right: 15 }), [])

  const enterXR = async (preferredMode: XrMode = 'immersive-ar') => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (mode: XrMode) => Promise<boolean>; requestSession: (mode: XrMode, options?: object) => Promise<unknown> } }).xr
    if (!xr) {
      setBrowserPreview(true)
      setXrMessage('No XR device detected · browser preview active')
      return
    }

    // The connection screen enters VR first. The dashboard button keeps AR
    // as the preferred mode for MR-capable devices.
    const modes: XrMode[] = preferredMode === 'immersive-vr'
      ? ['immersive-vr', 'immersive-ar']
      : ['immersive-ar', 'immersive-vr']
    for (const mode of modes) {
      try {
        if (!await xr.isSessionSupported(mode)) continue
        await xr.requestSession(mode, {
          // Keep these optional for the first session. Requiring local-floor
          // can reject an otherwise valid WebXR device.
          optionalFeatures: ['local-floor', 'bounded-floor', 'hit-test', 'anchors', 'hand-tracking'],
        })
        setBrowserPreview(false)
        setXrMessage(`Immersive ${mode === 'immersive-ar' ? 'AR' : 'VR'} session connected`)
        return
      } catch {
        // Try the next available mode.
      }
    }
    setBrowserPreview(true)
    setXrMessage('No XR device detected · browser preview active')
  }

  const openTeleopView = async () => {
    const ip = robotIp.trim()
    if (!ip) {
      setConnectionError('Enter a robot IP address to continue')
      return
    }
    setConnectionError('')
    setShowConsole(true)
    await enterXR('immersive-vr')
  }

  const handleVoiceCommand = (text: string) => {
    const command = parseVoiceCommand(text)
    setVoiceTranscript(text)
    setVoiceError(command === 'unknown' ? 'Command not recognized' : '')
    if (command === 'connect' && !showConsole) return void openTeleopView()
    if (!showConsole) return
    if (command === 'hold' || command === 'teleop-stop') {
      setIsHeld(true)
      return
    }
    if (command === 'resume' || command === 'teleop-start') {
      setMode('teleop')
      setIsHeld(false)
      setIsStopped(false)
      return
    }
    if (command === 'estop') {
      setIsStopped(true)
      setIsHeld(true)
      return
    }
    if (command === 'reset-estop') {
      setIsStopped(false)
    }
  }

  voiceCommandRef.current = handleVoiceCommand

  const toggleVoice = () => {
    const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined
    if (!Recognition) {
      setVoiceError('Voice input is not supported in this browser')
      return
    }
    if (!recognitionRef.current) {
      const recognition = new Recognition()
      recognition.lang = navigator.language.toLowerCase().startsWith('ko') ? 'ko-KR' : 'en-US'
      recognition.continuous = true
      recognition.interimResults = false
      recognition.onstart = () => { setVoiceListening(true); setVoiceError('') }
      recognition.onend = () => setVoiceListening(false)
      recognition.onerror = (event) => { setVoiceListening(false); setVoiceError(`Voice input: ${event.error}`) }
      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        if (last) voiceCommandRef.current(last[0].transcript.trim())
      }
      recognitionRef.current = recognition
    }
    if (voiceListening) {
      recognitionRef.current.stop()
    } else {
      try { recognitionRef.current.start() } catch { setVoiceError('Voice input is already starting') }
    }
  }

  const voiceSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  const selectCamera = (id: CameraId) => setActiveCamera(id)

  if (showFlyLab) {
    return <FlyBrainLab onBack={() => { window.history.pushState({}, '', '/teleop'); setShowFlyLab(false) }} />
  }

  if (!showConsole) {
    return <ConnectScreen robotIp={robotIp} onRobotIpChange={setRobotIp} onStart={openTeleopView} onFlyLab={() => { window.history.pushState({}, '', '/'); setShowFlyLab(true) }} error={connectionError} voiceListening={voiceListening} voiceTranscript={voiceTranscript} voiceError={voiceError} voiceSupported={voiceSupported} onToggleVoice={toggleVoice} />
  }

  return (
    <main className="app-shell" style={{ '--sample-feed': `url("${sampleUiUrl}")` } as CSSProperties}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><div className="eyebrow">UNIT T-07</div><h1>TELEOPERATION</h1><p>ROBOT CONTROL CONSOLE</p></div>
        </div>
        <div className="topbar-center"><span className="live-dot" />MOCK TELEMETRY <span className="divider" /> WEBXR READY</div>
        <div className="top-actions">
          <VoiceControl listening={voiceListening} transcript={voiceTranscript} error={voiceError} supported={voiceSupported} onToggle={toggleVoice} compact />
          <button className="back-button" onClick={() => setShowConsole(false)}>MAIN</button>
          <button className={`xr-button ${browserPreview ? 'preview-active' : ''}`} onClick={() => enterXR()}><Icon name="headset" size={16} /> {browserPreview ? 'BROWSER PREVIEW' : 'ENTER XR'}</button>
          <div className="system-time"><span>14:32:08</span><small>2025—06—17</small></div>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-rail">
          <section className="hud-card cameras-card">
            <div className="card-heading"><span><Icon name="camera" /> CAMERAS</span><span className="heading-tag">3/3</span></div>
            <div className="camera-list">
              {(['front', 'left', 'right'] as CameraId[]).map((id) => <button key={id} className={`camera-item ${activeCamera === id ? 'selected' : ''}`} onClick={() => selectCamera(id)}>
                <span className="camera-symbol"><Icon name={id === 'front' ? 'target' : 'camera'} size={17} /></span><span className="camera-copy"><strong>{cameraNames[id]}</strong><small>{id === 'front' ? 'Stereo depth' : 'Wrist-mounted'}</small></span><StatusDot label="ONLINE" />
              </button>)}
            </div>
            <div className="camera-health"><span>STREAM HEALTH</span><span className="signal-bars"><i/><i/><i/><i/><i/></span><b>GOOD</b></div>
          </section>
          <section className="hud-card mission-card">
            <div className="card-heading"><span><Icon name="target" /> MISSION</span><span className="heading-tag cyan">LIVE</span></div>
            <div className="mission-title">BIN PICK / SEQUENCE 04</div>
            <div className="mission-row"><span>Target confidence</span><b>98.4%</b></div><div className="thin-progress"><span style={{ width: '98.4%' }} /></div>
            <div className="mission-row"><span>Cycle time</span><b>00:42.8</b></div>
            <div className="mission-step"><i className="done"/><span>Acquire target</span><b>DONE</b></div><div className="mission-step"><i className="active"/><span>Align grippers</span><b>ACTIVE</b></div><div className="mission-step"><i/><span>Place in bin</span><b>QUEUED</b></div>
          </section>
        </aside>

        <section className="stage-area">
          <div className="stage-toolbar"><div><span className="stage-kicker">SPATIAL VIEW / PRIMARY FEED</span><span className="stage-title">{cameraNames[activeCamera]}</span></div><div className="toolbar-actions"><span className="stream-pill"><i/>STREAMING <b>30 FPS</b></span><button aria-label="Expand view"><Icon name="expand" /></button></div></div>
          <div className={`main-feed ${activeCamera === 'front' ? 'selected' : ''} ${activeCamera !== 'front' ? 'wrist-focus' : ''}`} onClick={() => selectCamera('front')} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectCamera('front') }} style={{ '--feed-focus': `${focus[activeCamera]}%` } as CSSProperties}>
            <img className="feed-image" src={sampleUiUrl} alt="Front stereo camera mock feed" style={{ objectPosition: `center ${focus[activeCamera]}%` }} />
            <div className="feed-vignette" />
            <div className="scan-lines" />
            <div className="feed-grid" />
            <div className="reticle"><span /><i /><b /></div>
            <div className="target-callout"><span className="target-label"><Icon name="target" size={14} /> TARGET LOCKED</span><strong>BIN-04</strong><small>0.42 m · SAFE</small></div>
            <div className="tracking-label tl-one">DEPTH MAP <b>ACTIVE</b></div><div className="tracking-label tl-two">POSE TRACKING <b>98%</b></div>
            <div className="axis"><span>X</span><i/><span>Y</span><i/><span>Z</span></div>
            <div className="feed-footer"><span><i className="record-dot"/>LOW LATENCY LINK</span><span>24 ms</span><span>DEPTH <b>0.42 m</b></span></div>
            <CornerFrame className="main-frame" />
          </div>
          <div className="wrist-row">
            <MiniFeed id="left" title="LEFT WRIST" active={activeCamera === 'left'} onClick={() => selectCamera('left')} />
            <MiniFeed id="right" title="RIGHT WRIST" active={activeCamera === 'right'} onClick={() => selectCamera('right')} />
          </div>
        </section>

        <aside className="right-rail">
          <section className="hud-card robot-card">
            <div className="card-heading"><span><Icon name="robot" /> ROBOT STATUS</span><StatusDot label="READY" /></div>
            <div className="robot-body"><div className="robot-figure"><div className="figure-head"/><div className="figure-torso"/><span className="joint j1"/><span className="joint j2"/><span className="joint j3"/><span className="joint j4"/><span className="joint j5"/><span className="joint j6"/><div className="figure-leg left"/><div className="figure-leg right"/></div><div className="state-list"><StateRow label="Connection" value="ONLINE" /><StateRow label="Camera bus" value="ONLINE" /><StateRow label="Control link" value="ONLINE" /></div></div>
            <div className="subsection-title">ARM STATUS <span>COMMAND CHANNEL</span></div><StateRow label="L · Arm" value="ACTIVE" /><StateRow label="R · Arm" value="IDLE" tone="muted" />
            <div className="subsection-title gripper-title">GRIPPER <span>FORCE / POSITION</span></div><GripperRow label="L" value={62} /><GripperRow label="R" value={81} />
          </section>
          <section className="hud-card diagnostics-card"><div className="card-heading"><span><Icon name="sliders" /> SYSTEM LINK</span><span className="heading-tag">NOMINAL</span></div><div className="diag-row"><span>NETWORK</span><b>32 ms</b><em>↗ 2.4 MB/s</em></div><div className="diag-row"><span>POSE SYNC</span><b>60 Hz</b><em>LOCKED</em></div><div className="diag-row"><span>SAFETY ZONE</span><b className="green-text">CLEAR</b><em>R 1.8 m</em></div></section>
        </aside>
      </section>

      <section className="control-dock">
        <div className="dock-group mode-group"><div className="dock-label">CONTROL MODE</div><div className="mode-switch"><button className={mode === 'teleop' ? 'active' : ''} onClick={() => setMode('teleop')}><Icon name="headset" size={16} /> TELEOP</button><button className={mode === 'autonomous' ? 'active' : ''} onClick={() => setMode('autonomous')}><Icon name="robot" size={16} /> AUTO</button></div></div>
        <div className="dock-group speed-group"><div className="dock-label">TELEOP SPEED <b>{speed}%</b></div><input aria-label="Teleoperation speed" type="range" min="10" max="100" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /><div className="range-meta"><span>PRECISE</span><span>FAST</span></div></div>
        <div className="dock-group arm-group"><div className="dock-label">ARM SELECTION</div><div className="arm-switch"><button className={arm === 'L' ? 'active' : ''} onClick={() => setArm('L')}>L <small>LEFT</small></button><button className={arm === 'R' ? 'active' : ''} onClick={() => setArm('R')}>R <small>RIGHT</small></button></div></div>
        <div className="dock-group motion-group"><div className="dock-label">MOTION FRAME</div><div className="motion-switch"><button className={motion === 'XYZ' ? 'active' : ''} onClick={() => setMotion('XYZ')}>XYZ</button><button className={motion === 'RPY' ? 'active' : ''} onClick={() => setMotion('RPY')}>RPY</button></div><div className="coordinates"><span>X <b>+0.32</b></span><span>Y <b>−0.12</b></span><span>Z <b>+0.41</b></span></div></div>
        <div className="dock-actions"><button className="dock-button" onClick={() => setXrMessage('Home position command queued')}><Icon name="home" /><span>HOME</span></button><button className={`dock-button ${isHeld ? 'active' : ''}`} onClick={() => setIsHeld(!isHeld)}><Icon name="pause" /><span>{isHeld ? 'RESUME' : 'HOLD'}</span></button><button className={`estop-button ${isStopped ? 'latched' : ''}`} onClick={() => setIsStopped(!isStopped)}><Icon name="alert" /><span>{isStopped ? 'RESET STOP' : 'E-STOP'}</span></button></div>
      </section>
      <footer className="footer-status"><span><i/> {browserPreview ? 'BROWSER PREVIEW · NO XR DEVICE' : 'MOCK DATASET · AWAITING ROBOT GATEWAY'}</span><span>WEBRTC VIDEO ADAPTER READY <b>•</b> ROS2 BRIDGE OFFLINE</span></footer>
      {(xrMessage || isStopped) && <div className={`toast ${isStopped ? 'danger' : ''}`}><Icon name={isStopped ? 'alert' : 'link'} size={15} />{isStopped ? 'E-STOP LATCHED · MOTION COMMANDS BLOCKED' : xrMessage}<button onClick={() => setXrMessage('')}>×</button></div>}
    </main>
  )
}

type CubeFace = 'U' | 'D' | 'F' | 'B' | 'L' | 'R'
type CubeColor = 'white' | 'yellow' | 'green' | 'blue' | 'orange' | 'red'
type BrainRegion = 'visual' | 'mushroom' | 'dopamine' | 'motor' | 'memory'
type StimulusKind = 'visual' | 'reward' | 'aversive'
type Vec3 = [number, number, number]
const cubeMoves = ['U', "U'", 'D', "D'", 'F', "F'", 'B', "B'", 'L', "L'", 'R', "R'"] as const
type CubeMove = typeof cubeMoves[number]

interface CubeSticker { position: Vec3; normal: Vec3; color: CubeColor }
interface CubeState { stickers: CubeSticker[] }
interface BrainSignals { visual: number; mushroom: number; dopamine: number; motor: number; memory: number }
interface FlyGame { round: number; cube: CubeState; scramble: CubeMove[]; solution: CubeMove[]; lastMove: CubeMove; flyStep: number; event: string; reward: 'positive' | 'negative' | 'neutral'; solved: boolean; stimulus: StimulusKind; signals: BrainSignals }
type QTable = Record<string, Partial<Record<CubeMove, number>>>

const faceDefinitions: Record<CubeFace, { normal: Vec3; right: Vec3; down: Vec3; color: CubeColor }> = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, -1], color: 'white' },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, 1], color: 'yellow' },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0], color: 'green' },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0], color: 'blue' },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0], color: 'red' },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0], color: 'orange' },
}

const faceForNormal: Record<string, CubeFace> = Object.fromEntries(Object.entries(faceDefinitions).map(([face, definition]) => [definition.normal.join(','), face])) as Record<string, CubeFace>
const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scaleVec = (a: Vec3, value: number): Vec3 => [a[0] * value, a[1] * value, a[2] * value]
const dotVec = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const rotateVec = (vector: Vec3, axis: number, direction: 1 | -1): Vec3 => {
  const [x, y, z] = vector
  if (axis === 0) return direction === 1 ? [x, -z, y] : [x, z, -y]
  if (axis === 1) return direction === 1 ? [z, y, -x] : [-z, y, x]
  return direction === 1 ? [-y, x, z] : [y, -x, z]
}

function solvedCube(): CubeState {
  const stickers: CubeSticker[] = []
  for (const definition of Object.values(faceDefinitions)) for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) {
    const offset = addVec(scaleVec(definition.right, col - 1), scaleVec(definition.down, row - 1))
    stickers.push({ position: addVec(definition.normal, offset), normal: [...definition.normal], color: definition.color })
  }
  return { stickers }
}

function applyCubeMove(cube: CubeState, move: CubeMove): CubeState {
  const face = move[0] as CubeFace
  const definition = faceDefinitions[face]
  const axis = definition.normal.findIndex((value) => value !== 0)
  const clockwise = move.length === 1
  const turn = (clockwise ? -1 : 1) * definition.normal[axis] as 1 | -1
  return { stickers: cube.stickers.map((sticker) => dotVec(sticker.position, definition.normal) === 1 ? { ...sticker, position: rotateVec(sticker.position, axis, turn), normal: rotateVec(sticker.normal, axis, turn) } : { ...sticker, position: [...sticker.position], normal: [...sticker.normal] }) }
}

function inverseMove(move: CubeMove): CubeMove { return (move.length === 1 ? `${move}'` : move[0]) as CubeMove }
function cubeSignature(cube: CubeState) { return cube.stickers.map((sticker) => `${sticker.position.join('')}${sticker.normal.join('')}${sticker.color}`).sort().join('|') }
function wrongFacelets(cube: CubeState) { return cube.stickers.reduce((total, sticker) => total + (faceDefinitions[faceForNormal[sticker.normal.join(',')]].color === sticker.color ? 0 : 1), 0) }
function cubeSolved(cube: CubeState) { return wrongFacelets(cube) === 0 }
function randomScramble(depth: number) {
  const pool: CubeMove[] = ['U', "U'", 'D', "D'", 'F', "F'", 'B', "B'", 'L', "L'", 'R', "R'"]
  const scramble: CubeMove[] = []
  for (let i = 0; i < depth; i += 1) {
    let move = pool[Math.floor(Math.random() * pool.length)]
    let guard = 0
    while (scramble.length > 0 && move[0] === scramble[scramble.length - 1][0] && guard < 12) {
      move = pool[Math.floor(Math.random() * pool.length)]
      guard += 1
    }
    scramble.push(move)
  }
  const cube = scramble.reduce(applyCubeMove, solvedCube())
  return { scramble, cube, solution: scramble.slice().reverse().map(inverseMove) }
}

function scrambleCube(round: number, depth = 3) {
  void round
  return randomScramble(depth)
}

function seedCubePolicy(task: { cube: CubeState; solution: CubeMove[] }, table: QTable) {
  let cube = task.cube
  for (const move of task.solution) { const state = cubeSignature(cube); table[state] = { ...(table[state] ?? {}), [move]: 2.4 }; cube = applyCubeMove(cube, move) }
}

function chooseCubeMove(game: FlyGame, table: QTable) {
  const state = cubeSignature(game.cube)
  if (Math.random() < 0.08) return cubeMoves[Math.floor(Math.random() * cubeMoves.length)]
  const ranked = cubeMoves.map((move) => ({ move, value: (table[state]?.[move] ?? 0) + (54 - wrongFacelets(applyCubeMove(game.cube, move))) * 0.018 }))
  return ranked.sort((a, b) => b.value - a.value)[0].move
}

function createFlyTask(round: number, table: QTable, depth = 3): FlyGame {
  const task = scrambleCube(round, depth)
  seedCubePolicy(task, table)
  return { round, cube: task.cube, scramble: task.scramble, solution: task.solution, lastMove: task.scramble[0], flyStep: 0, event: `ROUND ${String(round + 1).padStart(2, '0')} / SCRAMBLE ${task.scramble.join(' ')} OBSERVED`, reward: 'neutral', solved: false, stimulus: 'visual', signals: { visual: 1, mushroom: .58, dopamine: .12, motor: .2, memory: .42 } }
}

const FLY_Q_KEY = 'flylab-qtable-v1'
const FLY_STATS_KEY = 'flylab-stats-v1'

function loadPersistedTable(): QTable {
  try {
    const raw = window.localStorage.getItem(FLY_Q_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as QTable
    const keys = Object.keys(parsed).slice(-1500)
    const trimmed: QTable = {}
    for (const key of keys) trimmed[key] = parsed[key]
    return trimmed
  } catch { return {} }
}

function persistTable(table: QTable) {
  try {
    const keys = Object.keys(table).slice(-1500)
    const trimmed: QTable = {}
    for (const key of keys) trimmed[key] = table[key]
    window.localStorage.setItem(FLY_Q_KEY, JSON.stringify(trimmed))
  } catch { /* storage full or unavailable — learning continues in memory */ }
}

function stepFlyGame(game: FlyGame, table: QTable): FlyGame {
  if (game.solved) return game
  const state = cubeSignature(game.cube)
  const move = chooseCubeMove(game, table)
  const nextCube = applyCubeMove(game.cube, move)
  const before = wrongFacelets(game.cube)
  const after = wrongFacelets(nextCube)
  const solved = cubeSolved(nextCube)
  const reward = solved ? 1 : after < before ? .08 : after > before ? -.06 : -.01
  const oldValue = table[state]?.[move] ?? 0
  const nextValue = Math.max(...cubeMoves.map((candidate) => table[cubeSignature(nextCube)]?.[candidate] ?? 0))
  table[state] = { ...(table[state] ?? {}), [move]: oldValue + .3 * (reward + .88 * nextValue - oldValue) }
  const stimulus: StimulusKind = solved ? 'reward' : after > before ? 'aversive' : 'visual'
  return { ...game, cube: nextCube, lastMove: move, flyStep: game.flyStep + 1, solved, event: solved ? 'FLY COMPLETED CUBE / DOPAMINE REWARD' : after > before ? `FLY CORRECTS ${move} / ERROR SIGNAL` : `FLY ROTATES ${move} / VISUAL TRACE`, reward: solved ? 'positive' : after > before ? 'negative' : 'neutral', stimulus, signals: { visual: 1, mushroom: Math.min(1, .55 + Math.min(.4, Object.keys(table).length / 80)), dopamine: solved ? 1 : after > before ? .92 : .12, motor: .78, memory: Math.min(1, .35 + Math.min(.6, Object.keys(table).length / 90)) } }
}

function cubeFacelets(cube: CubeState): Record<CubeFace, CubeColor[]> {
  const result = {} as Record<CubeFace, CubeColor[]>
  for (const [face, definition] of Object.entries(faceDefinitions) as Array<[CubeFace, typeof faceDefinitions[CubeFace]]>) {
    result[face] = []
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) {
      const position = addVec(definition.normal, addVec(scaleVec(definition.right, col - 1), scaleVec(definition.down, row - 1)))
      const sticker = cube.stickers.find((candidate) => candidate.position.join(',') === position.join(',') && candidate.normal.join(',') === definition.normal.join(','))
      result[face].push(sticker?.color ?? definition.color)
    }
  }
  return result
}

function RubikCube3D({ cube }: { cube: CubeState }) {
  const faces = cubeFacelets(cube)
  return <div className="rubik-stage"><div className="rubik-cube-3d">
    {(['F', 'B', 'R', 'L', 'U', 'D'] as CubeFace[]).map((face) => <div className={`rubik-face rubik-face-${face}`} key={face}>{faces[face].map((color, index) => <span className={`rubik-sticker sticker-${color}`} key={`${face}-${index}`} />)}</div>)}
  </div></div>
}

function Brain3D({ signals, stimulus }: { signals: BrainSignals; stimulus: StimulusKind }) {
  const nodes: Array<{ id: BrainRegion; label: string; x: number; y: number; z: number }> = [
    { id: 'visual', label: 'VIS', x: 20, y: 60, z: 30 },
    { id: 'mushroom', label: 'MB', x: 45, y: 34, z: 38 },
    { id: 'dopamine', label: 'DAN', x: 52, y: 70, z: 44 },
    { id: 'memory', label: 'MEM', x: 74, y: 38, z: 30 },
    { id: 'motor', label: 'MOT', x: 79, y: 66, z: 20 },
  ]
  return <div className={`brain-3d stimulus-${stimulus}`} role="img" aria-label="Volumetric fly brain with active regions">
    <div className="brain-orb">
      <div className="brain-sulci" />
      <div className="brain-shine" />
      {nodes.map((node) => <div key={node.id} className={`brain-node-3d ${signals[node.id] > .5 ? 'active' : ''} ${signals[node.id] > .85 ? 'hot' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%`, '--node-z': `${node.z}px` } as CSSProperties}><i /><span>{node.label}</span></div>)}
    </div>
    <div className="brain-base" />
    <div className="brain-flow-label"><i /> RETINA <b>→</b> MB <b>→</b> DAN <b>→</b> MOTOR</div>
  </div>
}

function FlyBrainLab({ onBack }: { onBack: () => void }) {
  const [running, setRunning] = useState(true)
  const [depth, setDepth] = useState(3)
  const [speedMs, setSpeedMs] = useState(520)
  const [round, setRound] = useState(0)
  const [solvedCount, setSolvedCount] = useState(() => {
    try { return Number(JSON.parse(window.localStorage.getItem(FLY_STATS_KEY) ?? 'null')?.solved ?? 0) || 0 } catch { return 0 }
  })
  const [bestSteps, setBestSteps] = useState<number | null>(() => {
    try { const v = JSON.parse(window.localStorage.getItem(FLY_STATS_KEY) ?? 'null')?.best ?? null; return typeof v === 'number' ? v : null } catch { return null }
  })
  const [log, setLog] = useState<string[]>([])
  const [trace, setTrace] = useState<CubeMove[]>([])
  const [stepHistory, setStepHistory] = useState<number[]>([])
  const qTable = useRef<QTable>(loadPersistedTable())
  const [game, setGame] = useState<FlyGame>(() => createFlyTask(0, qTable.current, 3))
  const countedRound = useRef(-1)

  useEffect(() => { document.title = 'Fly Brain Lab — connectome cube learning'; return () => { document.title = 'T-07 Teleoperation Console' } }, [])
  useEffect(() => { if (!running || game.solved) return undefined; const timer = window.setInterval(() => setGame((current) => stepFlyGame(current, qTable.current)), speedMs); return () => window.clearInterval(timer) }, [running, speedMs, round])

  // Track the fly's recent move choices for the policy trace.
  // Human moves append directly in humanMove; this effect only records policy steps.
  const lastTracedStep = useRef(0)
  useEffect(() => {
    if (game.flyStep === 0 || lastTracedStep.current === game.flyStep) return
    lastTracedStep.current = game.flyStep
    setTrace((current) => [...current, game.lastMove].slice(-8))
  }, [game.flyStep, game.lastMove])

  // Episode bookkeeping: count solves once, persist the policy, auto-advance.
  useEffect(() => {
    if (!game.solved || countedRound.current === game.round) return undefined
    countedRound.current = game.round
    setSolvedCount((count) => {
      const next = count + 1
      try { window.localStorage.setItem(FLY_STATS_KEY, JSON.stringify({ solved: next, best: bestSteps === null ? game.flyStep : Math.min(bestSteps, game.flyStep) })) } catch { /* ignore */ }
      return next
    })
    setBestSteps((best) => (best === null ? game.flyStep : Math.min(best, game.flyStep)))
    setStepHistory((history) => [...history, game.flyStep].slice(-20))
    setLog((current) => [`R${String(game.round + 1).padStart(2, '0')} SOLVED IN ${game.flyStep} MOVES · Q-STATES ${Object.keys(qTable.current).length}`, ...current].slice(0, 6))
    persistTable(qTable.current)
    const timer = window.setTimeout(() => {
      const nextRound = game.round + 1
      setRound(nextRound)
      setTrace([])
      setGame(createFlyTask(nextRound, qTable.current, depth))
      setRunning(true)
    }, 2400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.solved])

  const newEpisode = (nextDepth: number) => {
    const nextRound = round + 1
    setRound(nextRound)
    setTrace([])
    setGame(createFlyTask(nextRound, qTable.current, nextDepth))
    setRunning(true)
  }
  const reset = (wipeMemory: boolean) => {
    if (wipeMemory) { qTable.current = {}; try { window.localStorage.removeItem(FLY_Q_KEY) } catch { /* ignore */ } }
    countedRound.current = -1
    setRound(0)
    setTrace([])
    setGame(createFlyTask(0, qTable.current, depth))
    setRunning(true)
  }
  const reward = () => setGame((current) => ({ ...current, event: 'SUGAR REWARD / DOPAMINE PULSE', reward: 'positive', stimulus: 'reward', signals: { ...current.signals, dopamine: 1, memory: 1, mushroom: .95 } }))
  const punish = () => setGame((current) => ({ ...current, event: 'AVERSIVE STIMULUS / AVOIDANCE TRACE', reward: 'negative', stimulus: 'aversive', signals: { ...current.signals, dopamine: .95, memory: .8, mushroom: 1 } }))
  const humanMove = (move: CubeMove) => {
    setGame((current) => {
      if (current.solved) return current
      const nextCube = applyCubeMove(current.cube, move)
      const solved = cubeSolved(nextCube)
      const after = wrongFacelets(nextCube)
      return { ...current, cube: nextCube, lastMove: move, flyStep: current.flyStep + 1, solved, event: solved ? 'HUMAN + FLY / CUBE COMPLETE TOGETHER' : `YOU ROTATE ${move} / ${after} FACELETS OUT OF PLACE`, reward: solved ? 'positive' : 'neutral', stimulus: solved ? 'reward' : 'visual', signals: { ...current.signals, motor: 1, mushroom: Math.min(1, current.signals.mushroom + .04) } }
    })
  }

  // The fly clings to the face it is turning: orbit for life, anchor for grip.
  const angle = game.flyStep * 0.55
  const orbitLeft = 50 + 33 * Math.cos(angle)
  const orbitTop = 56 + 24 * Math.sin(angle * 1.3)
  const faceAnchor: Record<string, { left: number; top: number; scale: number }> = {
    u: { left: 50, top: 22, scale: 1.1 },
    d: { left: 50, top: 80, scale: 1.1 },
    l: { left: 26, top: 54, scale: 1.18 },
    r: { left: 74, top: 54, scale: 1.18 },
    f: { left: 50, top: 56, scale: 1.32 },
    b: { left: 50, top: 56, scale: 0.84 },
  }
  const anchor = faceAnchor[game.lastMove[0].toLowerCase()] ?? { left: 50, top: 56, scale: 1 }
  const flyLeft = anchor.left * 0.68 + orbitLeft * 0.32
  const flyTop = anchor.top * 0.68 + orbitTop * 0.32
  const qStates = Object.keys(qTable.current).length

  return <main className="fly-lab-shell">
    <header className="fly-lab-topbar"><button className="fly-back-button" onClick={onBack}>← TELEOP CONSOLE</button><div className="fly-brand"><span className="fly-brand-mark"><i /><i /><i /></span><div><span>STANDALONE COGNITION LAB · NOT WEBXR</span><strong>FLY BRAIN / 3×3 CUBE LEARNING</strong></div></div><div className="fly-top-state"><i /> CONNECTOME-INSPIRED · ONLINE</div></header>
    <section className="fly-lab-layout">
      <article className="fly-panel fly-scene-panel">
        <div className="fly-panel-heading"><div><span>EMBODIED REINFORCEMENT</span><h2>Fly completes the 3×3 cube</h2></div><span className={`fly-run-pill ${running && !game.solved ? 'live' : ''}`}><i />{game.solved ? 'CUBE COMPLETE · NEXT EPISODE SOON' : running ? 'FLY IS LEARNING' : 'PAUSED'}</span></div>
        <div className="fly-stats">
          <div className="fly-stat"><span>ROUND</span><b>{String(round + 1).padStart(2, '0')}</b></div>
          <div className="fly-stat"><span>SCRAMBLE</span><b>{game.scramble.join(' ')}</b></div>
          <div className="fly-stat"><span>STEPS</span><b>{game.flyStep}</b></div>
          <div className="fly-stat"><span>SOLVED</span><b>{solvedCount}</b></div>
          <div className="fly-stat"><span>Q-STATES</span><b>{qStates}</b></div>
          <div className="fly-stat"><span>BEST</span><b>{bestSteps === null ? '—' : `${bestSteps} MOVES`}</b></div>
        </div>
        <div className="fly-scene rubik-scene"><div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" /><div className="scene-hud scene-hud-top"><span>RETINA INPUT / 3D CUBE</span><b>{game.solved ? 'SOLVED' : `${wrongFacelets(game.cube)} FACELETS OUT OF PLACE`}</b></div><div key={game.flyStep} className={`cube-kick kick-${game.lastMove[0].toLowerCase()}`}><RubikCube3D cube={game.cube} /></div><div className={`fly-observer ${game.reward === 'positive' || game.solved ? 'celebrate' : ''}`} style={{ left: `${flyLeft}%`, top: `${flyTop}%`, '--wing-beat': !running || game.solved ? '.8s' : speedMs <= 180 ? '.12s' : speedMs <= 520 ? '.22s' : '.34s', '--step-ms': `${speedMs}ms`, '--face-scale': anchor.scale } as CSSProperties}><i className="fly-wing fly-wing-left" /><i className="fly-wing fly-wing-right" /><b /><em /><span className={`fly-legs reach-${game.lastMove[0].toLowerCase()}`}><i className="leg-l1" /><i className="leg-l2" /><i className="leg-l3" /><i className="leg-r1" /><i className="leg-r2" /><i className="leg-r3" /></span><span>FLY AGENT</span></div><div className="brain-corner-map"><span>VOLUMETRIC BRAIN - LIVE</span><Brain3D signals={game.signals} stimulus={game.stimulus} /></div><div className={`scene-event ${game.reward}`}><i />{game.event}</div></div>
        <div className="fly-settings">
          <div className="fly-setting"><span>SCRAMBLE DEPTH</span><div className="fly-seg">{[3, 5, 8].map((d) => <button key={d} className={depth === d ? 'active' : ''} onClick={() => { setDepth(d); newEpisode(d) }}>{d} MOVES</button>)}</div></div>
          <div className="fly-setting"><span>POLICY SPEED</span><div className="fly-seg">{[[180, 'FAST'], [520, 'STEADY'], [950, 'STUDY']].map(([ms, label]) => <button key={label as string} className={speedMs === ms ? 'active' : ''} onClick={() => setSpeedMs(ms as number)}>{label as string}</button>)}</div></div>
        </div>
        <div className="fly-scramble-preview"><span>SCRAMBLE <b>{game.scramble.join(' ')}</b></span><span>OPTIMAL <b>{game.solution.join(' ')}</b></span><span>PROGRESS <b>{game.flyStep} MOVES</b></span></div>
        <div className="fly-moves"><span className="fly-moves-label">ROTATE A FACE YOURSELF — THE FLY KEEPS LEARNING AROUND YOU</span><div className="fly-moves-grid">{cubeMoves.map((move) => <button key={move} className="fly-move-btn" onClick={() => humanMove(move)}>{move}</button>)}</div></div>
        <div className="fly-scene-footer"><div><span>VISUAL TASK</span><strong>ROTATE FACES UNTIL EVERY COLOR RETURNS HOME</strong></div><div><span>REINFORCEMENT</span><strong>{game.solved ? 'DAN REWARD / MEMORY CONSOLIDATED' : 'MOTOR ACTION / VISUAL ERROR CHECK'}</strong></div></div>
        <div className="fly-controls"><button className="fly-control-primary" onClick={() => setRunning((value) => !value)}>{running ? 'Ⅱ PAUSE POLICY' : '▶ RESUME POLICY'}</button><button onClick={reward}>✦ SUGAR REWARD</button><button onClick={punish}>⚡ AVERSIVE CUE</button><button onClick={() => newEpisode(depth)}>↻ NEXT SCRAMBLE</button><button onClick={() => reset(false)}>○ RESET EPISODE</button><button onClick={() => reset(true)}>× WIPE MEMORY</button></div>
      </article>
      <aside className="fly-panel fly-brain-panel"><div className="fly-panel-heading"><div><span>LEARNING TRACE</span><h2>What the fly remembers</h2></div><span className="brain-eye">◉</span></div><div className="region-list">{([['visual', 'Retina / visual cue', 'the cube enters the fly’s eye'], ['mushroom', 'Mushroom body', 'cube state association'], ['dopamine', 'Dopamine neurons', 'reward or error pulse'], ['memory', 'KC → MBON memory', 'move policy trace'], ['motor', 'Motor output', 'face rotation command']] as Array<[BrainRegion, string, string]>).map(([id, title, caption]) => <div className={`region-row ${game.signals[id] > .5 ? 'active' : ''}`} key={id}><i /><div><strong>{title}</strong><span>{caption}</span></div><b /></div>)}</div>
        <div className="fly-trace-block"><span>POLICY TRACE / LAST MOVES</span><div className="trace-chips">{trace.length === 0 ? <em>watching…</em> : trace.map((move, i) => <b key={`${move}-${i}`} className={i === trace.length - 1 ? 'latest' : ''}>{move}</b>)}</div></div>
        <div className="fly-chart-block"><span>STEPS PER SOLVED EPISODE</span>{stepHistory.length < 2 ? <p className="fly-log-empty">Solve two cubes to draw the learning curve.</p> : (() => { const min = Math.min(...stepHistory); const max = Math.max(...stepHistory); const span = Math.max(1, max - min); const points = stepHistory.map((steps, i) => `${(5 + (i / (stepHistory.length - 1)) * 190).toFixed(1)},${(50 - ((steps - min) / span) * 40).toFixed(1)}`).join(' '); const last = points.split(' ').pop()!.split(','); const buckets = [0, 0, 0, 0, 0]; for (const s of stepHistory) { const b = Math.min(4, Math.floor(((s - min) / span) * 5)); buckets[b] += 1 } const peak = Math.max(...buckets); return <><svg className="fly-chart" viewBox="0 0 200 56" preserveAspectRatio="none" role="img" aria-label="Steps per solved episode"><polyline points={points} /><circle cx={last[0]} cy={last[1]} r="3" />{stepHistory.map((steps, i) => <circle key={i} cx={5 + (i / (stepHistory.length - 1)) * 190} cy={50 - ((steps - min) / span) * 40} r="1.4" className="fly-chart-dot" />)}</svg><div className="fly-hist" title={`min ${min} / max ${max}`}>{buckets.map((count, i) => <i key={i} className={count === peak && peak > 0 ? 'peak' : ''} style={{ height: `${peak === 0 ? 4 : 6 + (count / peak) * 30}px` }} title={`bucket ${i + 1}: ${count}`} />)}</div></> })()}</div>
        <div className="fly-log-block"><span>EPISODE LOG</span>{log.length === 0 ? <p className="fly-log-empty">No solved cubes yet. The policy improves every episode — memory persists across reloads.</p> : <ul className="fly-log">{log.map((entry) => <li key={entry}>{entry}</li>)}</ul>}</div>
        <div className="brain-note">The small map lives in the cube corner: the green particle is the visual stimulus entering the brain. A solved cube creates a gold DAN pulse; an error creates a red avoidance trace. Scramble depth and policy speed only affect this lab — the WebXR teleop console is untouched.</div></aside>
    </section>
    <footer className="fly-lab-footer"><span><i /> REINFORCEMENT LOOP: SEE → CHOOSE MOVE → ROTATE → REWARD</span><span>TABULAR POLICY / DOPAMINE-MODULATED MEMORY</span></footer>
  </main>
}

function ConnectScreen({ robotIp, onRobotIpChange, onStart, onFlyLab, error, voiceListening, voiceTranscript, voiceError, voiceSupported, onToggleVoice }: { robotIp: string; onRobotIpChange: (value: string) => void; onStart: () => void; onFlyLab: () => void; error: string; voiceListening: boolean; voiceTranscript: string; voiceError: string; voiceSupported: boolean; onToggleVoice: () => void }) {
  return (
    <main className="connect-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="connect-topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><div className="eyebrow">UNIT T-07 / OPERATOR CONSOLE</div><h1>TELEOPERATION</h1><p>WEBXR ROBOT CONTROL SYSTEM</p></div>
        </div>
        <div className="connect-header-actions"><VoiceControl listening={voiceListening} transcript={voiceTranscript} error={voiceError} supported={voiceSupported} onToggle={onToggleVoice} /><StatusDot label="SYSTEM READY" /></div>
      </header>
      <section className="connect-layout">
        <div className="connect-copy">
          <span className="connect-kicker"><i /> SECURE SESSION INITIALIZATION</span>
          <h2>CONNECT TO<br /><span>ROBOT T-07</span></h2>
          <p>Establish a control link, then enter the immersive view. Camera streams and robot telemetry will be attached when their gateways are available.</p>
          <div className="connect-steps"><span className="active"><b>01</b> CONNECT</span><i /><span><b>02</b> ENTER VR</span><i /><span><b>03</b> TELEOP VIEW</span></div>
        </div>
        <form className="connect-card" onSubmit={(event) => { event.preventDefault(); onStart() }}>
          <div className="connect-card-heading"><span><Icon name="link" /> ROBOT CONNECTION</span><span className="heading-tag cyan">MOCK GATEWAY</span></div>
          <label className="connect-label" htmlFor="robot-ip">ROBOT IP ADDRESS<span>LAN / ROS2 GATEWAY</span></label>
          <div className="ip-field"><Icon name="wifi" size={17} /><input id="robot-ip" value={robotIp} onChange={(event) => onRobotIpChange(event.target.value)} placeholder="192.168.0.42" inputMode="decimal" autoComplete="off" /></div>
          <div className="connect-meta"><span><i /> CONNECTION MODE</span><b>WEBSOCKET + WEBRTC</b></div>
          <div className="connect-meta"><span><i /> STREAM ADAPTER</span><b>READY FOR VIDEO</b></div>
          <button className="enter-vr-button" type="submit"><span><Icon name="headset" size={20} /> ENTER VR</span><Icon name="chevron" size={20} /></button>
          <button className="fly-lab-entry" type="button" onClick={onFlyLab}><span>🪰</span><span><b>OPEN FLY BRAIN LAB</b><small>Interactive connectome + cube learning</small></span><Icon name="chevron" size={18} /></button>
          {error && <p className="connect-error">{error}</p>}
          <p className="connect-note">No HMD detected? The same flow opens Browser Preview so the interface can be tested before hardware is connected.</p>
          <p className="voice-help"><Icon name="mic" size={13} /> Voice: say <b>“connect”</b> to enter the view</p>
        </form>
      </section>
      <footer className="connect-footer"><span><i /> HTTPS SECURE CONTEXT</span><span>WEBXR / CAMERA MOCKS ENABLED</span><span>BUILD 0.1.0</span></footer>
    </main>
  )
}

function VoiceControl({ listening, transcript, error, supported, onToggle, compact = false }: { listening: boolean; transcript: string; error: string; supported: boolean; onToggle: () => void; compact?: boolean }) {
  return <div className={`voice-control ${listening ? 'listening' : ''} ${compact ? 'compact' : ''}`}>
    <button className="voice-button" onClick={onToggle} title={supported ? 'Toggle voice commands' : 'Voice input is not supported'}><Icon name="mic" size={compact ? 15 : 17} /><span>{listening ? 'LISTENING' : compact ? 'VOICE' : 'VOICE COMMANDS'}</span><i className="voice-signal" /></button>
    {!compact && transcript && <small className="voice-transcript">“{transcript}”</small>}
    {!compact && error && <small className="voice-error">{error}</small>}
  </div>
}

function StateRow({ label, value, tone = 'good' }: { label: string; value: string; tone?: 'good' | 'muted' }) { return <div className="state-row"><span><i className={`state-dot ${tone}`} />{label}</span><b className={tone}>{value}</b></div> }
function GripperRow({ label, value }: { label: string; value: number }) { return <div className="gripper-row"><span>{label}</span><div className="gripper-track"><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div> }
function MiniFeed({ id, title, active, onClick }: { id: 'left' | 'right'; title: string; active: boolean; onClick: () => void }) { return <button className={`mini-feed ${active ? 'selected' : ''}`} onClick={onClick}><div className={`mini-image ${id}`}><div className="mini-crosshair"/><div className="mini-arm"/><CornerFrame /></div><div className="mini-header"><span><Icon name="camera" size={13} />{title}</span><StatusDot label="30 FPS" /></div><div className="mini-footer"><span>DEPTH</span><div className="mini-bar"><i style={{ width: id === 'left' ? '62%' : '76%' }}/></div><b>{id === 'left' ? '0.61' : '0.57'} m</b></div></button> }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
