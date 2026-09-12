import { StrictMode, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import sampleUiUrl from '../sample_ui.png'

type CameraId = 'front' | 'left' | 'right'
type Arm = 'L' | 'R'
type XrMode = 'immersive-ar' | 'immersive-vr'

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
  const [connectionError, setConnectionError] = useState('')

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

  const selectCamera = (id: CameraId) => setActiveCamera(id)

  if (!showConsole) {
    return <ConnectScreen robotIp={robotIp} onRobotIpChange={setRobotIp} onStart={openTeleopView} error={connectionError} />
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
          <button className="back-button" onClick={() => setShowConsole(false)}>MAIN</button>
          <button className={`xr-button ${browserPreview ? 'preview-active' : ''}`} onClick={enterXR}><Icon name="headset" size={16} /> {browserPreview ? 'BROWSER PREVIEW' : 'ENTER XR'}</button>
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

function ConnectScreen({ robotIp, onRobotIpChange, onStart, error }: { robotIp: string; onRobotIpChange: (value: string) => void; onStart: () => void; error: string }) {
  return (
    <main className="connect-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="connect-topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><div className="eyebrow">UNIT T-07 / OPERATOR CONSOLE</div><h1>TELEOPERATION</h1><p>WEBXR ROBOT CONTROL SYSTEM</p></div>
        </div>
        <StatusDot label="SYSTEM READY" />
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
          {error && <p className="connect-error">{error}</p>}
          <p className="connect-note">No HMD detected? The same flow opens Browser Preview so the interface can be tested before hardware is connected.</p>
        </form>
      </section>
      <footer className="connect-footer"><span><i /> HTTPS SECURE CONTEXT</span><span>WEBXR / CAMERA MOCKS ENABLED</span><span>BUILD 0.1.0</span></footer>
    </main>
  )
}

function StateRow({ label, value, tone = 'good' }: { label: string; value: string; tone?: 'good' | 'muted' }) { return <div className="state-row"><span><i className={`state-dot ${tone}`} />{label}</span><b className={tone}>{value}</b></div> }
function GripperRow({ label, value }: { label: string; value: number }) { return <div className="gripper-row"><span>{label}</span><div className="gripper-track"><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div> }
function MiniFeed({ id, title, active, onClick }: { id: 'left' | 'right'; title: string; active: boolean; onClick: () => void }) { return <button className={`mini-feed ${active ? 'selected' : ''}`} onClick={onClick}><div className={`mini-image ${id}`}><div className="mini-crosshair"/><div className="mini-arm"/><CornerFrame /></div><div className="mini-header"><span><Icon name="camera" size={13} />{title}</span><StatusDot label="30 FPS" /></div><div className="mini-footer"><span>DEPTH</span><div className="mini-bar"><i style={{ width: id === 'left' ? '62%' : '76%' }}/></div><b>{id === 'left' ? '0.61' : '0.57'} m</b></div></button> }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
