// 하루 식단 요약 카드 (Canvas 이미지 생성기) 및 단톡방/네이버카페 공유 텍스트 생성기

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
    return `${cR} : ${pR} : ${fR} (블록비율 ${cPct}:${pPct}:${fPct}%)`;
  },

  buildKakaoText({ user, date, meals, missionDone, challengeName }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const mealLines =
      meals.length > 0
        ? meals
            .map(
              m =>
                `• [${m.type}] 탄 ${formatBlockNum(m.carb)} / 단 ${formatBlockNum(m.protein)} / 지 ${formatBlockNum(m.fat)}${
                  m.memo ? ` (${m.memo})` : ''
                }`
            )
            .join('\n')
        : '• 등록된 끼니 없음';

    return [
      `🔥 [${challengeName || '레벤 존다 챌린지'}] ${user.team}조 ${user.name} 식단 보고`,
      `📅 일자: ${date}`,
      `━━━━━━━━━━━━━━━━━━`,
      `📊 총 섭취 블록 (목표: 각 ${target}블록)`,
      `• 탄수화물: ${formatBlockNum(totals.carb)} / ${target}블록`,
      `• 단백질: ${formatBlockNum(totals.protein)} / ${target}블록`,
      `• 지방: ${formatBlockNum(totals.fat)} / ${target}블록`,
      `⚖️ 탄:단:지 비율: ${ratioStr}`,
      `🚦 상태: ${isOver ? '⚠️ 목표 블록 초과' : '✅ 목표 블록 이내 완료'}`,
      `━━━━━━━━━━━━━━━━━━`,
      `🍽️ 끼니별 상세 기록 (${meals.length}끼)`,
      mealLines,
      `━━━━━━━━━━━━━━━━━━`,
      `🏋️ 이번 주 미션운동: ${missionDone ? '완료 ✅' : '진행중 ⏳'}`
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
                `${idx + 1}. [${m.type} | ${m.time || '-'}]\n   - 블록: 탄수화물 ${formatBlockNum(
                  m.carb
                )}블록 / 단백질 ${formatBlockNum(m.protein)}블록 / 지방 ${formatBlockNum(m.fat)}블록\n   - 메뉴: ${
                  m.memo || '사진 첨부'
                }`
            )
            .join('\n\n')
        : '기록된 식단이 없습니다.';

    return [
      `■ 참가자 정보: ${user.team}조 ${user.name} (${user.role || '조원'})`,
      `■ 인증 일자: ${date} (밤 12시 전 작성)`,
      `■ 일일 목표 블록: 탄 ${target} / 단 ${target} / 지 ${target} 블록`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `[1] 오늘 총 섭취 블록 및 탄단지 비율`,
      `• 탄수화물(C): 총 ${formatBlockNum(totals.carb)}블록 (목표 ${target}블록)`,
      `• 단백질(P): 총 ${formatBlockNum(totals.protein)}블록 (목표 ${target}블록)`,
      `• 지방(F): 총 ${formatBlockNum(totals.fat)}블록 (목표 ${target}블록)`,
      `• 탄:단:지 블록 비율: ${ratioStr}`,
      `• 블록 준수 여부: ${isOver ? '목표 블록 초과 ⚠️' : '정량 준수 완료 ✅'}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `[2] 끼니별 식단 및 블록 내역`,
      mealDetails,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `[3] 주간 미션 운동 (${weeklyMissionTitle || '주간 미션'})`,
      `• 수행 여부: ${missionDone ? '이번 주 미션 완료 ✅' : '이번 주 내 완료 예정 ⏳'}`,
      ``,
      `※ 첨부된 '오늘의 존다 요약 카드' 이미지로 전체 식단 사진을 한눈에 확인하실 수 있습니다.`
    ].join('\n');
  },

  async renderSummaryCardCanvas(canvas, { user, date, meals, missionDone, settings }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const mealCount = meals.length;
    const rows = Math.max(1, Math.ceil(Math.max(mealCount, 1) / 2));
    const cardWidth = 900;
    const photoRowHeight = 290;
    const cardHeight = 560 + rows * photoRowHeight + 110;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, cardHeight);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Top accent bar
    const topGrad = ctx.createLinearGradient(0, 0, cardWidth, 0);
    topGrad.addColorStop(0, '#f97316');
    topGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, cardWidth, 14);

    // Header Title & Badge
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 22px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.fillText('CROSSFIT LEBEN · ZONE DIET CHALLENGE', 48, 66);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 42px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.fillText(`${user.team}조 ${user.name} · 일일 식단 인증`, 48, 118);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.fillText(`📅 인증일자: ${date}   |   🎯 일일 목표: 각 ${target}블록`, 48, 158);

    // Status Stamp on Top Right
    ctx.save();
    roundRect(ctx, 640, 56, 212, 86, 18);
    ctx.fillStyle = isOver ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isOver ? '#ef4444' : '#10b981';
    ctx.stroke();
    ctx.fillStyle = isOver ? '#fca5a5' : '#6ee7b7';
    ctx.font = 'bold 22px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isOver ? '⚠️ 블록 초과' : '✅ 정량 준수', 746, 95);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 17px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.fillText(missionDone ? '주간미션 완료 🏋️' : '12시 전 식단기록', 746, 124);
    ctx.restore();

    // Macro Summary Box
    roundRect(ctx, 48, 190, cardWidth - 96, 260, 24);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.fillText('📊 오늘 섭취 탄·단·지 블록 합계', 80, 236);

    ctx.fillStyle = '#fb923c';
    ctx.font = 'bold 20px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`탄:단:지 비율  ${ratioStr}`, cardWidth - 80, 236);
    ctx.textAlign = 'left';

    const macros = [
      { label: '탄수화물 (C)', val: totals.carb, color: '#38bdf8', sub: '1블록 = 9g' },
      { label: '단백질 (P)', val: totals.protein, color: '#f97316', sub: '1블록 = 7g' },
      { label: '지방 (F)', val: totals.fat, color: '#facc15', sub: '1블록 = 1.5g' }
    ];

    macros.forEach((m, idx) => {
      const y = 278 + idx * 54;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 21px "Pretendard", "Malgun Gothic", sans-serif';
      ctx.fillText(m.label, 80, y);

      // Bar track
      const barX = 245;
      const barW = 420;
      const barH = 22;
      roundRect(ctx, barX, y - 18, barW, barH, 11);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Bar fill
      const ratio = Math.min(1.15, m.val / Math.max(target, 1));
      const fillW = Math.max(12, Math.min(barW, barW * (m.val / Math.max(target, 1))));
      roundRect(ctx, barX, y - 18, fillW, barH, 11);
      ctx.fillStyle = m.val > target ? '#ef4444' : m.color;
      ctx.fill();

      // Value text
      ctx.fillStyle = m.val > target ? '#fca5a5' : '#ffffff';
      ctx.font = 'bold 22px "Pretendard", "Malgun Gothic", sans-serif';
      ctx.fillText(
        `${formatBlockNum(m.val)} / ${target}블록${m.val > target ? ' (초과!)' : ''}`,
        barX + barW + 22,
        y
      );
    });

    // Meal Photos Section Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.fillText(`🍽️ 오늘의 식단 사진 및 끼니별 블록 (${mealCount}끼)`, 48, 505);

    const gridStartY = 530;
    const colW = (cardWidth - 96 - 24) / 2; // 390px each
    const cellH = 266;

    if (mealCount === 0) {
      roundRect(ctx, 48, gridStartY, cardWidth - 96, 220, 20);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 24px "Pretendard", "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('아직 등록된 끼니 식단이 없습니다.', cardWidth / 2, gridStartY + 115);
      ctx.textAlign = 'left';
    } else {
      const images = await Promise.all(meals.map(m => loadImage(m.photoDataUrl)));

      meals.forEach((meal, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = 48 + col * (colW + 24);
        const y = gridStartY + row * photoRowHeight;

        roundRect(ctx, x, y, colW, cellH, 20);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.stroke();

        // Draw photo inside clipped area
        ctx.save();
        roundRect(ctx, x, y, colW, 186, 20);
        ctx.clip();
        const img = images[idx];
        if (img) {
          const scale = Math.max(colW / img.width, 186 / img.height);
          const sw = img.width * scale;
          const sh = img.height * scale;
          const sx = x + (colW - sw) / 2;
          const sy = y + (186 - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, colW, 186);
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 22px "Pretendard", "Malgun Gothic", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🥗 식단 사진 없음', x + colW / 2, y + 100);
          ctx.textAlign = 'left';
        }

        // Top-left meal type badge
        roundRect(ctx, x + 14, y + 14, 112, 36, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 18px "Pretendard", "Malgun Gothic", sans-serif';
        ctx.fillText(`${meal.type} ${meal.time || ''}`, x + 26, y + 38);
        ctx.restore();

        // Bottom caption area of card
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "Pretendard", "Malgun Gothic", sans-serif';
        ctx.fillText(
          `탄 ${formatBlockNum(meal.carb)}  ·  단 ${formatBlockNum(meal.protein)}  ·  지 ${formatBlockNum(meal.fat)} 블록`,
          x + 18,
          y + 218
        );

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 17px "Pretendard", "Malgun Gothic", sans-serif';
        const memoText = meal.memo || '식단 기록 완료';
        const clippedMemo = memoText.length > 22 ? memoText.slice(0, 22) + '…' : memoText;
        ctx.fillText(clippedMemo, x + 18, y + 246);
      });
    }

    // Footer
    const footerY = cardHeight - 44;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 18px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${settings?.challengeName || '크로스핏 레벤 존다 챌린지'} · 밤 12시 전 일일 식단 & 블록 인증 카드`,
      cardWidth / 2,
      footerY
    );
    ctx.textAlign = 'left';
  }
};
