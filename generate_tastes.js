// 写真テイスト5パターン比較用に、02_ojt_teaching を5スタイルで生成
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/myuda/recruit-site-illust-proto/tastes');
const USER_DATA = path.resolve('C:/Users/myuda/chrome_pw_chatgpt2');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// 共通シーン: 02_ojt_teaching（OJT手元、顔なし）
const SCENE = 'Close-up of two hands at a CNC machine control panel: a senior worker\'s hand in a dark green uniform sleeve pointing at a control button, a junior worker\'s hand hovering beside it. Only hands, forearms and machine visible. NO FACES. Square 1:1 composition. No text, no watermark.';

const tastes = [
  {
    name: 'I_monochrome_sepia',
    label: 'I. モノクロ/セピア',
    style: 'Monochrome documentary photograph with subtle warm sepia tone. High contrast, deep shadows, matte finish. Reportage style reminiscent of Magnum photography. Grainy texture. Rich tonal range in black, gray, cream. No color saturation except a warm sepia tint.',
  },
  {
    name: 'J_pure_photo',
    label: 'J. ピュア写真',
    style: 'Pure photorealistic editorial photograph. Crisp professional photography, natural studio-quality lighting, sharp focus, high detail, magazine-grade finish. Absolutely no painterly effect, no filter, no stylization. Just a clean real photograph.',
  },
  {
    name: 'K_film_grain',
    label: 'K. フィルムカメラ風',
    style: 'Analog film photograph on Kodak Portra 400 emulation: visible fine film grain, slightly muted warm tones, gentle color fading, soft vignette at corners, warm highlights, slight milky contrast. Nostalgic, warm, 1990s-2000s Japanese documentary feel.',
  },
  {
    name: 'L_duotone_green',
    label: 'L. デュオトーン（緑×クリーム）',
    style: 'Strict duotone image using ONLY two colors: deep forest green (#1a5c38) in shadows and dark areas, and cream (#f8f1e4) in highlights and light areas. All mid-tones mapped smoothly between these two. NO other colors present. Bold, graphic, editorial. Clear branding feel.',
  },
  {
    name: 'M_cutout_minimal',
    label: 'M. 切り絵/ミニマル合成',
    style: 'Minimal graphic composition: the hands and machine are photographed with clean studio lighting and placed on a flat solid cream (#f8f1e4) background — background fully replaced with uniform cream, no environment visible. Clean silhouettes, soft drop shadow underneath, plenty of negative space. Apple-style product photography. Modern editorial.',
  },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findGeneratedImage(page) {
  const imgs = await page.$$('img');
  for (const img of imgs) {
    try {
      const info = await img.evaluate(el => {
        const r = el.getBoundingClientRect();
        return { src: el.src || '', alt: el.alt || '', nw: el.naturalWidth, nh: el.naturalHeight, rw: r.width, rh: r.height, complete: el.complete };
      });
      if (!info.complete || !info.src) continue;
      if (info.rw < 400 || info.rh < 400) continue;
      if (info.nw < 1024 || info.nh < 1024) continue;
      if (info.src.includes('p=gpp') || info.src.includes('gizmo_id=')) continue;
      if (/avatar|logo|\/icon/i.test(info.src)) continue;
      const ok = info.src.includes('p=fs') || /file_[0-9a-f]{8,}/.test(info.src) || info.alt.includes('生成された画像');
      if (!ok) continue;
      return { img, info };
    } catch (e) {}
  }
  return null;
}

(async () => {
  const context = await chromium.launchPersistentContext(USER_DATA, {
    headless: false, viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || await context.newPage();

  for (let i = 0; i < tastes.length; i++) {
    const t = tastes[i];
    const outFile = path.join(OUT_DIR, `${t.name}.png`);
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100000) {
      console.log(`[${i+1}/${tastes.length}] ${t.label} → 既存スキップ`);
      continue;
    }
    console.log(`\n[${i+1}/${tastes.length}] ${t.label}`);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#prompt-textarea', { state: 'visible', timeout: 60000 });
        await sleep(1500);

        const ta = page.locator('#prompt-textarea').first();
        await ta.focus();
        await sleep(300);
        await page.keyboard.type(t.style + ' Scene: ' + SCENE, { delay: 3 });
        await sleep(700);
        await page.keyboard.press('Enter');
        console.log(`  試行 ${attempt+1}: 送信完了、画像待機...`);

        const start = Date.now();
        let hit = null;
        while (Date.now() - start < 360000) { // 6分
          hit = await findGeneratedImage(page);
          if (hit) break;
          await sleep(3000);
        }
        if (hit) {
          await sleep(3000);
          const resp = await page.request.get(hit.info.src);
          fs.writeFileSync(outFile, await resp.body());
          console.log(`  ✓ 保存: ${t.name}.png (${(fs.statSync(outFile).size/1024).toFixed(0)}KB)`);
          break;
        } else {
          console.log(`  !! 試行 ${attempt+1} タイムアウト`);
        }
      } catch (e) {
        console.log(`  !! エラー: ${e.message.substring(0, 100)}`);
      }
    }
  }

  console.log('\n完了');
  await sleep(30000);
  await context.close();
})();
