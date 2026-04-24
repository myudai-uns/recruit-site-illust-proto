const { chromium } = require('playwright');
const path = require('path');

const INPUT = 'file:///C:/Users/myuda/recruit-site-illust-proto/proposal_slides_v3.html';
const OUTPUT = 'C:/Users/myuda/Downloads/260425_ファーストビュー案_Unsee.pdf';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  await page.goto(INPUT, { waitUntil: 'networkidle', timeout: 60000 });

  // 画像の読み込み完了を待つ
  await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.every(i => i.complete && i.naturalWidth > 0);
  }, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // 印刷メディアに切り替え
  await page.emulateMedia({ media: 'print' });

  // 16:9スライド比率で出力 (254mm × 142.875mm ≒ 1600×900)
  await page.pdf({
    path: OUTPUT,
    width: '1600px',
    height: '900px',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    preferCSSPageSize: false,
  });

  console.log('PDF書き出し: ' + OUTPUT);
  await browser.close();
})();
