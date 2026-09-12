# WebXR 기반 Robot Teleoperation MR UI 설계서

## 1. 목적

본 시스템은 VR/MR HMD를 사용하는 로봇 Teleoperation 환경에서 Operator가 로봇의 카메라 영상과 최소한의 상태 정보를 직관적으로 확인하면서 로봇을 조작할 수 있도록 하는 WebXR 기반 UI를 구현하는 것을 목표로 한다.

핵심 방향은 다음과 같다.

- 시스템/CPU/GPU 등의 상세 장비 정보는 기본 UI에서 제외
- Front Stereo Camera를 Main View로 사용
- Left/Right Wrist Camera를 보조 View로 사용
- 로봇의 상태는 숫자보다 상태 중심으로 표시
- UI를 2D 모니터처럼 구성하지 않고 3D 공간에 배치
- 사용자의 시선과 조작 대상에 따라 Camera View를 동적으로 강조
- E-STOP, HOLD 등 안전 기능은 항상 접근 가능하도록 유지
- 추후 ROS 2 및 실제 Camera Manager와 연결 가능한 구조로 설계

---

# 2. UX 핵심 원칙

### 2.1 정보 우선순위

Operator가 가장 먼저 알아야 하는 정보는 다음과 같다.

1. 현재 무엇을 보고 있는가?
2. 로봇이 정상적으로 연결되어 있는가?
3. 어느 Arm을 조작하고 있는가?
4. 현재 조작 대상이 무엇인가?
5. 카메라 영상이 정상적으로 들어오는가?
6. 위험 상황이 발생했는가?

따라서 UI 정보 우선순위를 다음과 같이 정의한다.

```text
HIGH
 ├── Front Stereo Camera
 ├── Active Arm
 ├── Robot Connection
 ├── Camera Connection
 ├── Emergency / Warning
 └── Target / Manipulation State

MEDIUM
 ├── Left Wrist Camera
 ├── Right Wrist Camera
 ├── Gripper State
 └── Teleop Speed

LOW
 ├── FPS
 ├── Latency
 ├── Position / Rotation
 └── 기타 Debug 정보

DEBUG ONLY
 ├── CPU
 ├── GPU
 ├── Memory
 ├── Network Bandwidth
 └── Sensor Temperature
```

LOW/DEBUG 정보는 일반 사용자에게 항상 노출하지 않고 Debug Mode에서만 표시한다.

---

# 3. 전체 공간 구성

WebXR 환경에서는 화면 전체를 하나의 평면 UI로 만들지 않는다.

기본 공간 구조는 다음과 같다.

```text
                     USER

                      👁
                      │
                      │
             ┌──────────────────┐
             │                  │
             │   FRONT STEREO   │
             │                  │
             │     TARGET       │
             │        ◎         │
             └──────────────────┘
                    2~3m


       ┌──────────┐          ┌──────────┐
       │ L WRIST  │          │ R WRIST  │
       │  CAMERA  │          │  CAMERA  │
       └──────────┘          └──────────┘
             ↓                     ↓
          LEFT ARM              RIGHT ARM


              ┌────────────────┐
              │ TELEOP / SPEED │
              │ HOME HOLD STOP │
              └────────────────┘
```

기본적으로 UI는 `world-locked` 형태로 배치한다.

단, 모든 UI를 world-locked로 만들면 사용자가 고개를 돌렸을 때 UI를 놓칠 수 있으므로 일부 중요 UI는 head-relative 또는 semi-fixed 방식으로 구성한다.

---

# 4. UI Layout

## 4.1 Main View

Front Stereo Camera가 가장 큰 UI 요소이다.

```text
┌──────────────────────────────────────┐
│ FRONT STEREO              ● 30 FPS   │
│                                      │
│                                      │
│              TARGET                  │
│                ◎                     │
│                                      │
│                                      │
│                                      │
│ L ARM                         R ARM  │
└──────────────────────────────────────┘
```

표시 정보:

- Camera Name
- Stereo 상태
- FPS
- Target
- Distance
- Depth
- Robot pose overlay
- 필요 시 Object Detection 결과

영상 자체가 가장 중요한 정보이므로 UI Overlay는 최소화한다.

---

# 5. Wrist Camera

Left/Right Wrist Camera는 Front Stereo보다 작은 Floating Panel로 표시한다.

```text
        ┌─────────────────┐
        │ LEFT WRIST      │
        │                 │
        │     CAMERA      │
        │                 │
        │ ● ONLINE 30FPS  │
        └─────────────────┘


        ┌─────────────────┐
        │ RIGHT WRIST     │
        │                 │
        │     CAMERA      │
        │                 │
        │ ● ONLINE 30FPS  │
        └─────────────────┘
```

공간 배치는 실제 Robot Arm의 위치와 대응시킨다.

```text
             ROBOT

       LEFT ARM       RIGHT ARM
          │               │
          ↓               ↓

      [L WRIST]       [R WRIST]
```

이를 통해 사용자는 "어느 Camera가 어느 Arm을 보고 있는지"를 별도의 설명 없이 이해할 수 있어야 한다.

---

# 6. Camera Focus Mode

Wrist Camera는 단순한 고정 Window가 아니라 Focus 기능을 갖는다.

기본:

```text
Front Stereo
     70%

Left Wrist
     15%

Right Wrist
     15%
```

Left Arm 조작 시:

```text
Front Stereo
     50%

Left Wrist
     35%

Right Wrist
     15%
```

Right Arm 조작 시:

```text
Front Stereo
     50%

Left Wrist
     15%

Right Wrist
     35%
```

사용자가 Wrist Camera를 직접 선택할 경우:

```text
            ┌─────────────────────┐
            │                     │
            │     LEFT WRIST      │
            │                     │
            │       CAMERA        │
            │                     │
            └─────────────────────┘
```

해당 View를 사용자의 시야 중심 방향으로 이동시킨다.

---

# 7. Robot Status

상세 Telemetry를 보여주지 않고 상태만 표시한다.

```text
ROBOT STATUS

● Connection     ONLINE
● Camera         ONLINE
● Control        ONLINE

ARM

● Left           ACTIVE
○ Right          IDLE

GRIPPER

Left             62%
Right            81%
```

상태 종류:

```text
ONLINE
ACTIVE
IDLE
WARNING
ERROR
DISCONNECTED
```

색상은 의미가 명확하도록 제한한다.

```text
NORMAL      Cyan / Green
WARNING     Amber
ERROR       Red
INACTIVE    Gray
```

색상 외에도 아이콘/텍스트를 함께 사용한다.

---

# 8. Camera Status

Camera Manager와 연동한다.

```text
CAMERA

● FRONT STEREO       ONLINE
● LEFT WRIST         ONLINE
● RIGHT WRIST        ONLINE
```

Camera 장애:

```text
⚠ RIGHT WRIST CAMERA

NO STREAM

[ RETRY ]
```

Camera 연결은 정상이나 영상이 들어오지 않는 경우도 별도 상태로 처리한다.

```text
CONNECTED
STREAMING
NO_STREAM
ERROR
DISCONNECTED
```

예:

```text
● USB Connected
● Device Detected
✕ Stream
```

---

# 9. Teleoperation Control Bar

사용자의 시야 하단에 항상 접근 가능한 Control Bar를 배치한다.

```text
┌─────────────────────────────────────────────────────────┐
│ MODE     SPEED       ARM        MOTION       CONTROL    │
│                                                         │
│ TELEOP   ██████ 70%  [ L ] [ R ]   XYZ     HOME HOLD   │
│                                                   E-STOP │
└─────────────────────────────────────────────────────────┘
```

필수 버튼:

- TELEOP
- AUTO
- Speed
- Left Arm
- Right Arm
- Home
- Hold
- E-STOP

E-STOP은 항상 별도의 강한 시각적 영역에 둔다.

---

# 10. E-STOP

E-STOP은 일반 UI와 다른 레이어로 취급한다.

```text
┌──────────────┐
│              │
│   ⚠ E-STOP   │
│              │
└──────────────┘
```

항상 접근 가능해야 하며:

- Controller Button
- Hand Tracking
- UI Button

중 최소 2개 이상의 입력 경로를 제공하는 것을 권장한다.

실제 로봇 안전 회로의 E-STOP은 WebXR UI에 의존하지 않는다.

WebXR의 E-STOP 버튼은 "명령 전달 UI"이며 실제 Safety E-Stop은 별도의 안전 시스템에서 처리한다.

---

# 11. MR 공간 Anchoring

WebXR에서는 UI를 3D 공간의 특정 위치에 배치한다.

예:

```text
Front Stereo
position = (0, 1.5, -2.5)

Left Wrist
position = (-1.4, 1.1, -1.8)

Right Wrist
position = (1.4, 1.1, -1.8)

Control Bar
position = (0, 0.4, -1.5)
```

초기에는 고정 좌표 기반으로 구현하고 이후 Anchor/Hit Test 기반으로 발전시킨다.

WebXR의 reference space는 XR 환경에서 가상 객체의 위치와 방향을 정의하는 핵심 개념이며, `local-floor` 등의 reference space를 사용할 수 있다.

---

# 12. WebXR Session 구조

초기 개발 단계:

```text
Browser
   │
   ▼
Three.js
   │
   ▼
WebXR
   │
   ├── immersive-vr
   │
   └── immersive-ar
```

WebXR 지원 여부 확인:

```javascript
if (navigator.xr) {
    const supported =
        await navigator.xr.isSessionSupported("immersive-vr");
}
```

MR 지원 기기에서는:

```javascript
const session =
    await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local-floor"],
        optionalFeatures: [
            "hit-test",
            "anchors",
            "hand-tracking",
            "depth-sensing"
        ]
    });
```

실제 지원 여부는 브라우저/기기별로 확인해야 한다. WebXR은 `navigator.xr.isSessionSupported()`를 통해 세션 지원 여부를 확인하는 것이 기본적인 초기화 흐름이다.

---

# 13. 권장 기술 Stack

## Frontend

```text
React
   +
TypeScript
   +
Three.js
   +
@react-three/fiber
   +
@react-three/xr
```

또는 초기 Prototype에서는:

```text
React
+
Three.js
+
WebXR
```

만으로 시작한다.

Three.js의 `WebXRManager`가 WebXR Device API와 렌더러 사이를 추상화하며 XR session, controller, reference space 등을 관리할 수 있다.

---

# 14. UI Component 구조

권장 React Component 구조:

```text
src/
├── app/
│   └── App.tsx
│
├── xr/
│   ├── XRScene.tsx
│   ├── XRSession.ts
│   ├── XRReferenceSpace.ts
│   └── XRInput.ts
│
├── components/
│   ├── CameraPanel/
│   │   ├── FrontStereo.tsx
│   │   ├── LeftWrist.tsx
│   │   └── RightWrist.tsx
│   │
│   ├── RobotStatus/
│   │   ├── ConnectionStatus.tsx
│   │   ├── ArmStatus.tsx
│   │   └── GripperStatus.tsx
│   │
│   ├── Control/
│   │   ├── TeleopMode.tsx
│   │   ├── SpeedControl.tsx
│   │   ├── ArmSelector.tsx
│   │   └── EmergencyStop.tsx
│   │
│   └── HUD/
│       ├── TargetMarker.tsx
│       ├── DepthOverlay.tsx
│       └── WarningOverlay.tsx
│
├── robot/
│   ├── RobotState.ts
│   ├── RobotClient.ts
│   └── RobotCommand.ts
│
├── camera/
│   ├── CameraManager.ts
│   ├── CameraState.ts
│   └── CameraStream.ts
│
└── store/
    └── teleopStore.ts
```

---

# 15. 상태 관리

Global State는 다음 정도로 단순하게 유지한다.

```typescript
interface TeleopState {

    mode: "teleop" | "autonomous";

    activeArm: "left" | "right" | "both";

    speed: number;

    robot: {
        connection: "online" | "offline";
        control: "online" | "offline";
    };

    cameras: {
        front: CameraState;
        leftWrist: CameraState;
        rightWrist: CameraState;
    };

    gripper: {
        left: number;
        right: number;
    };

    target?: {
        id: string;
        distance: number;
        position: Vector3;
    };

    warning?: {
        level: "warning" | "error";
        message: string;
    };
}
```

---

# 16. Camera State

Camera Manager에서 UI로 전달할 데이터는 최소화한다.

```typescript
interface CameraState {

    id: string;

    name: string;

    type:
        | "stereo"
        | "wrist"
        | "rgb"
        | "depth";

    connection:
        | "connected"
        | "disconnected";

    stream:
        | "streaming"
        | "no_stream"
        | "error";

    fps: number;

    latency?: number;
}
```

실제 Camera Driver 정보:

```text
ZED
RealSense
Astra
OG5820
See3CAM
...
```

등은 Camera Manager 내부에서 처리한다.

UI에는:

```text
FRONT STEREO
LEFT WRIST
RIGHT WRIST
```

만 노출한다.

---

# 17. Robot ↔ UI 통신 구조

권장 구조:

```text
             Robot
               │
               │ ROS 2
               ▼
        ┌───────────────┐
        │ Robot Backend │
        └───────┬───────┘
                │
        WebSocket / WebRTC
                │
                ▼
        ┌───────────────┐
        │ WebXR Client  │
        └───────┬───────┘
                │
             Three.js
                │
                ▼
              HMD
```

영상:

```text
Camera
  │
  ▼
Encoder
  │
  ▼
WebRTC
  │
  ▼
WebXR CameraPanel
```

Robot command:

```text
Controller
    │
    ▼
WebXR Input
    │
    ▼
Command API
    │
    ▼
ROS 2
    │
    ▼
Robot
```

실시간 영상은 가능하면 WebRTC 기반으로 설계한다.

WebSocket은 상태/명령 전달에 사용하고, 고대역폭 Camera Stream과 분리한다.

---

# 18. WebXR Input

초기에는 Controller Input을 우선 지원한다.

```text
Controller

Trigger
 └── Select

Grip
 └── Grab / Manipulation

Thumbstick
 └── UI Navigation

Menu
 └── UI Toggle
```

WebXR은 controller/input source의 target ray와 action 이벤트를 제공하므로 3D UI 선택에 활용할 수 있다.

추후:

```text
Hand Tracking
      │
      ├── Pinch
      ├── Grab
      └── Point
```

으로 확장한다.

---

# 19. UI Interaction

3D Panel은 다음 상태를 가진다.

```text
DEFAULT
   ↓
HOVER
   ↓
SELECT
   ↓
ACTIVE
```

예:

```text
DEFAULT

┌──────────────┐
│ LEFT WRIST   │
└──────────────┘


HOVER

┌══════════════┐
║ LEFT WRIST   ║
└══════════════┘


ACTIVE

┌══════════════┐
║ ● LEFT WRIST ║
║   ACTIVE     ║
└══════════════┘
```

---

# 20. Warning System

경고는 화면 전체를 덮지 않고 해당 대상 주변에 표시한다.

예:

```text
RIGHT WRIST

       ⚠
   NO STREAM
```

심각도가 높은 경우에만 중앙 Warning을 사용한다.

```text
┌────────────────────────────┐
│                            │
│       ⚠ WARNING            │
│                            │
│ RIGHT ARM COMMUNICATION    │
│ LOST                       │
│                            │
└────────────────────────────┘
```

---

# 21. Depth / Target Overlay

Front Stereo Camera에는 카메라 영상 위에 최소한의 공간 정보를 표시한다.

```text
              TARGET

              ┌─────┐
              │  ◎  │
              └─────┘

              0.42 m
```

Depth:

```text
DISTANCE

0.42 m
```

필요하면:

```text
SAFE
WARNING
COLLISION
```

영역을 표시한다.

WebXR 자체에서도 depth sensing 및 hit-test 관련 기능이 제공되지만 실제 지원 여부는 기기/브라우저에 따라 달라지므로 초기 Prototype에서는 Robot의 Stereo/Depth 데이터와 WebXR의 spatial information을 분리해서 설계하는 것이 좋다.

---

# 22. 초기 Prototype 범위

첫 번째 버전에서는 기능을 최소화한다.

### Phase 1 — WebXR UI Prototype

```text
[✓] WebXR Session
[✓] 3D Floating Panel
[✓] Front Stereo Panel
[✓] Left Wrist Panel
[✓] Right Wrist Panel
[✓] Robot Status
[✓] Teleop Control
[✓] E-STOP UI
[✓] Controller Ray
[✓] Panel Selection
```

실제 Robot 연결은 하지 않고 Mock Data를 사용한다.

---

# 23. Phase 2 — Camera 연결

```text
WebXR
  │
  ├── Front Stereo
  ├── Left Wrist
  └── Right Wrist
```

WebRTC 또는 테스트용 video stream을 연결한다.

Camera Manager 상태:

```text
ONLINE
NO_STREAM
ERROR
```

를 UI에 반영한다.

---

# 24. Phase 3 — ROS 2 연결

```text
ROS 2
 │
 ├── /robot/state
 ├── /robot/joint_states
 ├── /robot/gripper
 ├── /camera/status
 └── /teleop/command
```

Backend에서 WebSocket/WebRTC gateway를 구성한다.

---

# 25. Phase 4 — Spatial UI

다음 기능을 추가한다.

```text
[ ] Spatial Anchor
[ ] Hit Test
[ ] Hand Tracking
[ ] Depth Sensing
[ ] Robot Spatial Marker
[ ] Arm-linked Wrist Camera
```

이 단계부터 실제 MR 느낌이 만들어진다.

---

# 26. 권장 초기 화면

최초 Prototype은 다음 구성으로 시작한다.

```text
                    FRONT STEREO
                ┌───────────────────┐
                │                   │
                │      TARGET       │
                │         ◎         │
                │                   │
                └───────────────────┘


        ┌───────────┐       ┌───────────┐
        │ L WRIST   │       │ R WRIST   │
        │           │       │           │
        │  CAMERA   │       │  CAMERA   │
        └───────────┘       └───────────┘


                 ┌─────────────┐
                 │ TELEOP      │
                 │ SPEED 70%   │
                 │ L   R       │
                 │ HOME HOLD   │
                 │     E-STOP  │
                 └─────────────┘
```

오른쪽 상단에는 최소한의 상태만 표시한다.

```text
● ROBOT ONLINE
● CAMERA ONLINE
● CONTROL ONLINE
```

---

# 27. 개발 시 중요한 설계 원칙

### UI와 Robot Logic을 분리한다.

잘못된 구조:

```text
React Component
    ↓
ROS command
    ↓
Robot
```

권장:

```text
React UI
    ↓
Teleop Controller
    ↓
Robot Gateway
    ↓
ROS 2
```

Camera도 동일하다.

```text
Camera UI
    ↓
Camera Service
    ↓
Camera Manager
    ↓
Camera Driver
```

이렇게 하면 추후 Camera 종류가

```text
ZED
Astra
RealSense
OG5820
See3CAM
```

으로 변경되어도 UI를 수정할 필요가 없다.

---

# 28. 최종 목표

최종 UI는 일반적인 Dashboard가 아니라 다음 구조를 목표로 한다.

```text
                 REAL WORLD
                     +
               ROBOT STATE
                     +
              CAMERA STREAM
                     +
              SPATIAL UI
                     +
               XR INPUT
                     │
                     ▼
              TELEOPERATOR
```

즉,

**"로봇을 조종하기 위해 Dashboard를 보는 것"**

이 아니라

**"실제 로봇 주변을 보면서 필요한 정보만 공간적으로 확인하고 조작하는 것"**

을 목표로 한다.

이 구조를 사용하면 이후 WebXR Prototype에서 실제 MR Teleoperation 시스템으로 자연스럽게 확장할 수 있다.