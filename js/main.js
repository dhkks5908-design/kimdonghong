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

// DOM Elements
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const scoreVal = document.getElementById("score-val");
const levelVal = document.getElementById("level-val");
const timeVal = document.getElementById("time-val");
const finalScoreVal = document.getElementById("final-score");
const gestureFeedback = document.getElementById("gesture-feedback");

/**
 * 애플리케이션 초기화 (Start 버튼 클릭 시)
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  startBtn.disabled = true;
  startBtn.innerHTML = "로딩 중...";

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    // 웹캠 크기를 조금 더 키워서 렌더링
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 400, // 더 큰 해상도
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.7,
      smoothingFrames: 3
    });

    // 3. GameEngine 초기화
    gameEngine = new GameEngine();

    // 4. 캔버스 설정
    const canvas = document.getElementById("canvas");
    canvas.width = 400;
    canvas.height = 400;
    ctx = canvas.getContext("2d");

    // 5. 디버그 패널 (선택사항)
    labelContainer = document.getElementById("label-container");
    if (labelContainer) {
      labelContainer.innerHTML = "";
      for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement("div"));
      }
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. 게임 시작 처리
    startScreen.classList.remove("active");
    poseEngine.start();
    startGameMode({ timeLimit: 60 });

  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 카메라 권한을 확인하세요.");
    startBtn.disabled = false;
    startBtn.innerHTML = "게임 시작";
  }
}

/**
 * 게임 재시작
 */
function restartGame() {
  gameOverScreen.classList.remove("active");
  startGameMode({ timeLimit: 60 });
}

/**
 * 게임 모드 실행
 */
function startGameMode(config) {
  if (!gameEngine) return;

  // 점수판 초기화
  scoreVal.innerText = "0";
  levelVal.innerText = "1";
  timeVal.innerText = config.timeLimit;

  // 게임 엔진 콜백 설정
  gameEngine.setScoreChangeCallback((score, level) => {
    scoreVal.innerText = score;
    levelVal.innerText = level;

    // 점수 획득 시 피드백 애니메이션 (선택 사항)
    scoreVal.style.transform = "scale(1.2)";
    setTimeout(() => scoreVal.style.transform = "scale(1)", 100);
  });

  // 시간 감소 콜백을 위해 별도 인터격 필요하다면 추가 (현재는 loop에서 처리 안하고 engine이 자체 timer 사용)
  // GameEngine에 시간 업데이트 콜백 추가 필요할 수도 있음. 
  // 임시로 GameEngine 내부를 수정하지 않고, requestAnimationFrame loop에서 UI 업데이트

  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    finalScoreVal.innerText = finalScore;
    gameOverScreen.classList.add("active");
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
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0, 400, 400);

    // 2. 키포인트와 스켈레톤 그리기 (반투명하게)
    if (pose) {
      const minPartConfidence = 0.5;
      ctx.globalAlpha = 0.3; // 스켈레톤은 배경처럼 흐리게
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
      ctx.globalAlpha = 1.0;
    }

    // 3. 게임 엔진 업데이트 및 그리기 (게임 활성화 시)
    if (gameEngine && gameEngine.isGameActive) {
      gameEngine.updateAndDraw(ctx, 400, 400);

      // UI에 남은 시간 업데이트 (비효율적일 수 있으나 간단히 구현)
      if (gameEngine.timeLeft >= 0) {
        timeVal.innerText = gameEngine.timeLeft;
      }
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

  // 2. 피드백 UI 표시
  if (stabilized.className) {
    const label = stabilized.className;
    gestureFeedback.innerText = label;
    gestureFeedback.classList.add("active");

    // 일정 시간 후 숨김 (연속 감지 시 계속 떠있음)
    clearTimeout(gestureFeedback.timer);
    gestureFeedback.timer = setTimeout(() => {
      gestureFeedback.classList.remove("active");
    }, 500);
  }

  // 3. 디버그 패널 업데이트
  if (document.getElementById("label-container").style.display !== "none") {
    for (let i = 0; i < predictions.length; i++) {
      const classPrediction =
        predictions[i].className + ": " + predictions[i].probability.toFixed(2);
      labelContainer.childNodes[i].innerHTML = classPrediction;
    }
  }

  // 4. GameEngine에 포즈 전달
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.setBasketPose(stabilized.className);
  }
}

