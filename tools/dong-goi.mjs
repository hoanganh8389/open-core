// [2026-11-24 06:31 PM Johnny Chu - Chu Hoàng Anh] P2b-5 — đóng gói @bizcity/contracts + @bizcity/platform thành tệp .tgz để đính kèm GitHub Release (chủ chốt 2026-11-24:
//   phát hành bằng Release, giữ tên @bizcity/*, không cần tổ chức / token; đổi sang registry sau chỉ sửa dòng phiên bản ở app).
// Dùng: node tools/dong-goi.mjs <phiên-bản> [thư-mục-ra]   (vd 0.2.0 dist-release) — chạy SAU pnpm run build.
// - Phiên bản phải khớp package.json của cả hai gói (tag v0.2.0 ⇒ 0.2.0).
// - Lúc đóng gói, phụ thuộc @bizcity/contracts của platform trỏ sang URL tệp contracts của CÙNG bản Release (không có registry); xong trả lại nguyên tệp.
// Không phụ thuộc gói ngoài (R-PLAT-5).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// [2026-11-27 11:31 PM Johnny Chu - Chu Hoàng Anh] C2 — dời từ bizcity-platform sang open-core; Release ở repo open-core
const REPO = 'hoanganh8389/open-core';
const [ver, outArg = 'dist-release'] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(ver ?? '')) { console.error('Cần phiên bản dạng 0.2.0'); process.exit(2); }

const out = path.resolve(outArg);
mkdirSync(out, { recursive: true });
const pkgPath = (name) => path.join('packages', name, 'package.json');
const read = (name) => JSON.parse(readFileSync(pkgPath(name), 'utf8'));
for (const n of ['contracts', 'platform']) {
  const v = read(n).version;
  if (v !== ver) { console.error(`packages/${n}/package.json đang ${v}, tag là ${ver} — nâng phiên bản trước.`); process.exit(2); }
  if (!existsSync(path.join('packages', n, 'dist'))) { console.error(`Chưa build packages/${n} (thiếu dist) — chạy pnpm run build.`); process.exit(2); }
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const pack = (name) => execFileSync(npm, ['pack', '--pack-destination', out, '--json'], { cwd: path.join('packages', name), encoding: 'utf8', shell: process.platform === 'win32' });
const url = (file) => `https://github.com/${REPO}/releases/download/v${ver}/${file}`;

const contracts = JSON.parse(pack('contracts'))[0].filename;
const original = readFileSync(pkgPath('platform'), 'utf8');
try {
  const p = JSON.parse(original);
  p.dependencies['@bizcity/contracts'] = url(contracts);
  writeFileSync(pkgPath('platform'), JSON.stringify(p, null, 2) + '\n');
  const platform = JSON.parse(pack('platform'))[0].filename;
  console.log(`Đã đóng gói vào ${out}:\n  ${contracts}\n  ${platform}\nApp cài:\n  "@bizcity/contracts": "${url(contracts)}",\n  "@bizcity/platform": "${url(platform)}"`);
} finally {
  writeFileSync(pkgPath('platform'), original); // trả lại nguyên tệp dù lỗi
}
