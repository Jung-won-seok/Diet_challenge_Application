// 네이버 카페 실제 이미지 붙여넣기(image/png ClipboardItem) 및 조별 4인 종합 보고 생성기

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
  getMealPhotos(meal) {
    if (!meal) return [];
    if (Array.isArray(meal.photos) && meal.photos.length > 0) {
      return meal.photos.filter(Boolean);
    }
    if (meal.photoDataUrl) {
      return [meal.photoDataUrl];
    }
    return [];
  },

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

  // 단일 이미지(JPEG/SVG/PNG DataURL)를 네이버 카페 Ctrl+V 붙여넣기가 가능한 image/png Blob으로 변환
  async dataUrlToPngBlob(src) {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = img ? img.width || 600 : 600;
    canvas.height = img ? img.height || 450 : 450;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  },

  // Canvas를 image/png Blob으로 변환
  canvasToPngBlob(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  },

  // 네이버 카페 게시글 제목
  buildCafeTitle({ user, date, meals }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const shortDate = date.slice(5).replace('-', '/');
    return `[존다챌린지/${user.team}조/${user.name}] ${shortDate} 식단 인증 (탄${formatBlockNum(
      totals.carb
    )}·단${formatBlockNum(totals.protein)}·지${formatBlockNum(totals.fat)} / 목표 ${target}블록)`;
  },

  // 사진 밑에 붙여넣을 탄단지 블록 요약 텍스트
  buildCafeBottomBlockText({ user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const mealLines =
      sortedMeals.length > 0
        ? sortedMeals
            .map(
              m =>
                `• ${m.type} : 탄 ${formatBlockNum(m.carb)} / 단 ${formatBlockNum(m.protein)} / 지 ${formatBlockNum(
                  m.fat
                )} 블록${m.memo ? ` (${m.memo})` : ''}`
            )
            .join('\n')
        : '• 기록된 식단 없음';

    return [
      `[${user.team}조 ${user.name} · ${date} 식단 및 탄단지 블록 보고]`,
      ``,
      `■ 끼니별 섭취 내역`,
      mealLines,
      ``,
      `■ 오늘 하루 총 섭취 탄·단·지 블록 수`,
      `• 탄수화물 : ${formatBlockNum(totals.carb)} 블록 (목표 ${target}블록)`,
      `• 단백질   : ${formatBlockNum(totals.protein)} 블록 (목표 ${target}블록)`,
      `• 지방     : ${formatBlockNum(totals.fat)} 블록 (목표 ${target}블록)`,
      `• 탄:단:지 비율 : ${ratioStr} (${isOver ? '목표 블록 초과' : '목표 블록 내 완료'})`,
      `• 주간 미션 운동 : ${missionDone ? '이번 주 미션 완료' : '진행 중'}`
    ].join('\n');
  },

  // 식단 담당이 전체 20명 방에 올리는 조별 4명 취합 텍스트
  buildTeamReportText({ teamNum, date, membersData }) {
    const shortDate = date.slice(5).replace('-', '.');
    const lines = membersData.map(md => {
      const { member, meals } = md;
      const totals = this.computeTotals(meals);
      const photoCount = meals.reduce((acc, m) => acc + this.getMealPhotos(m).length, 0);
      const isOver =
        totals.carb > member.targetBlocks ||
        totals.protein > member.targetBlocks ||
        totals.fat > member.targetBlocks;
      if (meals.length === 0) {
        return `• ${member.name} (목표 ${member.targetBlocks}B) : 미등록`;
      }
      return `• ${member.name} (목표 ${member.targetBlocks}B) : 탄 ${formatBlockNum(
        totals.carb
      )} · 단 ${formatBlockNum(totals.protein)} · 지 ${formatBlockNum(totals.fat)} 블록 [사진 ${photoCount}장 / ${
        isOver ? '초과' : '완료'
      }]`;
    });

    const doneCount = membersData.filter(m => m.meals.length > 0).length;

    return [
      `[${teamNum}조 일일 식단 종합 보고] ${shortDate}`,
      `보고 인원 : ${doneCount} / ${membersData.length}명 완료`,
      `──────────────────────`,
      ...lines
    ].join('\n');
  },

  // [아침·점심·저녁 사진만 모은 화이트 콜라주 캔버스] -> 사진만 Ctrl+V로 붙여넣고 밑에 텍스트를 따로 칠 때 사용
  async renderPhotosOnlyCanvas(canvas, { user, date, meals }) {
    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    const photoItems = [];
    sortedMeals.forEach(m => {
      const photos = this.getMealPhotos(m);
      photos.forEach((src, i) => {
        photoItems.push({ meal: m, src, subIdx: i + 1, totalInMeal: photos.length });
      });
    });

    const itemCount = photoItems.length;
    const cols = itemCount === 1 ? 1 : 2;
    const rows = Math.max(1, Math.ceil(Math.max(itemCount, 1) / cols));
    const cardWidth = 920;
    const pad = 28;
    const gap = 20;
    const colW = cols === 1 ? cardWidth - pad * 2 : (cardWidth - pad * 2 - gap) / 2;
    const imgH = cols === 1 ? 420 : 310;
    const cellH = imgH + 54;
    const cardHeight = pad * 2 + rows * cellH + (rows - 1) * gap;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    if (itemCount === 0) {
      roundRect(ctx, pad, pad, cardWidth - pad * 2, cardHeight - pad * 2, 16);
      ctx.fillStyle = '#F4F5F7';
      ctx.fill();
      ctx.fillStyle = '#6B7280';
      ctx.font = '700 22px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('등록된 아침·점심·저녁 식단 사진이 없습니다.', cardWidth / 2, cardHeight / 2);
      ctx.textAlign = 'left';
      return;
    }

    const images = await Promise.all(photoItems.map(item => loadImage(item.src)));

    photoItems.forEach((item, idx) => {
      const { meal, subIdx, totalInMeal } = item;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = pad + col * (colW + gap);
      const y = pad + row * (cellH + gap);

      roundRect(ctx, x, y, colW, cellH, 16);
      ctx.fillStyle = '#F8F9FA';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#E5E7EB';
      ctx.stroke();

      ctx.save();
      roundRect(ctx, x, y, colW, imgH, 16);
      ctx.clip();
      const img = images[idx];
      if (img) {
        const scale = Math.max(colW / img.width, imgH / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, x + (colW - sw) / 2, y + (imgH - sh) / 2, sw, sh);
      }
      ctx.restore();

      const label = totalInMeal > 1 ? `[${meal.type} ${subIdx}]` : `[${meal.type}]`;
      ctx.fillStyle = '#111315';
      ctx.font = '800 18px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(
        `${label} 탄 ${formatBlockNum(meal.carb)} · 단 ${formatBlockNum(meal.protein)} · 지 ${formatBlockNum(meal.fat)}블록  ${
          meal.memo ? `(${meal.memo.slice(0, 16)})` : ''
        }`,
        x + 16,
        y + imgH + 34
      );
    });
  },

  // [네이버 카페 본문 일체형 화이트 카드] -> 위에는 아침·점심·저녁 사진, 아래에는 탄단지 블록 수 텍스트가 흰 배경에 깔끔히 그려져
  // 네이버 카페 글쓰기에서 Ctrl+V 한 번만 누르면 사진+글이 통째로 본문에 삽입됨!
  async renderSummaryCardCanvas(canvas, { user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    const photoItems = [];
    sortedMeals.forEach(m => {
      const photos = this.getMealPhotos(m);
      if (photos.length === 0) {
        photoItems.push({ meal: m, src: null, subIdx: 1, totalInMeal: 1 });
      } else {
        photos.forEach((src, i) => {
          photoItems.push({ meal: m, src, subIdx: i + 1, totalInMeal: photos.length });
        });
      }
    });

    const itemCount = photoItems.length;
    const rows = Math.max(1, Math.ceil(Math.max(itemCount, 1) / 2));
    const cardWidth = 920;
    const photoRowHeight = 320;
    const cardHeight = 140 + rows * photoRowHeight + 290;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    // 네이버 카페 본문과 자연스럽게 어우러지는 화이트 에디토리얼 배경
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // 상단 타이틀 영역
    ctx.fillStyle = '#111315';
    ctx.font = '800 32px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`[${user.team}조 ${user.name}] ${date} 일일 식단 및 블록 인증`, 40, 62);

    ctx.fillStyle = '#6B7280';
    ctx.font = '600 18px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`일일 목표 : 탄 ${target} · 단 ${target} · 지 ${target} 블록  |  등록된 식단 사진 ${itemCount}장`, 40, 98);

    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(40, 118, cardWidth - 80, 2);

    // 1. 위쪽: 아침, 점심, 저녁 식단 사진 그리드
    const gridStartY = 140;
    const colW = (cardWidth - 80 - 20) / 2;
    const cellH = 296;

    if (itemCount === 0) {
      roundRect(ctx, 40, gridStartY, cardWidth - 80, 240, 16);
      ctx.fillStyle = '#F4F5F7';
      ctx.fill();
      ctx.fillStyle = '#6B7280';
      ctx.font = '600 22px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('등록된 아침·점심·저녁 식단 사진이 없습니다.', cardWidth / 2, gridStartY + 125);
      ctx.textAlign = 'left';
    } else {
      const images = await Promise.all(photoItems.map(item => loadImage(item.src)));

      photoItems.forEach((item, idx) => {
        const { meal, subIdx, totalInMeal } = item;
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = 40 + col * (colW + 20);
        const y = gridStartY + row * photoRowHeight;

        roundRect(ctx, x, y, colW, cellH, 16);
        ctx.fillStyle = '#F8F9FA';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#E5E7EB';
        ctx.stroke();

        ctx.save();
        roundRect(ctx, x, y, colW, 212, 16);
        ctx.clip();
        const img = images[idx];
        if (img) {
          const scale = Math.max(colW / img.width, 212 / img.height);
          const sw = img.width * scale;
          const sh = img.height * scale;
          ctx.drawImage(img, x + (colW - sw) / 2, y + (212 - sh) / 2, sw, sh);
        } else {
          ctx.fillStyle = '#E5E7EB';
          ctx.fillRect(x, y, colW, 212);
        }

        const pillLabel = totalInMeal > 1 ? `${meal.type} 사진 ${subIdx}` : `${meal.type} 식단`;
        roundRect(ctx, x + 14, y + 14, 110, 30, 15);
        ctx.fillStyle = 'rgba(17, 19, 21, 0.82)';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 14.5px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(pillLabel, x + 28, y + 34);
        ctx.restore();

        ctx.fillStyle = '#111315';
        ctx.font = '800 18.5px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(
          `[${meal.type}] 탄 ${formatBlockNum(meal.carb)} · 단 ${formatBlockNum(meal.protein)} · 지 ${formatBlockNum(meal.fat)} 블록`,
          x + 18,
          y + 246
        );

        ctx.fillStyle = '#4B5563';
        ctx.font = '500 15.5px "Pretendard", -apple-system, sans-serif';
        const memoText = meal.memo || `${meal.type} 식단 기록`;
        const clippedMemo = memoText.length > 25 ? memoText.slice(0, 25) + '…' : memoText;
        ctx.fillText(clippedMemo, x + 18, y + 274);
      });
    }

    // 2. 아래쪽: 오늘 하루 먹은 총 탄·단·지 블록 수 (사진 바로 아래에 배치)
    const bottomY = gridStartY + rows * photoRowHeight + 10;
    roundRect(ctx, 40, bottomY, cardWidth - 80, 240, 20);
    ctx.fillStyle = '#111315';
    ctx.fill();

    ctx.fillStyle = '#C8F904';
    ctx.font = '800 18px "Pretendard", -apple-system, sans-serif';
    ctx.fillText('■ 오늘 하루 총 섭취 탄·단·지 블록 수', 68, bottomY + 42);

    ctx.fillStyle = isOver ? '#FF6B57' : '#FFFFFF';
    ctx.font = '700 16px "Pretendard", -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `탄:단:지 비율 ${ratioStr}  |  ${isOver ? '목표 블록 초과' : '목표 블록 준수 완료'}`,
      cardWidth - 68,
      bottomY + 42
    );
    ctx.textAlign = 'left';

    const macroBoxes = [
      { label: '탄수화물 (CARB)', val: totals.carb, color: '#38BDF8' },
      { label: '단백질 (PROTEIN)', val: totals.protein, color: '#C8F904' },
      { label: '지방 (FAT)', val: totals.fat, color: '#FBBF24' }
    ];

    const boxW = (cardWidth - 136 - 32) / 3;
    macroBoxes.forEach((mb, i) => {
      const bx = 68 + i * (boxW + 16);
      const by = bottomY + 64;
      roundRect(ctx, bx, by, boxW, 118, 14);
      ctx.fillStyle = '#1C1F24';
      ctx.fill();

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '700 14px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(mb.label, bx + 18, by + 32);

      const overThis = mb.val > target;
      ctx.fillStyle = overThis ? '#FF6B57' : '#FFFFFF';
      ctx.font = '800 32px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`${formatBlockNum(mb.val)}블록`, bx + 18, by + 76);

      ctx.fillStyle = '#6B7280';
      ctx.font = '600 14px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`목표 ${target}블록`, bx + 18, by + 102);
    });

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 15px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(
      `주간 미션 운동 : ${missionDone ? '이번 주 미션 완료' : '진행 중'}   |   CROSSFIT LEBEN ZONE CHALLENGE`,
      68,
      bottomY + 214
    );
  },

  // 식단 담당이 전체 20명 공간/단톡방에 올리는 조원 4명 종합 이미지 보드
  async renderTeamReportCanvas(canvas, { teamNum, date, membersData }) {
    const cardWidth = 960;
    const memberRowH = 220;
    const cardHeight = 160 + membersData.length * memberRowH + 60;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111315';
    ctx.fillRect(0, 0, cardWidth, cardHeight);
    ctx.fillStyle = '#C8F904';
    ctx.fillRect(0, 0, cardWidth, 8);

    ctx.fillStyle = '#8B929E';
    ctx.font = '700 15px "Pretendard", -apple-system, sans-serif';
    ctx.fillText('CROSSFIT LEBEN  ·  TEAM DAILY REPORT (ALL-MEMBER BOARD)', 48, 54);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 38px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`${teamNum}조 일일 식단 & 블록 취합 보고 (${date.replace(/-/g, '.')})`, 48, 104);

    for (let i = 0; i < membersData.length; i++) {
      const { member, meals } = membersData[i];
      const totals = this.computeTotals(meals);
      const isOver =
        totals.carb > member.targetBlocks ||
        totals.protein > member.targetBlocks ||
        totals.fat > member.targetBlocks;

      const y = 140 + i * memberRowH;
      roundRect(ctx, 48, y, cardWidth - 96, memberRowH - 18, 18);
      ctx.fillStyle = '#1A1D21';
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`${member.name}`, 74, y + 44);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '600 16px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`목표 ${member.targetBlocks}블록`, 164, y + 43);

      ctx.fillStyle = isOver ? '#FF6B57' : '#C8F904';
      ctx.font = '800 22px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        meals.length > 0
          ? `총 섭취 : 탄 ${formatBlockNum(totals.carb)} · 단 ${formatBlockNum(totals.protein)} · 지 ${formatBlockNum(totals.fat)} 블록`
          : '오늘 식단 미등록',
        cardWidth - 74,
        y + 44
      );
      ctx.textAlign = 'left';

      const allPhotos = [];
      meals.forEach(m => {
        this.getMealPhotos(m).forEach(src => allPhotos.push({ type: m.type, src }));
      });

      if (allPhotos.length === 0) {
        ctx.fillStyle = '#6B7280';
        ctx.font = '600 17px "Pretendard", -apple-system, sans-serif';
        ctx.fillText('등록된 식단 사진이 없습니다.', 74, y + 125);
      } else {
        const displayPhotos = allPhotos.slice(0, 4);
        const loadedImgs = await Promise.all(displayPhotos.map(p => loadImage(p.src)));
        const thumbW = 186;
        const thumbH = 118;
        displayPhotos.forEach((p, pIdx) => {
          const tx = 74 + pIdx * (thumbW + 14);
          const ty = y + 64;
          ctx.save();
          roundRect(ctx, tx, ty, thumbW, thumbH, 12);
          ctx.clip();
          const img = loadedImgs[pIdx];
          if (img) {
            const scale = Math.max(thumbW / img.width, thumbH / img.height);
            const sw = img.width * scale;
            const sh = img.height * scale;
            ctx.drawImage(img, tx + (thumbW - sw) / 2, ty + (thumbH - sh) / 2, sw, sh);
          } else {
            ctx.fillStyle = '#272B31';
            ctx.fillRect(tx, ty, thumbW, thumbH);
          }
          roundRect(ctx, tx + 8, ty + 8, 56, 24, 8);
          ctx.fillStyle = 'rgba(17,19,21,0.82)';
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '700 13px "Pretendard", -apple-system, sans-serif';
          ctx.fillText(p.type, tx + 18, ty + 25);
          ctx.restore();
        });
      }
    }
  }
};
