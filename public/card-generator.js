// 네이버 카페 실제 이미지 붙여넣기(image/png ClipboardItem) 및 끼니별(아침·점심·저녁) 구분 카드/포맷 생성기

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
    // iOS Safari WebKit에서 data: URL에 crossOrigin='anonymous' 설정 시 로드 지연/보안 예외 방지
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function formatBlockNum(n) {
  const num = Number(n || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
}

const MEAL_META = {
  아침: { icon: '☀️', badgeBg: '#0EA5E9', label: '아침 식단' },
  점심: { icon: '🌤️', badgeBg: '#10B981', label: '점심 식단' },
  저녁: { icon: '🌙', badgeBg: '#6366F1', label: '저녁 식단' },
  간식: { icon: '🍎', badgeBg: '#F59E0B', label: '간식 식단' }
};

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

  // 임의의 이미지(SVG/JPEG/PNG DataURL)를 네이버 카페 업로드용 경량 image/jpeg 또는 image/png base64 DataURL로 변환
  async dataUrlToPngDataUrl(src) {
    if (!src) return null;
    if (src.startsWith('data:image/jpeg;base64,') || src.startsWith('data:image/png;base64,')) {
      return src;
    }
    try {
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
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch (_) {
      return null;
    }
  },

  // 끼니별(아침 -> 점심 -> 저녁 -> 간식)로 사진과 바로 밑 끼니별 블럭 텍스트를 구조화하여 반환
  async buildCafeMealSections({ user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const sections = [];
    for (const m of sortedMeals) {
      const meta = MEAL_META[m.type] || { icon: '🍽️', label: `${m.type} 식단` };
      const rawPhotos = this.getMealPhotos(m);
      const convertedPhotos = [];
      for (const src of rawPhotos) {
        const dataUrl = await this.dataUrlToPngDataUrl(src);
        if (dataUrl) convertedPhotos.push(dataUrl);
      }
      const blockLines = [
        `▶ ${m.type} 블럭 : 탄 ${formatBlockNum(m.carb)}블럭 · 단 ${formatBlockNum(m.protein)}블럭 · 지 ${formatBlockNum(m.fat)}블럭`
      ];
      if (m.memo) {
        blockLines.push(`▶ ${m.type} 메뉴 : ${m.memo}`);
      }
      sections.push({
        type: m.type,
        headerText: `${meta.icon} [${meta.label}]`,
        blockText: blockLines.join('\n'),
        carb: Number(m.carb || 0),
        protein: Number(m.protein || 0),
        fat: Number(m.fat || 0),
        memo: m.memo || '',
        images: convertedPhotos
      });
    }

    const footerSummaryText = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 [오늘 하루 총 섭취 탄·단·지 블럭 합계]`,
      `• 탄수화물 : 총 ${formatBlockNum(totals.carb)}블럭 (일일 목표 ${target}블럭)`,
      `• 단백질   : 총 ${formatBlockNum(totals.protein)}블럭 (일일 목표 ${target}블럭)`,
      `• 지방     : 총 ${formatBlockNum(totals.fat)}블럭 (일일 목표 ${target}블럭)`,
      `• 탄:단:지 비율 : ${ratioStr} (${isOver ? '목표 블럭 초과' : '목표 블럭 내 완료'})`,
      `• 주간 미션 운동 : ${missionDone ? '이번 주 미션 완료' : '진행 중'}`
    ].join('\n');

    return { sections, footerSummaryText };
  },

  // 네이버 카페 글쓰기 API(content 파라미터)에 들어갈 끼니별(아침·점심·저녁) 구분 HTML 본문 생성
  buildCafeArticleHtml({ user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const mealSectionsHtml =
      sortedMeals.length > 0
        ? sortedMeals
            .map(m => {
              const meta = MEAL_META[m.type] || { icon: '🍽️', label: `${m.type} 식단`, badgeBg: '#0EA5E9' };
              return `
                <div style="margin-bottom:18px;padding:14px 16px;border:1px solid #E2E8F0;border-radius:14px;background:#F8FAFC;">
                  <div style="font-size:16px;font-weight:800;color:#0F172A;margin-bottom:6px;">
                    ${meta.icon} [${meta.label}]
                  </div>
                  <div style="font-size:14.5px;font-weight:800;color:#0369A1;margin-bottom:4px;">
                    ▶ ${m.type} 블럭 : 탄 ${formatBlockNum(m.carb)}블럭 · 단 ${formatBlockNum(m.protein)}블럭 · 지 ${formatBlockNum(m.fat)}블럭
                  </div>
                  ${
                    m.memo
                      ? `<div style="font-size:13.5px;color:#475569;">▶ ${m.type} 메뉴 : ${m.memo}</div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')
        : `<p style="color:#64748B;">등록된 끼니 내역 없음</p>`;

    return [
      `<div style="font-family:'Pretendard',-apple-system,sans-serif;line-height:1.65;color:#0F172A;">`,
      `<h3 style="margin:0 0 8px 0;">[${user.team}조 ${user.name}] ${date} 일일 식단 및 끼니별 블럭 인증</h3>`,
      `<p style="margin:0 0 16px 0;color:#475569;">소속 : <b>${user.team}조 (${user.name})</b> &nbsp;|&nbsp; 일일 목표 : <b>각 ${target}블럭</b></p>`,
      mealSectionsHtml,
      `<div style="margin-top:20px;padding:16px;border-radius:14px;background:#0F172A;color:#FFFFFF;">`,
      `<h4 style="margin:0 0 8px 0;color:#C8F904;">📊 오늘 하루 총 섭취 탄·단·지 블럭 합계</h4>`,
      `<p style="margin:4px 0;">• <b>탄수화물 (C)</b> : 총 ${formatBlockNum(totals.carb)}블럭 (목표 ${target}블럭)</p>`,
      `<p style="margin:4px 0;">• <b>단백질 (P)</b> : 총 ${formatBlockNum(totals.protein)}블럭 (목표 ${target}블럭)</p>`,
      `<p style="margin:4px 0;">• <b>지방 (F)</b> : 총 ${formatBlockNum(totals.fat)}블럭 (목표 ${target}블럭)</p>`,
      `<p style="margin:4px 0;">• <b>탄 : 단 : 지 비율</b> : ${ratioStr} (<b>${isOver ? '목표 블럭 초과' : '목표 블럭 내 완료'}</b>)</p>`,
      `<p style="margin:4px 0;">• <b>주간 미션 운동</b> : ${missionDone ? '이번 주 미션 완료' : '진행 중'}</p>`,
      `</div>`,
      `</div>`
    ].join('');
  },

  // 네이버 카페 게시글 제목
  buildCafeTitle({ user, date, meals }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const shortDate = date.slice(5).replace('-', '/');
    return `[존다챌린지/${user.team}조/${user.name}] ${shortDate} 식단 인증 (탄${formatBlockNum(
      totals.carb
    )}·단${formatBlockNum(totals.protein)}·지${formatBlockNum(totals.fat)} / 목표 ${target}블럭)`;
  },

  // 아침·점심·저녁을 명확히 구별하고 각 끼니 밑에 끼니별 블럭을 표시하는 텍스트 포맷
  buildCafeBottomBlockText({ user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const mealSectionsText =
      sortedMeals.length > 0
        ? sortedMeals
            .map(m => {
              const meta = MEAL_META[m.type] || { icon: '🍽️', label: `${m.type} 식단` };
              const lines = [
                `${meta.icon} [${meta.label}]`,
                `▶ ${m.type} 블럭 : 탄 ${formatBlockNum(m.carb)}블럭 · 단 ${formatBlockNum(m.protein)}블럭 · 지 ${formatBlockNum(m.fat)}블럭`
              ];
              if (m.memo) {
                lines.push(`▶ ${m.type} 메뉴 : ${m.memo}`);
              }
              return lines.join('\n');
            })
            .join('\n\n')
        : '• 등록된 아침·점심·저녁 식단이 없습니다.';

    return [
      `[${user.team}조 ${user.name} · ${date} 끼니별 식단 및 탄단지 블럭 인증]`,
      `━━━━━━━━━━━━━━━━━━━━`,
      mealSectionsText,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 [오늘 하루 총 섭취 탄·단·지 블럭 합계]`,
      `• 탄수화물 : 총 ${formatBlockNum(totals.carb)}블럭 (목표 ${target}블럭)`,
      `• 단백질   : 총 ${formatBlockNum(totals.protein)}블럭 (목표 ${target}블럭)`,
      `• 지방     : 총 ${formatBlockNum(totals.fat)}블럭 (목표 ${target}블럭)`,
      `• 탄:단:지 비율 : ${ratioStr} (${isOver ? '목표 블럭 초과' : '목표 블럭 내 완료'})`,
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
      )} · 단 ${formatBlockNum(totals.protein)} · 지 ${formatBlockNum(totals.fat)} 블럭 [사진 ${photoCount}장 / ${
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

  // [아침·점심·저녁 끼니별 구별 사진 + 각 사진 밑 끼니별 블럭 표시 캔버스]
  async renderPhotosOnlyCanvas(canvas, { user, date, meals }) {
    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const cardWidth = 920;
    const pad = 32;
    const sectionGap = 24;

    if (sortedMeals.length === 0) {
      canvas.width = cardWidth;
      canvas.height = 260;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cardWidth, 260);
      roundRect(ctx, pad, pad, cardWidth - pad * 2, 196, 18);
      ctx.fillStyle = '#F4F5F7';
      ctx.fill();
      ctx.fillStyle = '#6B7280';
      ctx.font = '700 22px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('등록된 아침·점심·저녁 식단 사진이 없습니다.', cardWidth / 2, 136);
      ctx.textAlign = 'left';
      return;
    }

    // 각 끼니(아침/점심/저녁) 섹션 높이 계산: 헤더(52) + 사진영역(320) + 하단 끼니별 블럭바(84) = 456
    const sectionH = 456;
    const cardHeight = pad * 2 + sortedMeals.length * sectionH + (sortedMeals.length - 1) * sectionGap;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    for (let sIdx = 0; sIdx < sortedMeals.length; sIdx++) {
      const meal = sortedMeals[sIdx];
      const meta = MEAL_META[meal.type] || { icon: '🍽️', badgeBg: '#0EA5E9', label: `${meal.type} 식단` };
      const photos = this.getMealPhotos(meal);
      const loadedImgs = await Promise.all(photos.slice(0, 3).map(src => loadImage(src)));

      const sy = pad + sIdx * (sectionH + sectionGap);
      const innerW = cardWidth - pad * 2;

      // 끼니 섹션 카드 배경
      roundRect(ctx, pad, sy, innerW, sectionH, 22);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();

      // 1) 상단 끼니 구분 배지 (아침 / 점심 / 저녁)
      roundRect(ctx, pad + 18, sy + 14, 138, 34, 17);
      ctx.fillStyle = meta.badgeBg;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 16px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`${meta.icon} ${meta.label}`, pad + 34, sy + 37);

      if (meal.time) {
        ctx.fillStyle = '#64748B';
        ctx.font = '600 15px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(`기록 시간 ${meal.time}`, pad + 170, sy + 37);
      }

      // 2) 끼니 사진 영역 (1장~3장 자동 분할)
      const imgAreaY = sy + 60;
      const imgAreaH = 296;
      const count = Math.max(1, loadedImgs.length);
      const gap = 12;
      const eachW = (innerW - 36 - (count - 1) * gap) / count;

      for (let i = 0; i < count; i++) {
        const ix = pad + 18 + i * (eachW + gap);
        ctx.save();
        roundRect(ctx, ix, imgAreaY, eachW, imgAreaH, 16);
        ctx.clip();
        const img = loadedImgs[i];
        if (img) {
          const scale = Math.max(eachW / img.width, imgAreaH / img.height);
          const sw = img.width * scale;
          const sh = img.height * scale;
          ctx.drawImage(img, ix + (eachW - sw) / 2, imgAreaY + (imgAreaH - sh) / 2, sw, sh);
        } else {
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(ix, imgAreaY, eachW, imgAreaH);
        }
        ctx.restore();
      }

      // 3) 사진 바로 밑: 끼니별 탄·단·지 블럭 표시 바
      const blockBarY = imgAreaY + imgAreaH + 12;
      roundRect(ctx, pad + 18, blockBarY, innerW - 36, 74, 14);
      ctx.fillStyle = '#0F172A';
      ctx.fill();

      ctx.fillStyle = '#C8F904';
      ctx.font = '800 19px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(
        `▶ ${meal.type} 블럭 : 탄 ${formatBlockNum(meal.carb)}블럭  ·  단 ${formatBlockNum(meal.protein)}블럭  ·  지 ${formatBlockNum(meal.fat)}블럭`,
        pad + 36,
        blockBarY + 32
      );

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '600 15px "Pretendard", -apple-system, sans-serif';
      const memoStr = meal.memo ? `식단 내용 : ${meal.memo}` : `${meal.type} 식단 블럭 기록 완료`;
      ctx.fillText(memoStr.length > 46 ? memoStr.slice(0, 46) + '…' : memoStr, pad + 36, blockBarY + 58);
    }
  },

  // [네이버 카페 본문 일체형 화이트 카드] -> 아침 / 점심 / 저녁 섹션별로 사진과 바로 밑 끼니별 블럭을 구분 표시하고 맨 아래에 하루 총합 표시
  async renderSummaryCardCanvas(canvas, { user, date, meals, missionDone }) {
    const totals = this.computeTotals(meals);
    const target = Number(user.targetBlocks || 11);
    const isOver = totals.carb > target || totals.protein > target || totals.fat > target;
    const ratioStr = this.computeRatioText(totals);

    const order = ['아침', '점심', '저녁', '간식'];
    const sortedMeals = [...meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    const cardWidth = 920;
    const pad = 36;
    const innerW = cardWidth - pad * 2;
    const sectionH = 448;
    const sectionGap = 20;
    const headerH = 132;
    const footerH = 256;

    const mealBodyH =
      sortedMeals.length === 0
        ? 220
        : sortedMeals.length * sectionH + (sortedMeals.length - 1) * sectionGap;

    const cardHeight = headerH + mealBodyH + footerH + 40;

    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // 상단 타이틀 영역
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 31px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(`[${user.team}조 ${user.name}] ${date} 아침·점심·저녁 식단 & 블럭 인증`, pad, 58);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 18px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(
      `일일 목표 : 탄 ${target} · 단 ${target} · 지 ${target} 블럭   |   등록된 끼니 : ${sortedMeals.map(m => m.type).join(' · ') || '없음'}`,
      pad,
      94
    );

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(pad, 114, innerW, 2);

    const startY = headerH;

    if (sortedMeals.length === 0) {
      roundRect(ctx, pad, startY, innerW, 196, 18);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.font = '600 21px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('등록된 아침·점심·저녁 식단이 없습니다.', cardWidth / 2, startY + 106);
      ctx.textAlign = 'left';
    } else {
      for (let sIdx = 0; sIdx < sortedMeals.length; sIdx++) {
        const meal = sortedMeals[sIdx];
        const meta = MEAL_META[meal.type] || { icon: '🍽️', badgeBg: '#0EA5E9', label: `${meal.type} 식단` };
        const photos = this.getMealPhotos(meal);
        const loadedImgs = await Promise.all(photos.slice(0, 3).map(src => loadImage(src)));

        const sy = startY + sIdx * (sectionH + sectionGap);

        // 끼니 섹션 박스
        roundRect(ctx, pad, sy, innerW, sectionH, 22);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#E2E8F0';
        ctx.stroke();

        // 1) 끼니 구분 헤더 배지 (☀️ 아침 식단 / 🌤️ 점심 식단 / 🌙 저녁 식단)
        roundRect(ctx, pad + 18, sy + 14, 142, 34, 17);
        ctx.fillStyle = meta.badgeBg;
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 16px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(`${meta.icon} ${meta.label}`, pad + 32, sy + 37);

        ctx.fillStyle = '#0F172A';
        ctx.font = '800 17px "Pretendard", -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          `${meal.type} 섭취량 : 탄 ${formatBlockNum(meal.carb)}B · 단 ${formatBlockNum(meal.protein)}B · 지 ${formatBlockNum(meal.fat)}B`,
          pad + innerW - 20,
          sy + 37
        );
        ctx.textAlign = 'left';

        // 2) 끼니 사진 영역
        const imgAreaY = sy + 58;
        const imgAreaH = 290;
        const count = Math.max(1, loadedImgs.length);
        const gap = 12;
        const eachW = (innerW - 36 - (count - 1) * gap) / count;

        for (let i = 0; i < count; i++) {
          const ix = pad + 18 + i * (eachW + gap);
          ctx.save();
          roundRect(ctx, ix, imgAreaY, eachW, imgAreaH, 16);
          ctx.clip();
          const img = loadedImgs[i];
          if (img) {
            const scale = Math.max(eachW / img.width, imgAreaH / img.height);
            const sw = img.width * scale;
            const sh = img.height * scale;
            ctx.drawImage(img, ix + (eachW - sw) / 2, imgAreaY + (imgAreaH - sh) / 2, sw, sh);
          } else {
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(ix, imgAreaY, eachW, imgAreaH);
          }
          ctx.restore();
        }

        // 3) 사진 바로 밑: 끼니별 탄·단·지 블럭 표시 바
        const blockBarY = imgAreaY + imgAreaH + 12;
        roundRect(ctx, pad + 18, blockBarY, innerW - 36, 74, 14);
        ctx.fillStyle = '#0F172A';
        ctx.fill();

        ctx.fillStyle = '#C8F904';
        ctx.font = '800 18.5px "Pretendard", -apple-system, sans-serif';
        ctx.fillText(
          `▶ [${meal.type} 블럭]  탄수화물 ${formatBlockNum(meal.carb)}블럭  ·  단백질 ${formatBlockNum(meal.protein)}블럭  ·  지방 ${formatBlockNum(meal.fat)}블럭`,
          pad + 34,
          blockBarY + 31
        );

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '600 15px "Pretendard", -apple-system, sans-serif';
        const memoStr = meal.memo ? `식단 메모 : ${meal.memo}` : `${meal.type} 식단 및 블럭 인증 완료`;
        ctx.fillText(memoStr.length > 48 ? memoStr.slice(0, 48) + '…' : memoStr, pad + 34, blockBarY + 57);
      }
    }

    // 하단: 오늘 하루 총 섭취 탄·단·지 블럭 합계
    const bottomY = startY + mealBodyH + 20;
    roundRect(ctx, pad, bottomY, innerW, 236, 22);
    ctx.fillStyle = '#0F172A';
    ctx.fill();

    ctx.fillStyle = '#C8F904';
    ctx.font = '800 18px "Pretendard", -apple-system, sans-serif';
    ctx.fillText('📊 오늘 하루 총 섭취 탄·단·지 블럭 합계 (아침+점심+저녁)', pad + 28, bottomY + 40);

    ctx.fillStyle = isOver ? '#FF6B57' : '#FFFFFF';
    ctx.font = '700 15.5px "Pretendard", -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `탄:단:지 비율 ${ratioStr}  |  ${isOver ? '목표 블럭 초과' : '목표 블럭 준수 완료'}`,
      pad + innerW - 28,
      bottomY + 40
    );
    ctx.textAlign = 'left';

    const macroBoxes = [
      { label: '총 탄수화물 (CARB)', val: totals.carb, color: '#38BDF8' },
      { label: '총 단백질 (PROTEIN)', val: totals.protein, color: '#C8F904' },
      { label: '총 지방 (FAT)', val: totals.fat, color: '#FBBF24' }
    ];

    const boxW = (innerW - 56 - 32) / 3;
    macroBoxes.forEach((mb, i) => {
      const bx = pad + 28 + i * (boxW + 16);
      const by = bottomY + 62;
      roundRect(ctx, bx, by, boxW, 114, 14);
      ctx.fillStyle = '#1E293B';
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 13.5px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(mb.label, bx + 18, by + 30);

      const overThis = mb.val > target;
      ctx.fillStyle = overThis ? '#FF6B57' : '#FFFFFF';
      ctx.font = '800 30px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`${formatBlockNum(mb.val)}블럭`, bx + 18, by + 74);

      ctx.fillStyle = '#64748B';
      ctx.font = '600 13.5px "Pretendard", -apple-system, sans-serif';
      ctx.fillText(`일일 목표 ${target}블럭`, bx + 18, by + 98);
    });

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 14.5px "Pretendard", -apple-system, sans-serif';
    ctx.fillText(
      `주간 미션 운동 : ${missionDone ? '이번 주 미션 완료' : '진행 중'}   |   CROSSFIT LEBEN ZONE CHALLENGE`,
      pad + 28,
      bottomY + 208
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
    ctx.fillText(`${teamNum}조 일일 식단 & 블럭 취합 보고 (${date.replace(/-/g, '.')})`, 48, 104);

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
      ctx.fillText(`목표 ${member.targetBlocks}블럭`, 164, y + 43);

      ctx.fillStyle = isOver ? '#FF6B57' : '#C8F904';
      ctx.font = '800 22px "Pretendard", -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        meals.length > 0
          ? `총 섭취 : 탄 ${formatBlockNum(totals.carb)} · 단 ${formatBlockNum(totals.protein)} · 지 ${formatBlockNum(totals.fat)} 블럭`
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
