# T-07 Teleoperation Console

WebXR 기반 Robot Teleoperation MR UI의 Phase 1 프로토타입입니다. 설계서의 world-locked 패널 구성을 데스크톱에서도 확인할 수 있도록 2D preview로 구현했습니다.

## 실행

```bash
npm install
npm run dev
```

`npm run build`로 배포용 빌드를 확인할 수 있습니다.

개발 서버는 WebXR AR/VR을 위해 자동 생성된 HTTPS 인증서로 실행됩니다. 터미널에 표시되는 `https://localhost:5173` 또는 `https://<개발 PC의 LAN IP>:5173` 주소로 접속하세요. 브라우저에서 자체 서명 인증서 경고가 표시되면 개발 환경에서만 인증서를 허용해야 합니다. HMD/모바일에서 인증서가 신뢰되지 않으면 `mkcert` 등으로 신뢰 가능한 로컬 인증서를 발급해 Vite의 `server.https`에 연결하세요.

`ENTER XR`는 `immersive-ar`를 먼저 검사하고, 지원되지 않으면 `immersive-vr`를 시도합니다. Chrome flag(WebXR/WebXR Incubation)를 켜는 것만으로는 실제 XR 장치가 생기지 않으므로, VR은 WebXR 지원 HMD를 연결하고 AR은 AR 지원 모바일/HMD에서 실행해야 합니다. 일반 데스크톱에서는 두 모드 모두 지원되지 않을 수 있습니다.

HMD 없이 테스트할 때는 `ENTER XR`를 누르면 자동으로 `BROWSER PREVIEW` 모드로 전환됩니다. 이 모드에서는 카메라 패널과 텔레오퍼레이션 UI의 클릭/상태 변화를 브라우저에서 확인할 수 있고, 실제 WebXR 렌더링만 생략합니다. 나중에 HMD를 연결하면 같은 버튼으로 실제 AR/VR 세션을 시도합니다.

접속 흐름은 `Main 화면 → Robot IP 입력 → ENTER VR → Teleoperation View`입니다. 콘솔 우측 상단의 `MAIN` 버튼으로 Robot IP 입력 화면으로 돌아갈 수 있습니다.

Chrome 계열 브라우저에서 음성 버튼을 켜면 다음 명령을 사용할 수 있습니다.

- 초기 화면: `connect`, `연결`, `접속`
- 동작 제어: `hold`, `resume`, `start teleop`, `stop teleop`
- 안전 제어: `e-stop`, `emergency stop`, `reset stop`

음성 인식은 Web Speech API를 사용하며 브라우저/권한에 따라 지원 여부가 다릅니다. 마이크 권한을 허용해야 하고, 미지원 브라우저에서는 기존 버튼을 사용하면 됩니다.

## 현재 포함된 기능

- Front Stereo / Left Wrist / Right Wrist mock camera feed
- 카메라 선택에 따른 primary feed 전환과 wrist focus 상태
- Robot connection, camera bus, control link, arm, gripper mock 상태
- Teleop / Auto, speed, arm, XYZ/RPY, Home, Hold, E-STOP 인터랙션
- WebXR `immersive-ar` 지원 여부 확인 및 세션 진입 버튼
- WebRTC 영상과 ROS2/robot gateway를 연결하기 전의 명확한 placeholder 상태

카메라 화면은 `sample_ui.png`를 임시 feed로 사용합니다. 실제 연결 시 `src/main.tsx`의 feed 영역을 `<video>` 기반 `CameraStream` 컴포넌트로 교체하고, 현재 mock status 값은 robot gateway adapter로 치환하면 됩니다.
