const DATA = window.DATASETS || {};
const CATALOG = window.SAMPLE_CATALOG || [];
const TAX_PRESETS = {
  '英国': { local: 20, corp: 25, currency: 'GBP', locale: 'en-GB', label: '标准 VAT 20%，企业所得税主税率 25%', note: '英国 VAT 标准税率为 20%，企业所得税主税率按 25% 预设。' },
  '德国': { local: 19, corp: 30, currency: 'EUR', locale: 'de-DE', label: '标准 VAT 19%，综合企业税约 30%', note: '德国标准 VAT 为 19%，企业所得税按企业所得税、团结附加税和地方营业税的常见综合口径估算。' },
  '法国': { local: 20, corp: 25, currency: 'EUR', locale: 'fr-FR', label: '标准 VAT 20%，企业所得税 25%', note: '法国标准 VAT 为 20%，企业所得税常规税率按 25% 预设。' },
  '西班牙': { local: 21, corp: 25, currency: 'EUR', locale: 'es-ES', label: '标准 VAT 21%，企业所得税 25%', note: '西班牙标准 VAT 为 21%，企业所得税常规税率按 25% 预设。' },
  '日本': { local: 10, corp: 30, currency: 'JPY', locale: 'ja-JP', label: '消费税 10%，综合企业税约 30%', note: '日本消费税按 10% 预设，企业所得税按常见综合有效税负估算。' },
  '澳大利亚': { local: 10, corp: 30, currency: 'AUD', locale: 'en-AU', label: 'GST 10%，公司税 30%', note: '澳大利亚 GST 按 10% 预设，公司税按一般公司 30% 预设。' },
  '加拿大': { local: 5, corp: 26.5, currency: 'CAD', locale: 'en-CA', label: 'GST 5%，企业税按联邦+省级估算', note: '加拿大 GST/HST 会随省份变化，默认先按联邦 GST 5% 和常见综合企业税 26.5% 估算。' },
  '美国': { local: 0, corp: 21, currency: 'USD', locale: 'en-US', label: '无联邦销售税，联邦企业所得税 21%', note: '美国销售税由州和地方决定，默认 0%，需要按具体州/城市手动填写；联邦企业所得税按 21% 预设。' },
  '中国': { local: 13, corp: 25, currency: 'CNY', locale: 'zh-CN', label: '增值税 13%，企业所得税 25%', note: '中国一般货物增值税按 13% 预设，企业所得税按 25% 预设。' }
};
let currentName = '样本A_综合均衡';
let orders = clone(DATA[currentName] || []);
let filtered = [...orders];
let reportText = '';

const keys = {
  id:'订单ID', month:'月份', platform:'平台', destination:'目的地', category:'类目', product:'商品', hs:'HS编码', qty:'数量', price:'客单价USD', revenue:'销售额USD', cost:'采购成本USD', logistics:'物流费USD', fee:'平台佣金USD', ad:'推广费USD', invoice:'有进货发票', zone:'综试区登记', filed:'出口申报完成', allowed:'非取消退免税货物', rate:'估算税率', eligible:'是否符合无票免税', taxBefore:'免税前估算税费USD', taxAfter:'免税后估算税费USD', saving:'节省税费USD', profitBefore:'免税前利润USD', profitAfter:'免税后利润USD', margin:'免税后利润率', risk:'风险等级'
};
const numericKeys = new Set(Object.values(keys).filter(k => /USD|数量|税率|利润率|客单价/.test(k)));
const $ = id => document.getElementById(id);
const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
function currentTaxPreset(){ return TAX_PRESETS[$('cCountry')?.value] || TAX_PRESETS['英国']; }
function calcCurrency(){ return currentTaxPreset().currency || 'USD'; }
function calcFmt(n){
  const preset = currentTaxPreset();
  return new Intl.NumberFormat(preset.locale || 'en-US', {
    style: 'currency',
    currency: preset.currency || 'USD',
    maximumFractionDigits: 0
  }).format(Number(n || 0));
}
const pct = n => (Number(n || 0) * 100).toFixed(1) + '%';
const sum = (arr, k) => arr.reduce((a, b) => a + Number(b[k] || 0), 0);
const avg = (arr, k) => arr.length ? sum(arr, k) / arr.length : 0;
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function clone(v){ return JSON.parse(JSON.stringify(v || [])); }
function ping(freq = 660){
  if (!$('soundToggle')?.checked) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.18);
}
function groupBy(arr, key, val){
  const m = {};
  arr.forEach(x => { const g = x[key] || '未填写'; m[g] = (m[g] || 0) + Number(x[val] || 0); });
  return m;
}
function currentCatalog(){ return CATALOG.find(x => x.key === currentName) || { name: currentName, highlight: '自定义上传数据', focus: '按上传字段自动分析', category: '自定义' }; }
function metrics(arr = filtered){
  const revenue = sum(arr, keys.revenue);
  const before = sum(arr, keys.profitBefore);
  const after = sum(arr, keys.profitAfter);
  const saving = sum(arr, keys.saving);
  const high = arr.filter(x => x[keys.risk] === '高').length;
  const eligible = arr.filter(x => x[keys.eligible] === '是').length;
  return { revenue, before, after, saving, high, eligible, lift: (after - before) / Math.max(1, Math.abs(before)), margin: revenue ? after / revenue : 0 };
}
function init(){
  renderSamples(); initFilters(); initCountryOptions(); wireEvents(); fillCase(0); update(); navActive();
}
function wireEvents(){
  $('resetBtn').addEventListener('click', () => { ping(); resetFilters(); });
  $('printBtn').addEventListener('click', () => window.print());
  $('calcBtn').addEventListener('click', () => { ping(760); calculateOne(); });
  $('downloadBtn').addEventListener('click', downloadReport);
  $('copyReportBtn').addEventListener('click', copyReport);
  document.querySelectorAll('[data-case]').forEach(btn => btn.addEventListener('click', e => { ping(720); fillCase(Number(e.currentTarget.dataset.case)); }));
  ['cRevenue','cCost','cLogistics','cFee','cAd','cOtherFee','cLocalTaxRate','cTaxRate','cCorpTaxRate','cInvoice','cZone','cFiled','cAllowed','cProduct'].forEach(id => $(id).addEventListener('input', calculateOne));
  $('cCountry').addEventListener('change', () => { applyCountryPreset($('cCountry').value, true); calculateOne(); });
  $('fileInput').addEventListener('change', handleUpload);
  window.addEventListener('scroll', navActive);
}
function initCountryOptions(){
  $('cCountry').innerHTML = Object.keys(TAX_PRESETS).map(x => `<option>${esc(x)}</option>`).join('');
}
function applyCountryPreset(country, overwrite = false){
  const preset = TAX_PRESETS[country] || TAX_PRESETS['英国'];
  if (overwrite){
    $('cLocalTaxRate').value = preset.local;
    $('cCorpTaxRate').value = preset.corp;
  }
  document.querySelectorAll('[data-currency-unit]').forEach(el => { el.textContent = preset.currency || 'USD'; });
  $('countryTaxInfo').innerHTML = `<b>${esc(country)}</b><span>${esc(preset.label)}</span><small>当前金额单位：${esc(preset.currency || 'USD')}。${esc(preset.note)}</small>`;
}
function renderSamples(){
  $('sampleGrid').innerHTML = CATALOG.map(item => `<button class="sample-card ${item.key === currentName ? 'active' : ''}" data-key="${esc(item.key)}"><span class="sample-id">${item.id}</span><h3>${esc(item.name)}</h3><p>${esc(item.focus)}</p><div class="sample-meta"><span>${esc(item.category)}</span><span>风险：${esc(item.risk)}</span></div></button>`).join('');
  document.querySelectorAll('.sample-card').forEach(card => card.addEventListener('click', () => switchDataset(card.dataset.key)));
}
function switchDataset(name){
  if (!DATA[name]) return;
  currentName = name; orders = clone(DATA[name]); filtered = [...orders];
  document.querySelectorAll('.sample-card').forEach(card => card.classList.toggle('active', card.dataset.key === name));
  initFilters(); resetFilters(); fillCase(0); ping(640);
}
function initFilters(){
  const platform = [...new Set(orders.map(x => x[keys.platform]).filter(Boolean))];
  const category = [...new Set(orders.map(x => x[keys.category]).filter(Boolean))];
  $('platformFilter').innerHTML = '<option value="全部">全部平台</option>' + platform.map(x => `<option>${esc(x)}</option>`).join('');
  $('categoryFilter').innerHTML = '<option value="全部">全部类目</option>' + category.map(x => `<option>${esc(x)}</option>`).join('');
  ['platformFilter','categoryFilter','riskFilter'].forEach(id => { $(id).onchange = () => { ping(580); update(); }; });
  updateDatasetBadge();
}
function resetFilters(){
  $('platformFilter').value = '全部'; $('categoryFilter').value = '全部'; $('riskFilter').value = '全部'; update();
}
function updateDatasetBadge(){
  const cat = currentCatalog();
  $('datasetStatus').textContent = `当前数据：${cat.name || currentName}`;
  $('datasetRows').textContent = `订单数：${orders.length} 条`;
  $('datasetPersona').textContent = `分析重点：${cat.highlight || cat.focus}`;
}
function update(){
  const p = $('platformFilter').value || '全部';
  const c = $('categoryFilter').value || '全部';
  const r = $('riskFilter').value || '全部';
  filtered = orders.filter(x => (p === '全部' || x[keys.platform] === p) && (c === '全部' || x[keys.category] === c) && (r === '全部' || x[keys.risk] === r));
  renderMetrics(); renderHeroInsight(); renderCharts(); renderRankings(); renderQuality(); renderTable(); renderDataTables(); generateReport();
}
function renderMetrics(){
  const m = metrics();
  $('kRevenue').textContent = fmt(m.revenue); $('kProfit').textContent = fmt(m.after); $('kSaving').textContent = fmt(m.saving); $('kRisk').textContent = `${m.high} 单`;
}
function renderHeroInsight(){
  const m = metrics(orders); const cat = currentCatalog();
  const riskWord = m.high ? `同时有 ${m.high} 单高风险订单，需要先补齐资料。` : '当前样本高风险订单较少，政策价值更集中体现在利润改善。';
  $('heroInsight').innerHTML = `<h3>当前样本核心结论</h3><div class="big">${fmt(m.saving)}</div><p><b>${esc(cat.category)}</b> 样本共 ${orders.length} 单，免税后利润率约 ${pct(m.margin)}，利润提升 ${pct(m.lift)}。${riskWord}</p>`;
}
function renderCharts(){
  const months = [...new Set(orders.map(x => x[keys.month]))].sort();
  const rev = months.map(m => sum(filtered.filter(x => x[keys.month] === m), keys.revenue));
  const pro = months.map(m => sum(filtered.filter(x => x[keys.month] === m), keys.profitAfter));
  svgLine('lineChart', months, rev, pro);
  svgDonut('donutChart', groupBy(filtered, keys.platform, keys.revenue));
  svgBar('barChart', groupBy(filtered, keys.category, keys.saving), '#265dff');
  svgBar('riskChart', groupBy(filtered, keys.risk, keys.revenue), '#d98712');
}
function svgLine(id, labels, a, b){
  const svg = $(id), w = svg.clientWidth || 680, h = svg.clientHeight || 278, p = 42;
  const max = Math.max(...a, ...b, 1) * 1.18;
  const x = i => labels.length < 2 ? w / 2 : p + i * (w - 2 * p) / (labels.length - 1);
  const y = v => h - p - (v / max) * (h - 2 * p);
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  let grid = '';
  for (let i = 0; i < 5; i++){ const yy = p + i * (h - 2 * p) / 4; grid += `<line x1="${p}" y1="${yy}" x2="${w-p}" y2="${yy}" stroke="#edf2f7"/>`; }
  svg.innerHTML = grid + labels.map((l,i)=>`<text x="${x(i)}" y="${h-14}" font-size="12" fill="#667085" text-anchor="middle">${esc(String(l).slice(5))}</text>`).join('') + `<path d="${path(a)}" fill="none" stroke="#265dff" stroke-width="4" stroke-linecap="round"/><path d="${path(b)}" fill="none" stroke="#10a875" stroke-width="4" stroke-linecap="round"/><text x="${p}" y="24" fill="#265dff" font-size="13" font-weight="800">销售额</text><text x="${p+72}" y="24" fill="#10a875" font-size="13" font-weight="800">利润</text>`;
}
function svgBar(id, obj, color){
  const svg = $(id), w = svg.clientWidth || 520, h = svg.clientHeight || 278, p = 42;
  const entries = Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = Math.max(...entries.map(x=>x[1]), 1), gap = 12, bw = (w - 2*p - Math.max(0, entries.length - 1)*gap) / Math.max(entries.length, 1);
  svg.innerHTML = entries.map((e,i)=>{ const bh = Math.max(4, (e[1]/max)*(h-98)); const x = p + i*(bw+gap); const y = h - 46 - bh; return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${color}" opacity="${0.94-i*.055}"/><text x="${x+bw/2}" y="${h-20}" font-size="12" fill="#667085" text-anchor="middle">${esc(e[0].slice(0,4))}</text><text x="${x+bw/2}" y="${y-8}" font-size="12" fill="#344054" text-anchor="middle" font-weight="800">${fmt(e[1])}</text>`; }).join('');
}
function svgDonut(id, obj){
  const svg = $(id), w = svg.clientWidth || 520, h = svg.clientHeight || 278, cx = Math.min(132, w * .33), cy = h / 2, r = 80;
  const total = Object.values(obj).reduce((a,b)=>a+b,0) || 1;
  const colors = ['#265dff','#10a875','#d98712','#7457d8','#02a4d3','#d64545'];
  let acc = 0, parts = [];
  Object.entries(obj).forEach((e,i)=>{ const v = e[1]/total; const start = acc*2*Math.PI, end = (acc+v)*2*Math.PI; acc += v; const x1 = cx+r*Math.cos(start), y1 = cy+r*Math.sin(start), x2 = cx+r*Math.cos(end), y2 = cy+r*Math.sin(end), large = v > .5 ? 1 : 0; parts.push(`<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i%colors.length]}"/>`); });
  const legendX = Math.min(w - 210, cx + 130);
  const legend = Object.entries(obj).slice(0,6).map((e,i)=>`<circle cx="${legendX}" cy="${62+i*30}" r="6" fill="${colors[i%colors.length]}"/><text x="${legendX+16}" y="${66+i*30}" font-size="13" fill="#344054">${esc(e[0])} · ${fmt(e[1])}</text>`).join('');
  svg.innerHTML = parts.join('') + `<circle cx="${cx}" cy="${cy}" r="46" fill="white"/><text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="18" font-weight="900" fill="#101828">占比</text>` + legend;
}
function renderRankings(){
  const top = [...filtered].sort((a,b)=>b[keys.profitAfter]-a[keys.profitAfter]).slice(0,7);
  const max = Math.max(...top.map(x=>x[keys.profitAfter]), 1);
  $('rankList').innerHTML = top.length ? top.map((x,i)=>`<div class="rank-row"><div class="rank-no">${i+1}</div><div class="rank-name" title="${esc(x[keys.product])}">${esc(x[keys.product])}</div><div class="rank-bar"><span style="width:${Math.max(4, x[keys.profitAfter]/max*100).toFixed(1)}%"></span></div><div class="rank-val">${fmt(x[keys.profitAfter])}</div></div>`).join('') : '<p class="empty">暂无数据</p>';
  const risks = [...filtered].filter(x => x[keys.risk] === '高').slice(0,6);
  $('riskList').innerHTML = risks.length ? risks.map(x=>`<div class="risk-item"><div><b>${esc(x[keys.product])}</b><span>${esc(x[keys.platform])} · ${esc(x[keys.id])}</span></div><div><b>${riskReason(x)}</b><span>建议先复核字段</span></div></div>`).join('') : '<div class="quality-item ok"><div><b>当前筛选下没有高风险订单</b><span>可切换高风险样本查看异常订单。</span></div></div>';
}
function riskReason(x){
  if (x[keys.allowed] !== '是') return '货物适用性问题';
  if (x[keys.zone] !== '是') return '综试区登记缺失';
  if (x[keys.filed] !== '是') return '出口申报未完成';
  if (Number(x[keys.margin] || 0) < .08) return '利润率偏低';
  return '条件需复核';
}
function renderQuality(){
  const checks = [
    ['订单编号', orders.every(x => x[keys.id]), '每条订单都应有唯一编号'],
    ['销售和成本字段', orders.every(x => Number.isFinite(Number(x[keys.revenue])) && Number.isFinite(Number(x[keys.cost]))), '销售额、成本、物流费会影响利润测算'],
    ['政策判断字段', orders.every(x => x[keys.invoice] && x[keys.zone] && x[keys.filed] && x[keys.allowed]), '四类条件用于判断是否符合无票免税'],
    ['风险等级字段', orders.every(x => ['低','中','高'].includes(x[keys.risk])), '低中高标记用于快速筛选风险订单'],
  ];
  $('qualityList').innerHTML = checks.map(([name, ok, tip]) => `<div class="quality-item ${ok ? 'ok' : ''}"><div><b>${ok ? '通过' : '需检查'} · ${name}</b><span>${tip}</span></div></div>`).join('');
}
function renderTable(){
  const cols = [keys.id, keys.month, keys.platform, keys.category, keys.product, keys.revenue, keys.profitAfter, keys.saving, keys.eligible, keys.risk];
  const rows = [...filtered].sort((a,b)=>b[keys.profitAfter]-a[keys.profitAfter]).slice(0,18);
  $('ordersTable').innerHTML = `<thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr>${cols.map(c=>cell(c,x[c])).join('')}</tr>`).join('')}</tbody>`;
}
function renderDataTables(){
  if (!$('summaryTable')) return;
  const summaryRows = Object.keys(DATA).map(name => {
    const rows = DATA[name] || [];
    const m = metrics(rows);
    const cat = CATALOG.find(x => x.key === name) || {};
    return {
      '样本': (cat.id || name).replace('样本',''),
      '分类': cat.category || '自定义',
      '订单数': rows.length,
      '销售额': fmt(m.revenue),
      '节省税费': fmt(m.saving),
      '利润率': pct(m.margin),
      '高风险': `${m.high} 单`
    };
  });
  const platformRows = Object.entries(groupBy(orders, keys.platform, keys.revenue)).sort((a,b)=>b[1]-a[1]).map(([name, revenue]) => {
    const rows = orders.filter(x => x[keys.platform] === name);
    return { '平台': name, '订单数': rows.length, '销售额': fmt(revenue), '利润': fmt(sum(rows, keys.profitAfter)), '节税': fmt(sum(rows, keys.saving)) };
  }).slice(0, 6);
  const categoryRows = Object.entries(groupBy(orders, keys.category, keys.saving)).sort((a,b)=>b[1]-a[1]).map(([name, saving]) => {
    const rows = orders.filter(x => x[keys.category] === name);
    return { '类目': name, '订单数': rows.length, '节税': fmt(saving), '利润率': pct(sum(rows, keys.profitAfter) / Math.max(1, sum(rows, keys.revenue))) };
  }).slice(0, 6);
  const codeRows = [
    { 'HS编码': '3924', '类目': '家居小件', '默认税率': '13%', '适用': '是' },
    { 'HS编码': '8518', '类目': '3C配件', '默认税率': '13%', '适用': '是' },
    { 'HS编码': '4202', '类目': '户外用品', '默认税率': '13%', '适用': '是' },
    { 'HS编码': '6214', '类目': '服饰配件', '默认税率': '9%', '适用': '是' },
    { 'HS编码': '9503', '类目': '玩具礼品', '默认税率': '13%', '适用': '需复核' },
    { 'HS编码': '3304', '类目': '美妆个护', '默认税率': '13%', '适用': '否' }
  ];
  $('summaryTable').innerHTML = compactTable(summaryRows);
  $('platformPreviewTable').innerHTML = compactTable(platformRows);
  $('categoryPreviewTable').innerHTML = compactTable(categoryRows);
  $('codePreviewTable').innerHTML = compactTable(codeRows);
}
function compactTable(rows){
  if (!rows.length) return '<tbody><tr><td>暂无数据</td></tr></tbody>';
  const cols = Object.keys(rows[0]);
  return `<thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${cols.map(c=>`<td>${esc(row[c])}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
function cell(c, v){
  if (c === keys.risk){ const cl = v === '高' ? 'high' : v === '中' ? 'mid' : 'low'; return `<td><span class="status ${cl}">${esc(v)}</span></td>`; }
  if (typeof v === 'number' && c.includes('USD')) return `<td>${fmt(v)}</td>`;
  return `<td>${esc(v)}</td>`;
}
function fillCase(idx){
  const cases = [
    {p:'蓝牙耳机保护套',country:'英国',r:1280,c:520,l:170,f:120,a:68,o:45,t:13,i:'否',z:'是',d:'是',al:'是'},
    {p:'桌面理线器',country:'德国',r:950,c:420,l:120,f:85,a:34,o:38,t:13,i:'否',z:'否',d:'是',al:'是'},
    {p:'针织围巾',country:'日本',r:780,c:360,l:110,f:72,a:28,o:26,t:9,i:'是',z:'是',d:'是',al:'是'},
  ];
  const c = cases[idx] || cases[0];
  $('cProduct').value = c.p; $('cCountry').value = c.country; $('cRevenue').value = c.r; $('cCost').value = c.c; $('cLogistics').value = c.l; $('cFee').value = c.f; $('cAd').value = c.a; $('cOtherFee').value = c.o; $('cTaxRate').value = c.t; $('cInvoice').value = c.i; $('cZone').value = c.z; $('cFiled').value = c.d; $('cAllowed').value = c.al; applyCountryPreset(c.country, true); calculateOne();
}
function calculateOne(){
  const v = id => $(id).value;
  const revenue = +v('cRevenue'), cost = +v('cCost'), log = +v('cLogistics'), fee = +v('cFee'), ad = +v('cAd'), other = +v('cOtherFee');
  const localRate = +v('cLocalTaxRate') / 100, rate = +v('cTaxRate') / 100, corpRate = +v('cCorpTaxRate') / 100;
  const noInvoice = v('cInvoice') === '否';
  const eligible = noInvoice && v('cZone') === '是' && v('cFiled') === '是' && v('cAllowed') === '是';
  const baseProfit = revenue - cost - log - fee - ad - other;
  const localTax = revenue * localRate;
  const taxBefore = noInvoice ? revenue * rate : 0, taxAfter = eligible ? 0 : taxBefore;
  const taxableBefore = Math.max(0, baseProfit - localTax - taxBefore);
  const taxableAfter = Math.max(0, baseProfit - localTax - taxAfter);
  const corpBefore = taxableBefore * corpRate, corpAfter = taxableAfter * corpRate;
  const before = taxableBefore - corpBefore, after = taxableAfter - corpAfter, delta = after - before;
  $('rRevenue').textContent = calcFmt(revenue); $('rLocalTax').textContent = calcFmt(localTax); $('rCorpTax').textContent = calcFmt(corpAfter); $('rBefore').textContent = calcFmt(before); $('rAfter').textContent = calcFmt(after); $('rDelta').textContent = calcFmt(delta);
  const status = eligible ? '满足无票免税条件' : '暂不满足无票免税条件';
  $('calcFormula').innerHTML = `税前经营利润 = 销售额 - 采购成本 - 物流费 - 平台佣金 - 推广费 - 其他费用 = <b>${calcFmt(baseProfit)}</b>；当地流转税 = 销售额 × 当地税率 = <b>${calcFmt(localTax)}</b>；企业所得税 = max(税前经营利润 - 当地流转税 - 出口税费, 0) × 企业所得税率；免税后净利润 = max(税前经营利润 - 当地流转税 - 免税后出口税费, 0) - 企业所得税。`;
  $('invoiceFormula').innerHTML = noInvoice
    ? `无票口径：没有进货发票时，若综试区登记、出口申报和货物适用性都满足，则出口税费按无票免税处理为 <b>${calcFmt(taxAfter)}</b>；若条件不满足，则按销售额 × 无票免税测算税率估算出口税费。`
    : `有票口径：有进货发票时，本计算器按“有合规进项凭证”的普通出口凭证路径处理，不进入无票免税判断，因此出口税费按 <b>${calcFmt(0)}</b> 计入；它和无票免税可能出现利润接近，区别主要在资料路径和合规依据。`;
  $('calcExplain').innerHTML = `<b>${esc(v('cProduct'))}</b> 销往 <b>${esc(v('cCountry'))}</b>：金额单位为 <b>${esc(calcCurrency())}</b>，免税前净利润 ${calcFmt(before)}，免税后净利润 ${calcFmt(after)}，利润变化 ${calcFmt(delta)}。判断结果：<b>${status}</b>。该计算用于课程演示和经营测算，真实申报还需按国家、州省、商品类别和企业资料复核。`;
}
function generateReport(){
  const m = metrics();
  const best = [...filtered].sort((a,b)=>b[keys.profitAfter]-a[keys.profitAfter])[0];
  const worst = [...filtered].sort((a,b)=>a[keys.margin]-b[keys.margin])[0];
  const topPlatform = Object.entries(groupBy(filtered, keys.platform, keys.revenue)).sort((a,b)=>b[1]-a[1])[0];
  const cat = currentCatalog();
  const lines = [
    `总体结果：当前分析 ${filtered.length} 条订单，销售额合计 ${fmt(m.revenue)}，免税后利润 ${fmt(m.after)}，节省税费 ${fmt(m.saving)}。`,
    `政策影响：在当前模型口径下，符合条件订单带来约 ${fmt(m.saving)} 的税费减负，利润提升约 ${pct(m.lift)}。`,
    `经营发现：表现最好的商品是“${best ? best[keys.product] : '-'}”，利润率偏低的商品是“${worst ? worst[keys.product] : '-'}”。`,
    `平台判断：当前销售贡献最高的平台是 ${topPlatform ? topPlatform[0] : '-'}，适合结合平台费用和类目结构继续分析。`,
    `风险提醒：当前有 ${m.high} 条高风险订单。高风险通常来自登记、申报、货物适用性或利润率异常，建议先补资料再判断能否享受政策。`,
    `样本重点：本轮使用${cat.name || currentName}，核心关注${cat.highlight || cat.focus}。`
  ];
  reportText = lines.join('\n');
  $('aiReport').innerHTML = `<ol>${lines.map(x => `<li>${esc(x).replace(/(\$[\d,]+)/g,'<b>$1</b>')}</li>`).join('')}</ol>`;
}
function downloadReport(){
  ping(820);
  const blob = new Blob([`E路退当前分析报告\n生成时间：${new Date().toLocaleString()}\n当前样本：${currentCatalog().name || currentName}\n\n${reportText}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'E路退_当前分析报告.txt'; a.click(); URL.revokeObjectURL(url);
}
async function copyReport(){
  ping(700);
  try { await navigator.clipboard.writeText(reportText); $('copyReportBtn').textContent = '已复制'; setTimeout(()=>$('copyReportBtn').textContent='复制摘要', 1200); } catch { alert(reportText); }
}
function splitCSVLine(line){
  const arr = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++){ const ch = line[i]; if (ch === '"'){ q = !q; continue; } if (ch === ',' && !q){ arr.push(cur); cur = ''; } else cur += ch; }
  arr.push(cur); return arr;
}
function parseCSV(text){
  const lines = text.trim().split(/\r?\n/).filter(Boolean); const headers = splitCSVLine(lines[0].replace(/^\uFEFF/, ''));
  return lines.slice(1).map(line => { const vals = splitCSVLine(line); const o = {}; headers.forEach((h,i)=>{ let v = (vals[i] || '').trim(); if (numericKeys.has(h)) v = Number(v || 0); o[h] = v; }); return o; });
}
function handleUpload(e){
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = file.name.toLowerCase().endsWith('.json') ? JSON.parse(ev.target.result) : parseCSV(ev.target.result);
      currentName = `自定义上传：${file.name}`; orders = data; filtered = [...orders]; initFilters(); resetFilters(); ping(620);
    } catch (err) { alert('文件读取失败，请检查字段和格式。'); console.error(err); }
  };
  reader.readAsText(file, 'utf-8');
}
function navActive(){
  const ids = ['overview','calc','samples','tech','dashboard','risk','compare','tables','report']; const y = scrollY + 140; let cur = ids[0];
  ids.forEach(id => { const el = $(id); if (el && el.offsetTop <= y) cur = id; });
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
}
init();
