// 11と12の単体リトライ（v4顔なし）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve('C:/Users/myuda/recruit-site-illust-proto/images');
const USER_DATA = path.resolve('C:/Users/myuda/chrome_pw_chatgpt2');

const STYLE = 'Semi-realistic illustration blending photographic realism with gentle painterly sensibility. Realistic clothing detail (dark green factory work uniforms), accurate poses. Foreground looks like a cinematic photograph, edges and backgrounds soft painterly finish. 70% photographic, 30% gently painted. STRICT RULE: NO VISIBLE HUMAN FACES. Only back views, hands, feet, or scenes without visible faces. If people appear, shot from behind or cropped so no facial features are readable. No portraits, no smiling faces, no profile of face. Warm muted palette: cream, sage green, soft peach, dusty blue, golden light. Square 1:1. No text, no letters, no watermark. Scene:';

const targets = [
  { name: '11_break_smile', subject: 'A sunny break room scene shot at table level: a pair of hands holding a green tea bottle on a wooden table, a magazine beside it, some office plants on the windowsill, warm golden window light. Only hands and forearms in uniform sleeves visible. No face at all.' },
  { name: '12_leaving_sunset', subject: 'Back view silhouettes of two Japanese factory workers in dark green uniforms walking toward a parking lot at sunset. Shot strictly from behind, warm golden sky. Only their backs and long shadows visible. No faces.' },
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
      const src = info.src;
      if (src.includes('p=gpp') || src.includes('gizmo_id=')) continue;
      if (/avatar|logo|\/icon/i.test(src)) continue;
      const ok = src.includes('p=fs') || /file_[0-9a-f]{8,}/.test(src) || info.alt.includes('生成された画像');
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

  for (const t of targets) {
    console.log(`\n[リトライ] ${t.name}`);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#prompt-textarea', { state: 'visible', timeout: 60000 });
        await sleep(1500);

        const ta = page.locator('#prompt-textarea').first();
        await ta.focus();
        await sleep(300);
        await page.keyboard.type(STYLE + ' ' + t.subject, { delay: 3 });
        await sleep(700);
        await page.keyboard.press('Enter');
        console.log(`  試行 ${attempt+1}: 送信完了、画像待機...`);

        const start = Date.now();
        let hit = null;
        while (Date.now() - start < 420000) { // 7分
          hit = await findGeneratedImage(page);
          if (hit) break;
          await sleep(3000);
        }
        if (hit) {
          await sleep(3000);
          const outFile = path.join(OUT_DIR, `${t.name}.png`);
          const resp = await page.request.get(hit.info.src);
          fs.writeFileSync(outFile, await resp.body());
          console.log(`  ✓ 保存: ${outFile} (${(fs.statSync(outFile).size/1024).toFixed(0)}KB)`);
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
  await sleep(60000);
  await context.close();
})();
