const stops = [
  [0, [102, 122, 169]], [4, [126, 139, 184]], [6, [205, 153, 145]],
  [8, [158, 181, 211]], [10, [164, 190, 216]], [15, [161, 186, 212]],
  [17, [214, 165, 137]], [19, [211, 146, 128]], [21, [137, 139, 183]],
  [23, [102, 122, 169]], [24, [102, 122, 169]],
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
