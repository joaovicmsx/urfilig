const stops = [
  [0, [39, 55, 83]], [4, [57, 76, 108]], [6, [130, 113, 74]],
  [10, [164, 145, 88]], [14, [176, 139, 78]], [17, [153, 99, 65]],
  [20, [74, 84, 119]], [23, [48, 63, 96]], [24, [39, 55, 83]],
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
  root.style.setProperty('--time-halo', `rgba(${rgb.join(',')}, .12)`);
  return rgb;
}

applyTimeTheme();
setInterval(applyTimeTheme, 60_000);
