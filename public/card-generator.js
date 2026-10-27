// 일일 식단 인증 카드 (Canvas 에디토리얼 디자인) 및 단톡방·네이버 카페 공유 텍스트 생성기

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function formatBlockNum(n) {
  const num = Number(n || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
}

window.ZoneShareHelper = {
  computeTotals(meals = []) {
    return meals.reduce(
      (acc, m) => {
        acc.carb += Number(m.carb || 0);
        acc.protein += Number(m.protein || 0);
        acc.fat += Number(m.fat || 0);
        return acc;
      },
      { carb: 0, protein: 0, fat: 0 }
    );
  },

  computeRatioText(totals) {
    const { carb, protein, fat } = totals;
    if (carb === 0 && protein === 0 && fat === 0) {
      return '0 : 0 : 0 (기록 전)';
    }
    const base = protein > 0 ? protein : Math.max(carb, fat, 1);
    const cR = (carb / base).toFixed(1).replace(/\.0$/, '');
    const pR = (protein / base).toFixed(1).replace(/\.0$/, '');
    const fR = (fat / base).toFixed(1).replace(/\.0$/, '');
    const totalSum = carb + protein + fat;
    const cPct = Math.round((carb / totalSum) * 100);
    const pPct = Math.round((protein / totalSum) * 100);
    const fPct = Math.max(0, 100 - cPct - pPct);
    return `${cR} : ${pR} : ${fR} (${cPct}:${pPct}:${fPct}%)`;
  },

  buildKakaoText({ user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);
    const shortDate = date.slice(5).replace('-', '.');

    const mealLines =
      meals.length > 0
        ? meals
            .map(
              m =>
                `- [${m.type}] 탄 ${formatBlockNum(m.carb)} / 단 ${formatBlockNum(m.protein)} / 지 ${formatBlockNum(m.fat)}${
                  m.memo ? ` · ${m.memo}` : ''
                }`
            )
            .join('\n')
        : '- 등록된 끼니 없음';

    return [
      `[레벤 존다 · ${user.team}조 ${user.name}] ${shortDate} 식단 보고`,
      `──────────────────`,
      `총 섭취 : 탄 ${formatBlockNum(totals.carb)} · 단 ${formatBlockNum(totals.protein)} · 지 ${formatBlockNum(totals.fat)} (목표 ${target}블록)`,
      `탄단지 비율 : ${ratioStr}`,
      `일일 판정 : ${isOver ? '목표 블록 초과' : '목표 블록 내 완료'}`,
      `──────────────────`,
      mealLines,
      `──────────────────`,
      `주간 미션 : ${missionDone ? '완료' : '진행중'}`
    ].join('\n');
  },

  buildCafeTitle({ user, date, meals }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const shortDate = date.slice(5).replace('-', '/');
    return `[존다챌린지/${user.team}조/${user.name}] ${shortDate} 식단 인증 (탄${formatBlockNum(
      totals.carb
    )}·단${formatBlockNum(totals.protein)}·지${formatBlockNum(totals.fat)} / 목표 ${target}블록)`;
  },

  buildCafeBody({ user, date, meals, missionDone, weeklyMissionTitle }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const mealDetails =
      meals.length > 0
        ? meals
            .map(
              (m, idx) =>
                `${idx + 1}. ${m.type} (${m.time || '-'})\n   블록 : 탄수화물 ${formatBlockNum(
                  m.carb
                )} / 단백질 ${formatBlockNum(m.protein)} / 지방 ${formatBlockNum(m.fat)} 블록\n   식단 : ${
                  m.memo || '사진 첨부'
                }`
            )
            .join('\n\n')
        : '기록된 식단이 없습니다.';

    return [
      `참가자 : ${user.team}조 ${user.name}`,
      `인증일 : ${date}`,
      `일일 목표 : 탄 ${target} · 단 ${target} · 지 ${target} 블록`,
      ``,
      `──────────────────────`,
      `1. 일일 섭취 블록 합계 및 비율`,
      `- 탄수화물(C) : ${formatBlockNum(totals.carb)} / ${target} 블록`,
      `- 단백질(P) : ${formatBlockNum(totals.protein)} / ${target} 블록`,
      `- 지방(F) : ${formatBlockNum(totals.fat)} / ${target} 블록`,
      `- 탄:단:지 비율 : ${ratioStr}`,
      `- 준수 여부 : ${isOver ? '목표 블록 초과' : '목표 범위 내 완료'}`,
      ``,
      `──────────────────────`,
      `2. 끼니별 상세 내역`,
      mealDetails,
      ``,
      `──────────────────────`,
      `3. 주간 미션 (${weeklyMissionTitle || '주간 운동 미션'})`,
      `- 상태 : ${missionDone ? '이번 주 미션 완료' : '진행 중'}`
    ].join('\n');
  },

  async renderSummaryCardCanvas(canvas, { user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const mealCount = meals.length;
    const rows = Math.max(1, Math.ceil(Math.max(mealCount, 1) / 2));
    const cardWidth = 960;
    const photoRowHeight = 320;
    const cardHeight = 520 + rows * photoRowHeight + 100;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    // Deep Carbon Editorial Background
    ctx.fillStyle = '#111315';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Top Volt Accent Line
    ctx.fillStyle = isOver ? '#FF4E36' : '#C8F904';
    ctx.fillRect(0, 0, cardWidth, 8);

    // Top Meta Header
    ctx.fillStyle = '#8B929E';
    ctx.font = '700 17px "Pretendard", -apple-system, sans-serif';
    ctx.fillText('CROSSFIT LEBEN  ·  ZONE DIET CHALLENGE', 56, 66);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 44px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`${user.team}조 ${user.name}`, 56, 122);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 22px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`${date.replace(/-/g, '.')}   ·   DAILY TARGET ${target} BLOCKS`, 56, 160);

    // Right Status Pill
    ctx.save();
    roundRect(ctx, 684, 64, 220, 76, 16);
    ctx.fillStyle = isOver ? 'rgba(255, 78, 54, 0.14)' : 'rgba(200, 249, 4, 0.12)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isOver ? '#FF4E36' : '#C8F904';
    ctx.stroke();

    ctx.fillStyle = isOver ? '#FF6B57' : '#C8F904';
    ctx.font = '800 20px "Pretendard", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isOver ? 'OVER TARGET' : 'TARGET CLEARED', 794, 98);
    ctx.fillStyle = '#D1D5DB';
    ctx.font = '600 15px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(missionDone ? 'WEEKLY MISSION DONE' : 'DAILY DIET LOGGED', 794, 123);
    ctx.restore();

    // 3-Column Macro Bento Box
    const bentoY = 198;
    const bentoW = (cardWidth - 112 - 32) / 3;
    const bentoH = 196;
    const macroCards = [
      { code: 'CARB · 탄수화물', val: totals.carb, color: '#38BDF8', sub: '9g per block' },
      { code: 'PROTEIN · 단백질', val: totals.protein, color: '#C8F904', sub: '7g per block' },
      { code: 'FAT · 지방', val: totals.fat, color: '#FBBF24', sub: '1.5g per block' }
    ];

    macroCards.forEach((mc, i) => {
      const bx = 56 + i * (bentoW + 16);
      roundRect(ctx, bx, bentoY, bentoW, bentoH, 20);
      ctx.fillStyle = '#1A1D21';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.stroke();

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '700 16px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(mc.code, bx + 24, bentoY + 40);

      const overMacro = mc.val > target;
      ctx.fillStyle = overMacro ? '#FF4E36' : '#FFFFFF';
      ctx.font = '800 44px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(formatBlockNum(mc.val), bx + 24, bentoY + 102);

      const numWidth = ctx.measureText(formatBlockNum(mc.val)).width;
      ctx.fillStyle = '#6B7280';
      ctx.font = '600 22px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`/ ${target}B`, bx + 32 + numWidth, bentoY + 100);

      // Progress track
      const trackX = bx + 24;
      const trackY = bentoY + 132;
      const trackW = bentoW - 48;
      roundRect(ctx, trackX, trackY, trackW, 10, 5);
      ctx.fillStyle = '#272B31';
      ctx.fill();

      const fillW = Math.max(8, Math.min(trackW, trackW * (mc.val / Math.max(target, 1))));
      roundRect(ctx, trackX, trackY, fillW, 10, 5);
      ctx.fillStyle = overMacro ? '#FF4E36' : mc.color;
      ctx.fill();

      ctx.fillStyle = '#6B7280';
      ctx.font = '500 14px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(mc.sub, bx + 24, bentoY + 170);
    });

    // Ratio Strip
    roundRect(ctx, 56, 412, cardWidth - 112, 54, 14);
    ctx.fillStyle = '#1A1D21';
    ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 17px "Pretendard", -apple-system, sans-serif';
    ctx.fillText('BALANCE RATIO (C : P : F)', 80, 445);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px "Pretendard", -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(ratioStr, cardWidth - 80, 445);
    ctx.textAlign = 'left';

    // Meals Section Header
    ctx.fillStyle = '#8B929E';
    ctx.font = '700 16px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`MEAL LOGS (${mealCount})`, 56, 504);

    const gridStartY = 524;
    const colW = (cardWidth - 112 - 24) / 2;
    const cellH = 296;

    if (mealCount === 0) {
      roundRect(ctx, 56, gridStartY, cardWidth - 112, 220, 20);
      ctx.fillStyle = '#1A1D21';
      ctx.fill();
      ctx.fillStyle = '#6B7280';
      ctx.font = '600 22px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('등록된 식단 사진이 없습니다.', cardWidth / 2, gridStartY + 115);
      ctx.textAlign = 'left';
    } else {
      const images = await Promise.all(meals.map(m => loadImage(m.photoDataUrl)));

      meals.forEach((meal, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = 56 + col * (colW + 24);
        const y = gridStartY + row * photoRowHeight;

        roundRect(ctx, x, y, colW, cellH, 20);
        ctx.fillStyle = '#1A1D21';
        ctx.fill();

        ctx.save();
        roundRect(ctx, x, y, colW, 206, 20);
        ctx.clip();
        const img = images[idx];
        if (img) {
          const scale = Math.max(colW / img.width, 206 / img.height);
          const sw = img.width * scale;
          const sh = img.height * scale;
          const sx = x + (colW - sw) / 2;
          const sy = y + (206 - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh);
        } else {
          ctx.fillStyle = '#23272E';
          ctx.fillRect(x, y, colW, 206);
        }

        // Top Pill
        roundRect(ctx, x + 16, y + 16, 108, 32, 16);
        ctx.fillStyle = 'rgba(17, 19, 21, 0.82)';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 15px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(`${meal.type} ${meal.time || ''}`, x + 30, y + 37);
        ctx.restore();

        // Bottom caption
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 20px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(
          `C ${formatBlockNum(meal.carb)}  ·  P ${formatBlockNum(meal.protein)}  ·  F ${formatBlockNum(meal.fat)} BLOCK`,
          x + 22,
          y + 242
        );

        ctx.fillStyle = '#8B929E';
        ctx.font = '500 16px "Pretendard", -apple-system, sans-serif';
        const memoText = meal.memo || '식단 기록 완료';
        const clippedMemo = memoText.length > 24 ? memoText.slice(0, 24) + '…' : memoText;
        ctx.fillText(clippedMemo, x + 22, y + 272);
      });
    }

    // Minimal Footer
    const footerY = cardHeight - 40;
    ctx.fillStyle = '#525866';
    ctx.font = '600 15px "Pretendard", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFIED DAILY LOG  ·  CROSSFIT LEBEN ZONE CHALLENGE', cardWidth / 2, footerY);
    ctx.textAlign = 'left';
  }
};
