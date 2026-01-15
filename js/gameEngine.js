/**
 * gameEngine.js
 * 떨어지는 과일 받기 게임 (Catch Zone) 로직 구현
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.timeLeft = 60;
    this.isGameActive = false;
    
    // 게임 오브젝트
    this.basketPos = 1; // 0: Left, 1: Center, 2: Right
    this.items = []; // 낙하물 배열 { x, y, type, speed }
    this.lanes = [0.16, 0.5, 0.84]; // 3개 레인의 x 좌표 비율 (화면 너비 기준)
    
    // 설정
    this.spawnRate = 60; // 아이템 생성 주기 (프레임 단위)
    this.frameCount = 0;
    
    // 콜백
    this.onScoreChange = null;
    this.onGameEnd = null;
  }

  start(config = {}) {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = config.timeLimit || 60;
    this.timeLeft = this.timeLimit;
    this.items = [];
    this.basketPos = 1;
    this.frameCount = 0;

    // 타이머 시작 (1초마다 감소)
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isGameActive) {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.stop();
        }
      }
    }, 1000);
  }

  stop() {
    this.isGameActive = false;
    clearInterval(this.timerInterval);
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 메인 게임 루프 업데이트
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   */
  updateAndDraw(ctx, canvasWidth, canvasHeight) {
    if (!this.isGameActive) return;

    this.frameCount++;

    // 1. 아이템 생성
    // 레벨이 오를수록 생성 주기 빨라짐
    const currentSpawnRate = Math.max(20, this.spawnRate - (this.level * 5));
    if (this.frameCount % currentSpawnRate === 0) {
      this.spawnItem(canvasWidth);
    }

    // 2. 아이템 이동 및 충돌 처리
    this.updateItems(canvasHeight, canvasWidth);

    // 3. 화면 그리기
    this.draw(ctx, canvasWidth, canvasHeight);
  }

  spawnItem(canvasWidth) {
    const laneIndex = Math.floor(Math.random() * 3);
    const x = this.lanes[laneIndex] * canvasWidth;
    
    // 20% 확률로 폭탄, 80% 확률로 사과
    // 레벨이 높으면 폭탄 확률 증가
    const bombChance = 0.2 + (this.level * 0.05);
    const type = Math.random() < bombChance ? 'bomb' : 'apple';
    
    // 낙하 속도 (레벨 비례)
    const speed = 2 + (this.level * 0.5) + (Math.random() * 1);

    this.items.push({
      x: x,
      y: -30, // 화면 위에서 시작
      lane: laneIndex,
      type: type,
      speed: speed,
      active: true
    });
  }

  updateItems(canvasHeight, canvasWidth) {
    // 바구니 히트박스 (간단하게 레인 인덱스로 비교)
    
    for (let item of this.items) {
      if (!item.active) continue;

      item.y += item.speed;

      // 충돌 판정 (바구니 높이와 근접하고, 같은 레인일 때)
      // 바구니는 바닥 쪽에 위치 (약 80%~90% 지점)
      const basketY = canvasHeight * 0.85;
      
      if (item.y >= basketY - 20 && item.y <= basketY + 20) {
        if (item.lane === this.basketPos) {
          this.handleCollision(item);
        }
      }

      // 화면 밖으로 나가면 제거
      if (item.y > canvasHeight) {
        item.active = false;
      }
    }

    // 비활성 아이템 제거
    this.items = this.items.filter(item => item.active);
  }

  handleCollision(item) {
    item.active = false; // 아이템 획득 처리

    if (item.type === 'apple') {
      this.score += 10;
    } else if (item.type === 'bomb') {
      this.score -= 50;
    }

    // 레벨업 체크 (300점 단위)
    const newLevel = 1 + Math.floor(this.score / 300);
    if (newLevel !== this.level) {
      this.level = newLevel;
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }
  }

  draw(ctx, canvasWidth, canvasHeight) {
    const basketY = canvasHeight * 0.85;

    // 1. 레인 구분선 그리기 (선택사항)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvasWidth * 0.33, 0);
    ctx.lineTo(canvasWidth * 0.33, canvasHeight);
    ctx.moveTo(canvasWidth * 0.66, 0);
    ctx.lineTo(canvasWidth * 0.66, canvasHeight);
    ctx.stroke();

    // 2. 바구니 그리기
    const basketX = this.lanes[this.basketPos] * canvasWidth;
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧺', basketX, basketY);

    // 3. 아이템 그리기
    for (let item of this.items) {
      ctx.font = '30px Arial';
      if (item.type === 'apple') {
        ctx.fillText('🍎', item.x, item.y);
      } else {
        ctx.fillText('💣', item.x, item.y);
      }
    }

    // 4. UI 정보 (남은 시간, 점수)
    // (메인 UI가 아니라 캔버스에 직접 그리는 경우)
    /*
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${this.timeLeft}`, 10, 20);
    ctx.fillText(`Score: ${this.score}`, 10, 40);
    */
  }

  /**
   * 포즈 입력을 받아 바구니 위치 업데이트
   * @param {string} poseLabel 
   */
  setBasketPose(poseLabel) {
    if (poseLabel === '왼쪽') {
      this.basketPos = 0;
    } else if (poseLabel === '정면') {
      this.basketPos = 1;
    } else if (poseLabel === '오른쪽') {
      this.basketPos = 2;
    }
  }

  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }
}

window.GameEngine = GameEngine;
