// cars.js — car profiles. `engine` is what the synthesizer (dsp.js) needs, `vehicle` drives the
// drivetrain simulation (vehicle.js), `art` is the side-view drawing (art.js).
//
// art: body/window outlines as [x, y] points (front bumper → over the roof → rear → underside),
// in a 400×160 box with the road at y=140, car facing right; wheels at x with radius r;
// head/tail lamp positions; under/over extra shapes (wings, fins, helmet); nozzle for thrusters;
// tall: body height factor, from the real height:length ratio.
// photo: optional side-view picture (transparent PNG, facing right); the drawing is the fallback
// when it is missing. photoNozzle: where the thrusters leave that picture, as fractions [x, y].
// specZh: the spec line in Chinese, shown when the page runs in Chinese.
//
// engine.firing: [crank angle °, bank] per cylinder over one 720° cycle, built from the real
// firing order. Which bank each cylinder sits on is what gives a cross-plane V8 its burble.
// vehicle.gears: km/h per 1000 rpm in each gear, estimated from real first-gear and top speeds.

const evenFiring = (order, bankOf) => order.map((cyl, i) => [i * 720 / order.length, bankOf(cyl)]);

const CARS = [
  {
    id: 'model3', name: 'Tesla Model 3', spec: 'Permanent-magnet motor · 1-speed · ElectricZen', specZh: '永磁电机 · 单速 · ElectricZen',
    photo: 'img/electric-zen.png',
    art: {
      tall: 1.34, color: '#9b1b24', wheels: { x: [95, 300], r: 26 }, head: [368, 104], tail: [36, 96],
      body: [[372, 126], [378, 108], [360, 98], [300, 92], [265, 88], [215, 60], [150, 60], [90, 80], [40, 88], [30, 104], [34, 126]],
      window: [[258, 88], [214, 64], [160, 64], [100, 82]],
    },
    engine: { type: 'electric', sound: { orders: [[12, 0.3], [36, 0.08]], inverter: 1200, inverterGain: 0.04, bright: 1200, gain: 0.7 } },
    vehicle: { type: 'ev', rpmPerKmh: 69, accel0: 7, vmax: 72 },
  },
  {
    id: 'roadster2', name: 'Tesla Roadster', spec: '3 motors · cold-gas thrusters', specZh: '三电机 · 冷气推进器',
    photo: 'img/tesla-roadster-thrust.png', photoNozzle: [0.07, 0.58],
    art: {
      tall: 1.25, color: '#c8102e', wheels: { x: [100, 295], r: 26 }, head: [370, 106], tail: [34, 98], nozzle: [26, 108],
      body: [[372, 126], [380, 110], [362, 100], [300, 94], [255, 88], [215, 66], [160, 66], [110, 84], [40, 90], [26, 104], [30, 126]],
      window: [[250, 88], [216, 70], [168, 70], [125, 86]],
      over: [{ pts: [[22, 103], [40, 103], [40, 113], [22, 113]], fill: '#111', sharp: true }],
    },
    engine: { type: 'thruster', sound: { onset: 0.45, curve: 1.5, roarHz: 900, cracks: 18, gain: 0.9 } },
    vehicle: { type: 'ev', rpmPerKmh: 50, accel0: 12, vmax: 112 },
  },
  {
    id: 'typer', name: 'Honda Civic Type R', spec: '2.0 L turbo inline-4 · 7,000 rpm · 6-spd manual', specZh: '2.0 L 涡轮直列四缸 · 7,000 转 · 6 速手动',
    photo: 'img/city-shifter.png',
    art: {
      tall: 1.3, color: '#1e88e5', wheels: { x: [100, 295], r: 25 }, head: [366, 104], tail: [36, 92],
      body: [[370, 126], [376, 108], [358, 100], [300, 94], [265, 88], [220, 60], [120, 58], [80, 66], [40, 80], [30, 100], [34, 126]],
      window: [[258, 88], [222, 64], [130, 62], [92, 70]],
      over: [{ pts: [[28, 66], [80, 62], [80, 68], [30, 73]], fill: '#151515', sharp: true }, { pts: [[48, 72], [54, 72], [58, 82], [52, 82]], fill: '#151515', sharp: true }],
    },
    engine: {
      type: 'combustion', idle: 800, redline: 7000, firing: evenFiring([1, 3, 4, 2], () => 0),
      sound: { pipeLen: 1.4, pipeFeedback: 0.55, pipeDamp: 0.4, pulseDeg: 45, formants: [[320, 1.5, 0.5], [1100, 2, 0.3]], muffler: 2200, intake: 0.15, pops: 5, lumpy: 0, drive: 2.5, gain: 1.6 },
    },
    vehicle: { type: 'manual', gears: [8.6, 14, 20, 26, 32, 39], shiftGentle: 3000, shiftFull: 6800, downRpm: 1300, shiftTime: 0.35, accel0: 6, vmax: 75 },
  },
  {
    id: 'gt3', name: 'Porsche 911 GT3', spec: '4.0 L flat-6 · 9,000 rpm · 7-spd PDK', specZh: '4.0 L 水平对置六缸 · 9,000 转 · 7 速 PDK',
    photo: 'img/gt3.png',
    art: {
      tall: 1.25, color: '#e6e6e6', wheels: { x: [100, 300], r: 26 }, head: [368, 104], tail: [36, 94],
      body: [[372, 126], [378, 108], [362, 100], [315, 96], [270, 90], [225, 64], [175, 62], [120, 76], [50, 88], [30, 100], [32, 126]],
      window: [[262, 90], [226, 68], [180, 66], [135, 80]],
      over: [{ pts: [[24, 66], [96, 62], [96, 69], [26, 74]], fill: '#1a1a1a', sharp: true }, { pts: [[56, 72], [62, 72], [68, 86], [62, 86]], fill: '#1a1a1a', sharp: true }],
    },
    engine: {
      type: 'combustion', idle: 1000, redline: 9000, firing: evenFiring([1, 6, 2, 4, 3, 5], c => (c <= 3 ? 0 : 1)),
      sound: { pipeLen: 1.0, pipeFeedback: 0.6, pipeDamp: 0.5, pulseDeg: 40, formants: [[420, 1.5, 0.5], [1500, 2, 0.4]], muffler: 3800, intake: 0.3, pops: 3, lumpy: 0, drive: 2.2, gain: 1.2 },
    },
    vehicle: { type: 'dct', gears: [7.8, 12, 16.5, 21, 26, 31, 37], shiftGentle: 3500, shiftFull: 8800, downRpm: 1800, shiftTime: 0.08, accel0: 9, vmax: 88 },
  },
  {
    id: 'camaro', name: 'Chevrolet Camaro SS', spec: '6.2 L pushrod V8 · 6,500 rpm · 6-spd manual', specZh: '6.2 L 推杆 V8 · 6,500 转 · 6 速手动',
    photo: 'img/v8-muscle.png',
    art: {
      tall: 1.3, color: '#f5c400', wheels: { x: [95, 300], r: 27 }, head: [374, 100], tail: [32, 92],
      body: [[374, 126], [380, 104], [368, 96], [300, 90], [245, 86], [205, 64], [155, 64], [120, 82], [50, 86], [28, 92], [28, 126]],
      window: [[238, 86], [206, 68], [160, 68], [130, 82]],
      over: [{ pts: [[250, 88], [300, 92], [300, 96], [250, 93]], fill: '#111', sharp: true }],
    },
    engine: {
      type: 'combustion', idle: 700, redline: 6500, firing: evenFiring([1, 8, 7, 2, 6, 5, 4, 3], c => c % 2),
      sound: { pipeLen: 2.2, pipeFeedback: 0.65, pipeDamp: 0.35, pulseDeg: 55, formants: [[160, 1.5, 0.7], [600, 2, 0.3]], muffler: 1700, intake: 0.15, pops: 6, lumpy: 0.15, drive: 2, gain: 1.0 },
    },
    vehicle: { type: 'manual', gears: [12, 18, 26, 34, 42, 60], shiftGentle: 2500, shiftFull: 6300, downRpm: 1100, shiftTime: 0.4, accel0: 7, vmax: 80 },
  },
  {
    id: 'hellcat', name: 'Dodge Challenger Hellcat', spec: '6.2 L supercharged V8 · 6,200 rpm · 8-spd auto', specZh: '6.2 L 机械增压 V8 · 6,200 转 · 8 速自动',
    photo: 'img/hellcat.png',
    art: {
      tall: 1.3, color: '#7ac70c', wheels: { x: [92, 302], r: 27 }, head: [374, 96], tail: [30, 88],
      body: [[376, 126], [380, 100], [372, 92], [300, 88], [250, 84], [212, 62], [150, 62], [115, 80], [45, 82], [26, 88], [26, 126]],
      window: [[244, 84], [214, 66], [156, 66], [124, 80]],
      over: [{ pts: [[285, 87], [320, 84], [324, 89]], fill: '#151515', sharp: true }, { pts: [[26, 100], [376, 100], [376, 104], [26, 104]], fill: '#151515', sharp: true }],
    },
    engine: {
      type: 'combustion', idle: 750, redline: 6200, firing: evenFiring([1, 8, 4, 3, 6, 5, 7, 2], c => c % 2),
      sound: { pipeLen: 2.0, pipeFeedback: 0.65, pipeDamp: 0.35, pulseDeg: 55, formants: [[170, 1.5, 0.7], [650, 2, 0.35]], muffler: 1900, intake: 0.15, whine: { ratio: 35, gain: 0.07 }, pops: 8, lumpy: 0.1, drive: 2.5, gain: 1.0 },
    },
    vehicle: { type: 'auto', gears: [11, 17, 23, 30, 38, 48, 58, 75], shiftGentle: 2200, shiftFull: 6000, downRpm: 1100, shiftTime: 0.15, accel0: 8, vmax: 89 },
  },
  {
    id: 'urus', name: 'Lamborghini Urus', spec: '4.0 L twin-turbo V8 · 6,800 rpm · 8-spd auto', specZh: '4.0 L 双涡轮 V8 · 6,800 转 · 8 速自动',
    photo: 'img/lamborghini-urus.png',
    art: {
      tall: 1.3, color: '#4caf50', wheels: { x: [95, 300], r: 30 }, head: [374, 92], tail: [32, 80],
      body: [[376, 124], [382, 98], [368, 86], [300, 80], [262, 76], [225, 52], [130, 52], [80, 62], [36, 72], [26, 96], [30, 124]],
      window: [[256, 76], [226, 56], [140, 56], [92, 66]],
      under: [{ pts: [[30, 112], [376, 112], [376, 126], [30, 126]], fill: '#1b1b1b', sharp: true }],
    },
    engine: {
      type: 'combustion', idle: 750, redline: 6800, firing: evenFiring([1, 5, 4, 8, 6, 3, 7, 2], c => (c <= 4 ? 0 : 1)),
      sound: { pipeLen: 1.8, pipeFeedback: 0.6, pipeDamp: 0.4, pulseDeg: 50, formants: [[200, 1.5, 0.6], [800, 2, 0.3]], muffler: 1400, intake: 0.1, pops: 5, lumpy: 0, drive: 2, gain: 1.0 },
    },
    vehicle: { type: 'auto', gears: [8.8, 14, 20, 27, 34, 42, 52, 65], shiftGentle: 2300, shiftFull: 6600, downRpm: 1100, shiftTime: 0.12, accel0: 8, vmax: 85 },
  },
  {
    id: 'f812', name: 'Ferrari 812 Superfast', spec: '6.5 L V12 · 8,900 rpm · 7-spd DCT', specZh: '6.5 L V12 · 8,900 转 · 7 速双离合',
    photo: 'img/ferrari-v12.png',
    art: {
      tall: 1.2, color: '#b8bcc4', wheels: { x: [95, 300], r: 27 }, head: [372, 102], tail: [32, 96],
      body: [[376, 126], [382, 106], [366, 98], [300, 92], [238, 86], [200, 64], [160, 64], [105, 84], [40, 90], [26, 100], [28, 126]],
      window: [[230, 86], [202, 68], [164, 68], [118, 84]],
    },
    engine: {
      type: 'combustion', idle: 800, redline: 8900, firing: evenFiring([1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10], c => (c <= 6 ? 0 : 1)),
      sound: { pipeLen: 0.9, pipeFeedback: 0.55, pipeDamp: 0.5, pulseDeg: 35, formants: [[600, 1.5, 0.4], [2200, 2, 0.4]], muffler: 5000, intake: 0.25, pops: 2, lumpy: 0, drive: 1.8, gain: 1.2 },
    },
    vehicle: { type: 'dct', gears: [9, 13, 18, 23, 28, 34, 40], shiftGentle: 3000, shiftFull: 8700, downRpm: 1500, shiftTime: 0.08, accel0: 9, vmax: 94 },
  },
  {
    id: 'enzo', name: 'Ferrari Enzo', spec: '6.0 L V12 · 8,200 rpm · 6-spd F1', specZh: '6.0 L V12 · 8,200 转 · 6 速 F1 序列式',
    photo: 'img/ferrari-enzo.png',
    art: {
      tall: 1.2, color: '#e10600', wheels: { x: [95, 300], r: 27 }, head: [374, 112], tail: [30, 98],
      body: [[378, 128], [388, 116], [370, 108], [310, 100], [265, 92], [235, 70], [190, 68], [150, 80], [70, 86], [30, 90], [24, 108], [28, 126]],
      window: [[258, 92], [236, 74], [194, 72], [160, 82]],
    },
    engine: {
      type: 'combustion', idle: 900, redline: 8200, firing: evenFiring([1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10], c => (c <= 6 ? 0 : 1)),
      sound: { pipeLen: 1.0, pipeFeedback: 0.6, pipeDamp: 0.55, pulseDeg: 35, formants: [[550, 1.5, 0.5], [2000, 2, 0.4]], muffler: 5500, intake: 0.3, pops: 5, lumpy: 0, drive: 2.4, gain: 1.2 },
    },
    vehicle: { type: 'dct', gears: [10, 15, 20, 26, 33, 42], shiftGentle: 3000, shiftFull: 8000, downRpm: 1600, shiftTime: 0.15, accel0: 9, vmax: 97 },
  },
  {
    id: 'veneno', name: 'Lamborghini Veneno', spec: '6.5 L V12 · 8,400 rpm · 7-spd ISR', specZh: '6.5 L V12 · 8,400 转 · 7 速 ISR',
    photo: 'img/lamborghini-veneno.png',
    art: {
      tall: 1.08, color: '#8e9196', sharp: true, wheels: { x: [95, 300], r: 27 }, head: [372, 110], tail: [28, 96],
      body: [[380, 126], [390, 112], [350, 100], [290, 94], [250, 84], [225, 66], [180, 64], [140, 74], [60, 80], [30, 86], [22, 104], [30, 126]],
      window: [[245, 84], [226, 70], [184, 68], [150, 76]],
      over: [
        { pts: [[140, 74], [70, 56], [80, 80]], fill: '#6f7276', sharp: true },
        { pts: [[18, 60], [92, 56], [92, 63], [18, 67]], fill: '#c8102e', sharp: true },
        { pts: [[60, 64], [66, 64], [70, 80], [64, 80]], fill: '#222', sharp: true },
      ],
    },
    engine: {
      type: 'combustion', idle: 900, redline: 8400, firing: evenFiring([1, 7, 4, 10, 2, 8, 6, 12, 3, 9, 5, 11], c => (c <= 6 ? 0 : 1)),
      sound: { pipeLen: 1.1, pipeFeedback: 0.62, pipeDamp: 0.45, pulseDeg: 38, formants: [[380, 1.5, 0.6], [1600, 2, 0.4]], muffler: 4500, intake: 0.3, pops: 10, lumpy: 0, drive: 3, gain: 1.2 },
    },
    vehicle: { type: 'dct', gears: [9, 14, 19, 25, 31, 37, 43], shiftGentle: 3000, shiftFull: 8200, downRpm: 1600, shiftTime: 0.12, accel0: 10, vmax: 98 },
  },
  {
    id: 'f1', name: 'Mercedes F1 W11', spec: '1.6 L turbo V6 hybrid · 15,000 rpm · 8-spd', specZh: '1.6 L 涡轮 V6 混动 · 15,000 转 · 8 速',
    photo: 'img/slipstream.png',
    art: {
      tall: 1, color: '#1f1f22', sharp: true, open: true, wheels: { x: [85, 318], r: 30 },
      body: [[392, 124], [394, 116], [330, 110], [285, 104], [245, 98], [228, 86], [196, 84], [178, 92], [110, 94], [60, 96], [40, 100], [40, 124]],
      over: [
        { pts: [[340, 130], [398, 130], [398, 122], [346, 124]], fill: '#00a19c', sharp: true },
        { pts: [[110, 100], [300, 104], [300, 108], [110, 106]], fill: '#00a19c', sharp: true },
        { pts: [[16, 58], [68, 56], [68, 72], [18, 74]], fill: '#1f1f22', sharp: true },
        { pts: [[40, 72], [48, 72], [52, 98], [44, 98]], fill: '#333', sharp: true },
        { circle: [210, 80, 9], fill: '#e8e8e8' },
        { pts: [[196, 84], [232, 78], [236, 82], [200, 88]], fill: '#555', sharp: true },
      ],
    },
    engine: {
      type: 'combustion', idle: 4000, redline: 15000, firing: evenFiring([1, 4, 2, 5, 3, 6], c => (c <= 3 ? 0 : 1)),
      sound: { pipeLen: 0.5, pipeFeedback: 0.5, pipeDamp: 0.6, pulseDeg: 30, formants: [[1200, 1.5, 0.4], [3000, 2, 0.3]], muffler: 6000, intake: 0.1, pops: 1, lumpy: 0, drive: 1.6, gain: 1.6 },
    },
    // A high-revving race engine never drops below ~9,000 rpm on the move.
    vehicle: { type: 'dct', gears: [8.3, 11, 13.5, 16, 19, 22, 25, 28], shiftGentle: 10500, shiftFull: 12500, downRpm: 9000, shiftTime: 0.03, accel0: 14, vmax: 95 },
  },
  {
    id: 'hearse', name: 'Haunted Hearse', spec: '1959 Cadillac · no engine, only ghosts', specZh: '1959 凯迪拉克 · 没有引擎，只有幽灵',
    photo: 'img/haunted-hearse.png',
    art: {
      tall: 1.1, color: '#1b2a4a', wheels: { x: [92, 312], r: 25, whitewall: true }, head: [378, 100], tail: [28, 86],
      body: [[380, 124], [384, 104], [370, 96], [320, 92], [275, 88], [250, 62], [50, 62], [34, 70], [24, 90], [22, 124]],
      window: [[268, 88], [252, 66], [205, 66], [205, 88]],
      under: [{ pts: [[22, 92], [80, 90], [26, 68]], fill: '#1b2a4a' }],
      over: [
        { pts: [[120, 72], [180, 72], [184, 76], [176, 80], [124, 80], [116, 76]], fill: '#c9c9c9' },
        { pts: [[24, 106], [384, 106], [384, 110], [24, 110]], fill: '#c9c9c9', sharp: true },
      ],
    },
    engine: { type: 'haunted', idle: 600, redline: 4800, sound: { rootHz: 110, gain: 0.6 } },
    vehicle: { type: 'auto', gears: [12, 20, 30, 42], shiftGentle: 2000, shiftFull: 4500, downRpm: 900, shiftTime: 0.3, accel0: 4, vmax: 50 },
  },
];

if (typeof module !== 'undefined') module.exports = { CARS };
