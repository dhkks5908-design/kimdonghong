/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 *
 * PoseEngine, GameEngine, Stabilizer를 조합하여 애플리케이션을 구동
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.7,
      smoothingFrames: 3
    });

    // 3. GameEngine 초기화 (선택적)
    gameEngine = new GameEngine();

    // 4. 캔버스 설정
    const canvas = document.getElementById("canvas");
    canvas.width = 200;
    canvas.height = 200;
    ctx = canvas.getContext("2d");

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = ""; // 초기화
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. PoseEngine 시작
    poseEngine.start();

    stopBtn.disabled = false;
  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine && gameEngine.isGameActive) {
    gameEngine.stop();
  }

  if (stabilizer) {
    stabilizer.reset();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

// 게임 모드 시작 함수
function startGameMode(config) {
  if (!gameEngine) {
    console.warn("GameEngine이 초기화되지 않았습니다.");
    return;
  }

  // 기존 콜백 제거 (중복 방지)
  gameEngine.setScoreChangeCallback(null);
  gameEngine.setGameEndCallback(null);

  gameEngine.setScoreChangeCallback((score, level) => {
    // console.log(`점수: ${score}, 레벨: ${level}`);
    const scoreBoard = document.getElementById("label-container");
    if (scoreBoard) {
      // 간단하게 첫 번째 요소에 점수 표시 (기존 라벨 덮어쓰기)
      // 실제로는 별도 UI 요소가 있는 것이 좋으나 템플릿 구조 유지를 위해
      scoreBoard.childNodes[0].innerText = `점수: ${score} (Lv.${level})`;
      scoreBoard.childNodes[1].innerText = `남은 시간: ${gameEngine.timeLeft}초`;
    }
  });

  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    alert(`게임 종료!\n최종 점수: ${finalScore}\n최종 레벨: ${finalLevel}`);
  });

  gameEngine.start(config);
}

/**
 * 포즈 그리기 및 게임 렌더링 콜백
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    // 1. 웹캠 그리기
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    // 2. 키포인트와 스켈레톤 그리기 (선택)
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }

    // 3. 게임 엔진 업데이트 및 그리기 (게임 활성화 시)
    if (gameEngine && gameEngine.isGameActive) {
      gameEngine.updateAndDraw(ctx, canvas.width, canvas.height);
    }
  }
}

/**
 * 예측 결과 처리 콜백
 * @param {Array} predictions - TM 모델의 예측 결과
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Label Container 업데이트 (게임 중이 아닐 때만 상세 표시)
  if (!gameEngine || !gameEngine.isGameActive) {
    for (let i = 0; i < predictions.length; i++) {
      const classPrediction =
        predictions[i].className + ": " + predictions[i].probability.toFixed(2);
      labelContainer.childNodes[i].innerHTML = classPrediction;
    }
  }

  // 3. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "감지 중...";

  // 4. GameEngine에 포즈 전달 (게임 모드일 경우)
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    // gameEngine.onPoseDetected(stabilized.className); // 구형 메서드
    gameEngine.setBasketPose(stabilized.className); // 신형 메서드
  }
}
