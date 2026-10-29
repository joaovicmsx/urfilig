const stops = [
  [0, [92, 112, 164]], [4, [120, 137, 184]], [6, [214, 190, 91]],
  [9, [246, 224, 101]], [15, [245, 220, 93]], [18, [231, 177, 89]],
  [20, [139, 139, 183]], [23, [92, 112, 164]], [24, [92, 112, 164]],
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
  root.style.setProperty('--time-halo', `rgba(${rgb.join(',')}, .11)`);
  root.style.setProperty('--time-halo-visible', `rgba(${rgb.join(',')}, .2)`);
  return rgb;
}

applyTimeTheme();
setInterval(applyTimeTheme, 60_000);
