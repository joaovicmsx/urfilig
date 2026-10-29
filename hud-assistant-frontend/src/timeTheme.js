const stops = [
  [0, [61, 76, 112]], [4, [82, 98, 137]], [6, [164, 158, 120]],
  [10, [205, 194, 128]], [14, [220, 207, 145]], [18, [197, 157, 111]],
  [20, [116, 139, 185]], [23, [75, 96, 145]], [24, [61, 76, 112]],
];

export function getTimeColor(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60;
  let index = 0;
  while (index < stops.length - 2 && hour > stops[index + 1][0]) index++;
  const [h1, c1] = stops[index];
  const [h2, c2] = stops[index + 1];
  const t = Math.max(0, Math.min(1, (hour - h1) / (h2 - h1)));
  return c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
}

export function applyTimeTheme() {
  const rgb = getTimeColor();
  const root = document.documentElement;
  root.style.setProperty('--time-accent', `rgb(${rgb.join(',')})`);
  root.style.setProperty('--time-halo', `rgba(${rgb.join(',')}, .045)`);
  root.style.setProperty('--time-halo-visible', `rgba(${rgb.join(',')}, .12)`);
  return rgb;
}

applyTimeTheme();
setInterval(applyTimeTheme, 60_000);
