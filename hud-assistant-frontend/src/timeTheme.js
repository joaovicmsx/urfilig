const stops = [
  [0, [67, 94, 166]], [4, [78, 108, 174]], [6, [255, 218, 166]],
  [8, [255, 238, 190]], [11, [255, 244, 205]], [15, [255, 224, 180]],
  [17, [255, 173, 119]], [19, [234, 126, 113]], [21, [106, 119, 190]],
  [23, [67, 94, 166]], [24, [67, 94, 166]],
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
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  root.style.setProperty('--time-accent', `rgb(${rgb.join(',')})`);
  root.style.setProperty('--time-halo', `rgba(${rgb.join(',')}, .11)`);
  root.style.setProperty('--time-halo-visible', `rgba(${rgb.join(',')}, .2)`);
  root.style.setProperty('--aura-color', `rgba(${rgb.join(',')}, ${hour >= 7 && hour < 19 ? '.30' : '.22'})`);
  return rgb;
}

applyTimeTheme();
setInterval(applyTimeTheme, 60_000);
