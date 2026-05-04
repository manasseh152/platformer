export const level = {
  spawn: { x: 95, y: 430 },
  platforms: [
    {x:0,y:650,w:1280,h:90}, {x:0,y:0,w:40,h:720}, {x:1240,y:0,w:40,h:720},
    {x:150,y:540,w:190,h:24}, {x:425,y:475,w:200,h:24}, {x:720,y:410,w:190,h:24},
    {x:990,y:530,w:170,h:24}, {x:520,y:615,w:130,h:35}, {x:825,y:630,w:95,h:20},
    {x:365,y:405,w:26,h:135}, {x:665,y:285,w:26,h:150}, {x:940,y:420,w:26,h:210}
  ],
  spikes: [ {x:665,y:635,w:120,h:15}, {x:930,y:635,w:80,h:15} ]
};

export function createPlayer(spawn = level.spawn) {
  return {
    x: spawn.x, y: spawn.y, w: 34, h: 50,
    vx: 0, vy: 0, dir: 1, grounded: false,
    hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0,
    dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false,
    dead: false
  };
}

export function createEnemies() {
  return [
    {x: 780, y: 360, w: 42, h: 38, vx: 55, hp: 3, hurt: 0, min: 720, max: 900},
    {x: 1015, y: 490, w: 42, h: 38, vx: -45, hp: 2, hurt: 0, min: 990, max: 1150}
  ];
}
