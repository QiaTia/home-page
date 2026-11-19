import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from '@/layout/hash-router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './index.less';

/* ============ 静态数据 ============ */
type ViewDef = { pos: [number, number, number]; tgt: [number, number, number] };
const VIEWS: Record<string, ViewDef> = {
  overview: { pos: [24, 11, 30], tgt: [0, 3.2, 0] },
  front: { pos: [0.5, 5.5, 36], tgt: [0.5, 4.2, 0] },
  aerial: { pos: [13, 42, 21], tgt: [0, 0, 0] },
  entrance: { pos: [-11, 3.4, 14.5], tgt: [-4.3, 2.6, 3.4] },
  gable: { pos: [28, 7, 12], tgt: [6, 4.6, -1.5] }
};
const VIEW_NAMES: Record<string, string> = {
  overview: '整体', front: '正面', aerial: '鸟瞰', entrance: '入口', gable: '山墙'
};

/** 世界坐标 → 平面图坐标（1 m = 20 px，图幅 X[-11,11] × Z[-8.5,13.5]，北在上） */
const PM = 20, PX0 = -11, PZ0 = -8.5;
const psx = (wx: number) => (wx - PX0) * PM;
const psz = (wz: number) => (wz - PZ0) * PM;

type PlanRoom = { x: number; z: number; w: number; d: number; n?: string; a?: string; t?: string; k?: string; o?: number };
type PlanData = {
  sub: string;
  rooms: PlanRoom[];
  doors: (number | string)[][];
  wins: number[][];
  sky?: number[][];
};

// 房间：x/z 为西/北边线，w/d 为宽/深；k: void=挑空 master=主卧套间 low=低檐；o=1 开放区
const PLAN: Record<string, PlanData> = {
  f1: {
    sub: '一层 · 客餐一体 · 老人房留一楼',
    rooms: [
      { x: -7.5, z: 0.5, w: 4.5, d: 3, n: '玄关', a: '13.5㎡', t: '入户 · 格栅屏' },
      { x: -3.0, z: -2.0, w: 5, d: 5.5, n: '客厅', a: '27.5㎡', t: '挑空 · 幕墙', k: 'void' },
      { x: 2.0, z: -0.5, w: 5.5, d: 4, n: '餐厅', a: '22㎡', t: '南窗 · 圆桌' },
      { x: 2.0, z: -2.0, w: 5.5, d: 1.5, n: '备餐', a: '', t: '水吧', o: 1 },
      { x: -7.5, z: -3.5, w: 4.5, d: 4, n: '茶室', a: '18㎡', t: '西窗 · 棋牌' },
      { x: -7.5, z: -6.5, w: 4.5, d: 3, n: '厨房', a: '13.5㎡', t: '北窗 · 明厨' },
      { x: -3.0, z: -3.5, w: 5, d: 1.5, n: '过厅', a: '', t: '', o: 1 },
      { x: -3.0, z: -6.5, w: 4.5, d: 3, n: '楼梯', a: '', t: '三跑', o: 1 },
      { x: 1.5, z: -6.5, w: 2.5, d: 3, n: '公卫', a: '7.5㎡', t: '干湿分离' },
      { x: 1.5, z: -3.5, w: 2.5, d: 1.5, n: '', a: '', t: '', o: 1 },
      { x: 4.0, z: -6.5, w: 3.5, d: 4.5, n: '老人房', a: '15.8㎡', t: '东窗 · 近卫' }
    ],
    doors: [
      [-5.15, 3.5, -3.85, 3.5],   // 入户门
      [-3.0, 0.9, -3.0, 2.1],     // 玄关 → 客厅
      [-3.0, -3.1, -3.0, -1.9],   // 茶室 → 过厅
      [-5.5, -3.5, -4.4, -3.5],   // 厨房 → 茶室
      [2.3, -3.5, 3.4, -3.5],     // 公卫
      [4.7, -2.0, 5.8, -2.0]      // 老人房
    ],
    wins: [
      [-2.8, 3.5, 2.2, 3.5, 2],     // 客厅幕墙（加粗）
      [3.7, 3.5, 6.9, 3.5],         // 餐厅南窗
      [-4.8, -6.5, -3.6, -6.5],     // 厨房北窗
      [-0.8, -6.5, 0.8, -6.5],      // 楼梯北窗
      [3.6, -6.5, 4.8, -6.5],       // 公卫北窗
      [7.5, -5.0, 7.5, -3.6],       // 老人房东窗
      [7.5, -0.5, 7.5, 1.1],        // 餐厅东窗
      [-7.5, -1.3, -7.5, 0.3]       // 茶室西窗
    ]
  },
  f2: {
    sub: '二层 · 主卧套间 · 双次卧 · 内凹阳台',
    rooms: [
      { x: -7.5, z: 0.5, w: 4.5, d: 3, n: '主卧', a: '13.5㎡', t: '南向长窗', k: 'master' },
      { x: -7.5, z: -3.5, w: 2.25, d: 4, n: '主卫', a: '9㎡', t: '西窗', k: 'master' },
      { x: -5.25, z: -3.5, w: 2.25, d: 4, n: '衣帽厅', a: '9㎡', t: '套间走廊', k: 'master' },
      { x: -3.0, z: -0.5, w: 5, d: 4, n: '客厅上空', a: '20㎡', t: '挑空 · 护栏', k: 'void' },
      { x: -3.0, z: -3.5, w: 5, d: 3, n: '过厅', a: '', t: '楼梯上口', o: 1 },
      { x: -3.0, z: -6.5, w: 4.5, d: 3, n: '楼梯', a: '', t: '上阁楼', o: 1 },
      { x: 2.0, z: -6.5, w: 1.2, d: 8.4, n: '', a: '', t: '', o: 1 },
      { x: 3.2, z: -2.5, w: 4.3, d: 4.4, n: '次卧一', a: '18.9㎡', t: '东窗 · 出阳台' },
      { x: 3.2, z: -4.5, w: 4.3, d: 2, n: '公卫二', a: '8.6㎡', t: '干湿分离' },
      { x: 3.2, z: -6.5, w: 4.3, d: 2, n: '书房', a: '8.6㎡', t: '北高窗 · 客卧' },
      { x: 2.0, z: 1.9, w: 4, d: 1.6, n: '阳台', a: '6.4㎡', t: '内凹 · 推拉门', o: 1 },
      { x: 6.0, z: 1.9, w: 1.5, d: 1.6, n: '壁柜', a: '', t: '' }
    ],
    doors: [
      [-3.0, -2.6, -3.0, -1.4],       // 衣帽厅 → 过厅
      [-4.8, 0.5, -3.7, 0.5],         // 主卧 → 衣帽厅
      [3.2, -1.6, 3.2, -0.4],         // 次卧一
      [3.2, -4.0, 3.2, -2.9],         // 公卫二
      [3.2, -6.0, 3.2, -4.9],         // 书房
      [2.8, 1.9, 5.2, 1.9, 'slide']   // 阳台推拉门
    ],
    wins: [
      [-6.6, 3.5, -3.0, 3.5],
      [6.25, 3.5, 7.25, 3.5],
      [-3.2, -6.5, -1.8, -6.5],
      [1.8, -6.5, 3.2, -6.5],
      [7.5, -2.2, 7.5, 0.2],
      [-7.5, -3.4, -7.5, -1.6]
    ]
  },
  f3: {
    sub: '阁楼 · 天窗多功能厅 · 低檐储藏',
    rooms: [
      { x: -7.5, z: 2.0, w: 15, d: 1.5, n: '', a: '', t: '南坡低檐 · 储藏', k: 'low' },
      { x: -7.5, z: -6.5, w: 15, d: 2.5, n: '', a: '', t: '北坡低檐 · 储藏', k: 'low' },
      { x: -4.0, z: -4.0, w: 8, d: 6, n: '多功能厅', a: '48㎡', t: '天窗 · 山墙窗', k: 'void' },
      { x: -1.5, z: -6.5, w: 3, d: 2.5, n: '楼梯上口', a: '', t: '', o: 1 }
    ],
    doors: [],
    wins: [
      [7.5, -1.9, 7.5, -1.1],
      [-7.5, -1.9, -7.5, -1.1]
    ],
    sky: [[-3.6, 0.3], [2.4, 0.3]]   // 天窗位置
  }
};

function svgEl(t: string, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', t);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  return e;
}
function planLine(svg: SVGSVGElement, x1: number, z1: number, x2: number, z2: number, cls: string) {
  svg.appendChild(svgEl('line', { x1: psx(x1), y1: psz(z1), x2: psx(x2), y2: psz(z2), class: cls }));
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type Tween = { k: number; p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3 } | null;

export default function Villa() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const planBodyRef = useRef<HTMLDivElement>(null);
  const planPanelRef = useRef<HTMLElement>(null);
  const engineRef = useRef<any>({});
  // 平面图面板拖拽: {sx,sy}=起始指针, {bx,by}=面板起始位置, w=面板宽度
  const planDragRef = useRef<{ sx: number; sy: number; bx: number; by: number; w: number; h: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [view, setView] = useState('overview');
  const [rotate, setRotate] = useState(false);
  const [night, setNight] = useState(false);
  const [dims, setDims] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);
  const [planPos, setPlanPos] = useState<{ x: number; y: number; w: number } | null>(null);
  const [floor, setFloor] = useState('f1');
  const [planSub, setPlanSub] = useState(PLAN.f1.sub);
  const [collapsed, setCollapsed] = useState(() =>
    typeof matchMedia !== 'undefined' && matchMedia('(max-width: 640px)').matches
  );

  /* ============ 场景初始化 ============ */
  useEffect(() => {
    const container = sceneRef.current!;
    const engine = engineRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc2d8e8);
    scene.fog = new THREE.Fog(0xc2d8e8, 70, 170);

    const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 600);
    camera.position.set(24, 11, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 3.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 110;
    controls.maxPolarAngle = 1.52;
    controls.minPolarAngle = 0.05;
    controls.autoRotateSpeed = 0.7;

    // 柔和的环境反射，让玻璃与墙面有质感
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    /* ---- 灯光 ---- */
    const hemi = new THREE.HemisphereLight(0xd6e8f7, 0x93a27b, 0.8);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2df, 2.8);
    sun.position.set(20, 30, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    /* ---- 材料 ---- */
    const matWall = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.92 });            // 暖白墙
    const matPlinth = new THREE.MeshStandardMaterial({ color: 0x565650, roughness: 0.85 });          // 深灰基座
    const matWood = new THREE.MeshStandardMaterial({ color: 0xb08856, roughness: 0.65 });            // 木格栅
    const matGable = new THREE.MeshStandardMaterial({ color: 0xa87e52, roughness: 0.7 });            // 木纹山墙
    const matDoor = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.6 });             // 入户门
    const matFrame = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.3 }); // 深色窗框
    const matRoof = new THREE.MeshStandardMaterial({ color: 0x40444a, roughness: 0.75, metalness: 0.15 }); // 深灰屋面
    const matRidge = new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.7, metalness: 0.2 });
    const matGlass = new THREE.MeshPhysicalMaterial({ color: 0x3a586c, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.1 });
    matGlass.emissive = new THREE.Color(0xffc98c);
    matGlass.emissiveIntensity = 0;
    const matGlassRail = new THREE.MeshPhysicalMaterial({ color: 0xcfe2ec, roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0xc7c2b8, roughness: 0.95 });        // 晒场
    const matPath = new THREE.MeshStandardMaterial({ color: 0xd8d3c9, roughness: 0.9 });             // 步道
    const matJoint = new THREE.MeshStandardMaterial({ color: 0x9b968c, roughness: 1 });              // 分格缝
    const matPlanter = new THREE.MeshStandardMaterial({ color: 0xb3aea3, roughness: 0.9 });          // 种植池
    const matSoil = new THREE.MeshStandardMaterial({ color: 0x6e5637, roughness: 1 });               // 泥土
    const matGrain = new THREE.MeshStandardMaterial({ color: 0xd8b268, roughness: 1 });              // 晒谷
    const matHedge = new THREE.MeshStandardMaterial({ color: 0x4e6b3d, roughness: 0.95 });           // 绿篱
    const matTrunk = new THREE.MeshStandardMaterial({ color: 0x77563d, roughness: 0.95, flatShading: true });
    const matLeafA = new THREE.MeshStandardMaterial({ color: 0x5f8049, roughness: 0.9, flatShading: true });
    const matLeafB = new THREE.MeshStandardMaterial({ color: 0x6f9053, roughness: 0.9, flatShading: true });
    const matRoad = new THREE.MeshStandardMaterial({ color: 0x43464a, roughness: 0.95 });
    const matRoadLine = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.9 });
    const matGrass = new THREE.MeshStandardMaterial({ color: 0x8ca368, roughness: 1 });
    const matLawn = new THREE.MeshStandardMaterial({ color: 0x7f9c5c, roughness: 1 });
    const matField = new THREE.MeshStandardMaterial({ color: 0x9db071, roughness: 1 });
    const matCar = new THREE.MeshStandardMaterial({ color: 0x64707c, roughness: 0.35, metalness: 0.55 });
    const matCarGlass = new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.15, metalness: 0.7 });
    const matTire = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const matLampGlow = new THREE.MeshStandardMaterial({ color: 0xfff3dd, emissive: 0xffdfae, emissiveIntensity: 0.35 });

    /* ---- 工具函数 ---- */
    const world = new THREE.Group();
    scene.add(world);

    function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = world) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

    // 立面窗：外框 + 玻璃 + 竖梃（可选横档），朝局部 +Z
    function addWindow(w: number, h: number, x: number, y: number, z: number, rotY = 0, mullions = 0, transom = 0) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      box(w, h, 0.1, matFrame, 0, 0, 0.02, g);
      const gl = box(w - 0.14, h - 0.14, 0.04, matGlass, 0, 0, 0.05, g);
      gl.castShadow = false;
      for (let i = 1; i <= mullions; i++) {
        const mx = -w / 2 + (w * i) / (mullions + 1);
        box(0.07, h - 0.16, 0.06, matFrame, mx, 0, 0.06, g);
      }
      if (transom) box(w - 0.1, 0.08, 0.06, matFrame, 0, transom, 0.06, g);
      world.add(g);
      return g;
    }

    // 低多边形小树
    function tree(x: number, z: number, s = 1) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.14 * s, 1.7 * s, 7), matTrunk);
      trunk.position.y = 0.85 * s;
      g.add(trunk);
      const blobs: [number, number, number, number, THREE.Material][] = [
        [0, 2.35 * s, 0, 1.15 * s, matLeafA],
        [0.55 * s, 1.95 * s, 0.25 * s, 0.8 * s, matLeafB],
        [-0.5 * s, 2.05 * s, -0.2 * s, 0.75 * s, matLeafB],
        [0.1 * s, 2.8 * s, -0.3 * s, 0.68 * s, matLeafA]
      ];
      blobs.forEach(([px, py, pz, r, m]) => {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
        b.position.set(px, py, pz);
        g.add(b);
      });
      g.position.set(x, 0, z);
      g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      world.add(g);
    }

    /* ---- 建筑：两层半 · 双坡顶 ---- */
    box(15.5, 0.3, 10.5, matPlinth, 0, 0.15, -1.5);          // 基座
    box(15, 3.0, 10, matWall, 0, 1.8, -1.5);                 // 一层

    // 二层：南面东侧内凹出阳台
    box(9.5, 3.0, 10, matWall, -2.75, 4.8, -1.5);            // 西段（X -7.5 ~ 2.0）
    box(5.5, 3.0, 8.4, matWall, 4.75, 4.8, -2.3);            // 东段（Z -6.5 ~ 1.9）
    box(1.5, 3.0, 1.6, matWall, 6.75, 4.8, 2.7);             // 东南角小段

    // 内凹阳台（二层南面，X 2.0 ~ 6.0）
    box(4.3, 0.16, 1.85, matConcrete, 4.0, 3.38, 2.72);
    const rail = box(4.0, 1.0, 0.05, matGlassRail, 4.0, 3.98, 3.6);
    rail.castShadow = false;
    box(4.06, 0.06, 0.08, matFrame, 4.0, 4.52, 3.6);         // 栏杆扶手
    addWindow(2.4, 2.2, 4.0, 4.55, 1.94, 0, 1, 0);           // 阳台推拉门

    // 双坡屋顶（屋脊东西向，脊高 8.8 m）
    const slope = Math.atan(0.5);
    const roofS = box(16.0, 0.12, 6.5, matRoof, 0, 7.375, 1.35);
    roofS.rotation.x = slope;
    const roofN = box(16.0, 0.12, 6.5, matRoof, 0, 7.375, -4.35);
    roofN.rotation.x = -slope;
    box(16.2, 0.12, 0.7, matRidge, 0, 8.9, -1.5);            // 屋脊盖板

    // 山墙（东西两端三角，木板饰面）
    const gShape = new THREE.Shape();
    gShape.moveTo(6.5, 6.3); gShape.lineTo(-3.5, 6.3); gShape.lineTo(1.5, 8.8); gShape.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: 0.24, bevelEnabled: false });
    const gEast = new THREE.Mesh(gGeo, matGable);
    gEast.rotation.y = Math.PI / 2;
    gEast.position.set(7.26, 0.01, 0);
    const gWest = gEast.clone();
    gWest.position.x = -7.5;
    [gEast, gWest].forEach(m => { m.castShadow = true; m.receiveShadow = true; world.add(m); });

    // 屋顶天窗（南坡两扇）
    [-3.0, 3.0].forEach(x => {
      const f = box(1.15, 0.08, 1.5, matFrame, x, 7.79, 0.65);
      f.rotation.x = slope;
      const gl = box(1.0, 0.05, 1.35, matGlass, x, 7.85, 0.67);
      gl.rotation.x = slope;
      gl.castShadow = false;
    });

    // 烟囱（北坡，兼作热水器/灶排烟）
    box(0.55, 1.6, 0.55, matPlinth, 4.6, 8.3, -3.4);
    box(0.72, 0.1, 0.72, matFrame, 4.6, 9.15, -3.4);

    /* ---- 南立面（临路） ---- */
    box(1.3, 2.6, 0.1, matFrame, -4.5, 1.6, 3.54);
    box(1.14, 2.44, 0.06, matDoor, -4.5, 1.52, 3.57);
    box(0.05, 0.8, 0.05, matFrame, -4.12, 1.5, 3.62);
    box(2.6, 0.12, 1.35, matFrame, -4.5, 3.02, 4.15);        // 悬挑雨棚
    const porchLight = box(0.5, 0.03, 0.5, matLampGlow, -4.5, 2.95, 4.1);
    porchLight.castShadow = false;

    // 客厅落地玻璃幕墙（X -2.8 ~ 2.2，通高）
    {
      const g = new THREE.Group();
      g.position.set(-0.3, 1.8, 3.55);
      box(5.06, 3.06, 0.14, matFrame, 0, 0, 0, g);
      const gl = box(4.86, 2.86, 0.05, matGlass, 0, 0, 0.04, g);
      gl.castShadow = false;
      [-1.215, 0, 1.215].forEach(mx => box(0.09, 2.86, 0.09, matFrame, mx, 0, 0.05, g));
      box(4.86, 0.09, 0.09, matFrame, 0, 0.72, 0.05, g);     // 栏板高度横档
      world.add(g);
    }
    addWindow(3.2, 1.8, 5.3, 1.8, 3.54, 0, 2, 0);            // 餐厅窗

    // 木格栅（西端，通高遮阳屏）
    for (let i = 0; i < 9; i++) {
      box(0.07, 6.0, 0.16, matWood, -7.35 + i * 0.2, 3.3, 3.64);
    }

    // 二层南面长窗 + 东南角小窗
    addWindow(7.8, 1.4, -2.7, 5.0, 3.54, 0, 5, 0);
    addWindow(1.0, 1.4, 6.75, 5.0, 3.54, 0, 0, 0);

    /* ---- 东西北立面 ---- */
    addWindow(2.0, 1.6, 7.53, 1.8, 0.3, Math.PI / 2, 1, 0);      // 东 · 一层
    addWindow(1.4, 1.6, 7.53, 1.7, -4.3, Math.PI / 2, 0, 0);     // 东 · 一层
    addWindow(2.4, 1.4, 7.53, 5.0, -1.0, Math.PI / 2, 2, 0);     // 东 · 二层
    addWindow(0.75, 0.75, 7.53, 7.35, -1.5, Math.PI / 2, 0, 0);  // 东山墙阁楼圆窗位
    addWindow(1.6, 1.6, -7.53, 1.8, -0.5, -Math.PI / 2, 1, 0);   // 西 · 一层
    addWindow(1.8, 1.4, -7.53, 5.0, -2.5, -Math.PI / 2, 1, 0);   // 西 · 二层
    addWindow(0.75, 0.75, -7.53, 7.35, -1.5, -Math.PI / 2, 0, 0);// 西山墙阁楼窗
    addWindow(1.2, 1.5, -4.2, 1.75, -6.53, Math.PI, 0, 0);       // 北 · 厨房
    addWindow(1.6, 1.5, 0, 1.75, -6.53, Math.PI, 1, 0);          // 北 · 楼梯间
    addWindow(1.2, 1.5, 4.2, 1.75, -6.53, Math.PI, 0, 0);        // 北 · 卫生间
    addWindow(1.4, 1.2, -2.5, 5.0, -6.53, Math.PI, 0, 0);        // 北 · 二层
    addWindow(1.4, 1.2, 2.5, 5.0, -6.53, Math.PI, 0, 0);

    /* ---- 场地：20 × 15 宅基地 ---- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), matGrass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    world.add(ground);
    const field = box(240, 0.02, 14, matField, 0, 0.006, 20.5);
    field.castShadow = false;
    const lawn = box(19.1, 0.02, 14.2, matLawn, 0, 0.012, 0);
    lawn.castShadow = false;

    // 马路（南侧）
    const road = box(240, 0.08, 6, matRoad, 0, 0.04, 10.5);
    road.castShadow = false;
    for (let i = -9; i <= 9; i++) {
      const dash = box(1.1, 0.012, 0.14, matRoadLine, i * 6, 0.085, 10.5);
      dash.castShadow = false;
    }

    // 前院硬化晒场 + 混凝土分格缝
    const yard = box(19.0, 0.06, 3.8, matConcrete, 0, 0.03, 5.55);
    yard.castShadow = false;
    [-4.75, 0, 4.75].forEach(x => { const j = box(0.03, 0.008, 3.8, matJoint, x, 0.064, 5.55); j.castShadow = false; });
    [4.75, 6.35].forEach(z => { const j = box(19, 0.008, 0.03, matJoint, 0, 0.064, z); j.castShadow = false; });

    // 入户步道
    const walk = box(1.5, 0.07, 3.8, matPath, -4.5, 0.035, 5.4);
    walk.castShadow = false;

    // 沿墙种植池 + 绿篱球
    box(2.0, 0.36, 0.66, matPlanter, -6.4, 0.24, 3.98);
    box(1.86, 0.06, 0.54, matSoil, -6.4, 0.4, 3.98);
    box(11.0, 0.36, 0.66, matPlanter, 1.9, 0.24, 3.98);
    box(10.86, 0.06, 0.54, matSoil, 1.9, 0.4, 3.98);
    function bush(x: number, z: number, r = 0.3) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), matLeafB);
      b.position.set(x, 0.58, z);
      b.castShadow = true;
      world.add(b);
    }
    [-7.0, -6.4, -5.8].forEach(x => bush(x, 3.98));
    for (let i = 0; i < 9; i++) bush(-3.1 + i * 1.3, 3.98);

    // 晒谷匾（晒场的身份符号）
    function grain(x: number, z: number, r: number) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 24), matGrain);
      t.position.set(x, 0.095, z);
      t.castShadow = true; t.receiveShadow = true;
      world.add(t);
    }
    grain(-7.8, 5.6, 1.0);
    grain(-6.3, 6.15, 0.72);
    grain(-8.2, 6.5, 0.6);
    grain(-2.6, 5.9, 0.85);

    // 小汽车（停在晒场东侧）
    {
      const car = new THREE.Group();
      box(1.78, 0.55, 4.3, matCar, 0, 0.63, 0, car);
      const gh = box(1.55, 0.38, 2.25, matCarGlass, 0, 1.1, -0.1, car);
      gh.castShadow = false;
      box(1.62, 0.09, 2.35, matCar, 0, 1.32, -0.1, car);
      [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]].forEach(([wx, wz]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14), matTire);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.34, wz);
        w.castShadow = true;
        car.add(w);
      });
      car.position.set(5.9, 0, 5.1);
      world.add(car);
    }

    // 宅基地绿篱（南侧留人行门与车行门）
    function hedge(w: number, x: number, z: number, d = 0.45) { box(w, 0.55, d, matHedge, x, 0.275, z); }
    hedge(4.75, -7.625, 7.28);   // 西段
    hedge(7.55, 0.025, 7.28);    // 中段
    hedge(1.8, 9.1, 7.28);       // 东段
    box(0.45, 0.55, 14.56, matHedge, 9.78, 0.275, 0);   // 东
    box(0.45, 0.55, 14.56, matHedge, -9.78, 0.275, 0);  // 西
    box(19.56, 0.55, 0.45, matHedge, 0, 0.275, -7.28);  // 北

    // 车行木栅门（关闭）
    box(0.14, 1.6, 0.14, matFrame, 3.87, 0.8, 7.28);
    box(0.14, 1.6, 0.14, matFrame, 8.13, 0.8, 7.28);
    for (let i = 0; i < 11; i++) box(0.16, 1.05, 0.06, matGable, 4.05 + i * 0.385, 0.82, 7.28);
    box(4.3, 0.07, 0.08, matFrame, 6.0, 1.42, 7.28);
    box(4.3, 0.07, 0.08, matFrame, 6.0, 0.28, 7.28);
    // 人行小门
    box(0.12, 1.3, 0.12, matFrame, -5.18, 0.65, 7.28);
    box(0.12, 1.3, 0.12, matFrame, -3.82, 0.65, 7.28);
    for (let i = 0; i < 4; i++) box(0.13, 0.9, 0.05, matGable, -5.02 + i * 0.34, 0.68, 7.28);
    box(1.5, 0.06, 0.07, matFrame, -4.5, 1.18, 7.28);

    // 门前道钉灯 + 门前庭院灯
    function bollard(x: number, z: number) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 10), matFrame);
      p.position.set(x, 0.31, z); p.castShadow = true;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 10), matLampGlow);
      top.position.set(x, 0.59, z);
      world.add(p, top);
    }
    bollard(-5.45, 4.6);
    bollard(-3.55, 4.6);
    function yardLamp(x: number, z: number) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 10), matFrame);
      p.position.set(x, 1.3, z); p.castShadow = true;
      const glow = box(0.16, 0.3, 0.16, matLampGlow, x, 2.72, z);
      glow.castShadow = false;
      box(0.34, 0.06, 0.34, matFrame, x, 2.9, z);
    }
    yardLamp(3.3, 6.8);
    yardLamp(-5.75, 6.8);

    // 后院菜地
    box(5.0, 0.16, 0.75, matSoil, -2.0, 0.08, -6.95);
    [-7.15, -6.93, -6.71].forEach(z => {
      const row = box(4.7, 0.1, 0.15, matLeafB, -2.0, 0.2, z);
      row.castShadow = false;
    });

    // 院内与远处树木
    tree(-8.9, 1.2, 1.1);
    tree(8.9, 0.8, 0.95);
    tree(-8.6, -6.2, 1.0);
    tree(8.8, -6.3, 0.9);
    tree(-14.5, 3, 1.15);
    tree(15, 4, 1.05);
    tree(-13, -9, 1.2);
    tree(14, -10, 1.0);
    tree(-16, 16.5, 1.3);
    tree(-10.5, 17.5, 1.05);
    tree(12, 17, 1.2);
    tree(17.5, 16, 1.0);
    tree(7, 18.5, 0.9);

    /* ---- 尺寸标注 ---- */
    const dims = new THREE.Group();
    scene.add(dims);
    const dimMat = new THREE.LineBasicMaterial({ color: 0x30353b });
    function dimLine(a: [number, number, number], b: [number, number, number]) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
      dims.add(new THREE.Line(geo, dimMat));
    }
    const dimTickMat = new THREE.MeshStandardMaterial({ color: 0x30353b });
    // 宅基地面宽 20 m
    dimLine([-10, 0.12, 6.9], [10, 0.12, 6.9]);
    [-10, 10].forEach(x => box(0.05, 0.02, 0.6, dimTickMat, x, 0.12, 6.9, dims).castShadow = false);
    // 宅基地进深 15 m
    dimLine([10.6, 0.12, 7.5], [10.6, 0.12, -7.5]);
    [7.5, -7.5].forEach(z => box(0.6, 0.02, 0.05, dimTickMat, 10.6, 0.12, z, dims).castShadow = false);

    function tag(text: string, x: number, y: number, z: number, w = 256) {
      const c = document.createElement('canvas');
      c.width = w; c.height = 96;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = 'rgba(30,34,40,0.88)';
      const r = 26, px = 8, py = 16, pw = w - 16, ph = 64;
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.arcTo(px + pw, py, px + pw, py + ph, r);
      ctx.arcTo(px + pw, py + ph, px, py + ph, r);
      ctx.arcTo(px, py + ph, px, py, r);
      ctx.arcTo(px, py, px + pw, py, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f7f4ee';
      ctx.font = '600 34px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, 50);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      sp.position.set(x, y, z);
      dims.add(sp);
      return sp;
    }
    const t20 = tag('20 m', 0, 0.95, 6.9);
    t20.scale.set(3.0, 1.125, 1);
    const t15 = tag('15 m', 10.6, 0.95, 0);
    t15.scale.set(3.0, 1.125, 1);
    const tb = tag('建筑 15m × 10m', 0, 11.2, -1.5, 384);
    tb.scale.set(7.2, 1.8, 1);

    /* ---- 平面图 · 双视图联动 ---- */
    // 平面图 → 3D：点击平面任意点，相机保持当前方向与距离平移过去
    function flyToPoint(wx: number, wz: number) {
      const dist = Math.max(camera.position.distanceTo(controls.target), 9);
      const dir = camera.position.clone().sub(controls.target);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) dir.set(0.8, 0, 0.6);
      dir.normalize();
      const t1 = new THREE.Vector3(
        THREE.MathUtils.clamp(wx, -9.5, 9.5), 2.2,
        THREE.MathUtils.clamp(wz, -7, 7)
      );
      const p1 = t1.clone().addScaledVector(dir, dist);
      p1.y = Math.max(camera.position.y, 5.5);
      engine.tween = { k: 0, p0: camera.position.clone(), p1, t0: controls.target.clone(), t1 };
      if (controls.autoRotate) {
        controls.autoRotate = false;
        setRotate(false);
      }
    }

    // 3D → 平面图：实时同步相机位置与视线方向
    function updateCamMarker() {
      if (!engine.planOpen || !engine.camG) return;
      const wx = THREE.MathUtils.clamp(camera.position.x, -11, 11);
      const wz = THREE.MathUtils.clamp(camera.position.z, -8.5, 13.5);
      const tx = THREE.MathUtils.clamp(controls.target.x, -11, 11);
      const tz = THREE.MathUtils.clamp(controls.target.z, -8.5, 13.5);
      const x = psx(wx), y = psz(wz);
      const ang = Math.atan2(psz(tz) - y, psx(tx) - x) * 180 / Math.PI;
      engine.camG.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    }

    /* ---- 夜景灯光 ---- */
    const nightLights: THREE.PointLight[] = [];
    function pointLight(x: number, y: number, z: number, intensity: number, distance: number) {
      const l = new THREE.PointLight(0xffd9a6, 0, distance, 2);
      l.position.set(x, y, z);
      l.userData.night = intensity;
      scene.add(l);
      nightLights.push(l);
      return l;
    }
    pointLight(-4.5, 2.7, 4.3, 5, 10);    // 门廊
    pointLight(4.0, 4.8, 2.8, 4, 9);      // 阳台
    pointLight(3.3, 2.7, 6.8, 4, 10);     // 东庭院灯
    pointLight(-5.75, 2.7, 6.8, 4, 10);   // 西庭院灯

    /* ---- 视角飞行 ---- */
    function flyTo(name: string) {
      const v = VIEWS[name];
      const p1 = new THREE.Vector3(...v.pos);
      const t1 = new THREE.Vector3(...v.tgt);
      if (reducedMotion) { camera.position.copy(p1); controls.target.copy(t1); return; }
      engine.tween = { k: 0, p0: camera.position.clone(), p1, t0: controls.target.clone(), t1 };
    }

    /* ---- 日夜切换 ---- */
    const envMats = [matWall, matPlinth, matWood, matGable, matFrame, matGlass, matRoof, matCar, matConcrete, matPath];
    function setNight(v: boolean) {
      if (v) {
        (scene.background as THREE.Color).set(0x0c1420);
        (scene.fog as THREE.Fog).color.set(0x0c1420);
        (scene.fog as THREE.Fog).near = 50; (scene.fog as THREE.Fog).far = 150;
        sun.position.set(-14, 24, -10);
        sun.color.set(0x9fb6e0);
        sun.intensity = 0.5;
        hemi.color.set(0x223148); hemi.groundColor.set(0x141a24); hemi.intensity = 0.5;
        matGlass.emissiveIntensity = 1.15;
        matLampGlow.emissiveIntensity = 2.4;
        nightLights.forEach(l => l.intensity = l.userData.night as number);
        envMats.forEach(m => m.envMapIntensity = 0.12);
      } else {
        (scene.background as THREE.Color).set(0xc2d8e8);
        (scene.fog as THREE.Fog).color.set(0xc2d8e8);
        (scene.fog as THREE.Fog).near = 70; (scene.fog as THREE.Fog).far = 170;
        sun.position.set(20, 30, 18);
        sun.color.set(0xfff2df);
        sun.intensity = 2.8;
        hemi.color.set(0xd6e8f7); hemi.groundColor.set(0x93a27b); hemi.intensity = 0.8;
        matGlass.emissiveIntensity = 0;
        matLampGlow.emissiveIntensity = 0.35;
        nightLights.forEach(l => l.intensity = 0);
        envMats.forEach(m => m.envMapIntensity = 1);
      }
      matGlass.envMapIntensity = v ? 0.15 : 1.1;
    }

    /* ---- 挂载到 engine 供 UI 状态联动 ---- */
    engine.camera = camera;
    engine.controls = controls;
    engine.dims = dims;
    engine.flyTo = flyTo;
    engine.setNight = setNight;
    engine.flyToPoint = flyToPoint;
    engine.updateCamMarker = updateCamMarker;

    // 用户拖动时打断飞行与自动环游
    controls.addEventListener('start', () => {
      engine.tween = null;
      if (controls.autoRotate) {
        controls.autoRotate = false;
        setRotate(false);
      }
    });

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener('resize', onResize);

    // 3D 场景全屏期间锁定页面滚动
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /* ---- 主循环 ---- */
    const clock = new THREE.Clock();
    let raf = 0;
    let firstFrame = true;
    function loop() {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      if (engine.tween) {
        const tw = engine.tween as NonNullable<Tween>;
        tw.k += dt / 1.4;
        const e = ease(Math.min(tw.k, 1));
        camera.position.lerpVectors(tw.p0, tw.p1, e);
        controls.target.lerpVectors(tw.t0, tw.t1, e);
        if (tw.k >= 1) engine.tween = null;
      }
      controls.update();
      updateCamMarker();
      renderer.render(scene, camera);
      if (firstFrame) {
        firstFrame = false;
        setReady(true);
        setTimeout(() => setLoaderGone(true), 700);
      }
    }
    loop();

    /* ---- 卸载清理 ---- */
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prevOverflow;
      controls.dispose();
      pmrem.dispose();
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  /* ============ 平面图绘制（命令式 SVG） ============ */
  function drawPlan(key: string) {
    const planBody = planBodyRef.current;
    if (!planBody) return;
    const engine = engineRef.current;
    const d = PLAN[key];
    setPlanSub(d.sub);
    planBody.innerHTML = '';
    const svg = svgEl('svg', { viewBox: '0 0 440 440', class: 'plan-svg-el' }) as SVGSVGElement;

    // 低檐斜线填充图案
    const defs = svgEl('defs', {});
    const pat = svgEl('pattern', { id: 'plow', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.appendChild(svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'rgba(128,128,128,.3)', 'stroke-width': 1 }));
    defs.appendChild(pat);
    svg.appendChild(defs);

    // 马路（南侧）与晒场
    svg.appendChild(svgEl('rect', { x: 0, y: psz(7.5), width: 440, height: 6 * PM, class: 'pr-road' }));
    planLine(svg, 0, 10.5, 22, 10.5, 'pr-roadline');
    svg.appendChild(svgEl('text', { x: psx(0), y: psz(9.4), 'text-anchor': 'middle', class: 'pr-label' }, '马 路 · 南'));
    svg.appendChild(svgEl('text', { x: psx(0), y: psz(5.6), 'text-anchor': 'middle', class: 'pr-label2' }, '前院 · 硬化晒场'));

    // 宅基地边界
    svg.appendChild(svgEl('rect', { x: psx(-10), y: psz(-7.5), width: 20 * PM, height: 15 * PM, class: 'pr-env' }));

    // 房间
    d.rooms.forEach(r => {
      const g = svgEl('g', { class: 'roomg' });
      g.appendChild(svgEl('rect', {
        x: psx(r.x), y: psz(r.z), width: r.w * PM, height: r.d * PM,
        class: r.k ? 'pr-' + r.k : (r.o ? 'pr-open' : 'pr-room')
      }));
      const wpx = r.w * PM, dpx = r.d * PM;
      const cx = psx(r.x) + wpx / 2, cy = psz(r.z) + dpx / 2;
      if (r.n && wpx > 34 && dpx > 24) {
        const two = r.a && wpx > 52 && dpx > 40;
        const y0 = cy - (two ? 7 : 4);
        g.appendChild(svgEl('text', { x: cx, y: y0, 'text-anchor': 'middle', class: 'pr-name' }, r.n));
        if (two) g.appendChild(svgEl('text', { x: cx, y: y0 + 15, 'text-anchor': 'middle', class: 'pr-area' }, r.a));
        if (r.t && wpx > 92 && dpx > 62) g.appendChild(svgEl('text', { x: cx, y: y0 + 29, 'text-anchor': 'middle', class: 'pr-note' }, r.t));
      } else if (r.t && !r.n && wpx > 70) {
        g.appendChild(svgEl('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'pr-note' }, r.t));
      }
      svg.appendChild(g);
    });

    // 楼梯踏步与上行箭头
    if (key === 'f1' || key === 'f2') {
      for (let i = 1; i < 9; i++) {
        const z = -6.5 + i * 0.375;
        planLine(svg, -3.0, z, 1.5, z, 'pr-step');
      }
      svg.appendChild(svgEl('path', {
        d: `M ${psx(-0.75)} ${psz(-6.0)} L ${psx(-0.75)} ${psz(-4.4)} M ${psx(-1.35)} ${psz(-5.1)} L ${psx(-0.75)} ${psz(-4.4)} L ${psx(-0.15)} ${psz(-5.1)}`,
        class: 'pr-door'
      }));
    }

    // 门：墙身留白 + 开启弧线
    d.doors.forEach(dr => {
      const x1 = psx(dr[0] as number), y1 = psz(dr[1] as number), x2 = psx(dr[2] as number), y2 = psz(dr[3] as number);
      if (dr[4] === 'slide') {
        // 推拉门：两条错位线
        const mx = (x1 + x2) / 2;
        svg.appendChild(svgEl('line', { x1: x1, y1: y1 - 2, x2: mx, y2: y1 - 2, class: 'pr-slide' }));
        svg.appendChild(svgEl('line', { x1: mx, y1: y1 + 2, x2: x2, y2: y1 + 2, class: 'pr-slide' }));
        return;
      }
      svg.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'pr-gap' }));
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len > 2) {
        // 门扇（自铰链端旋转 90°）+ 轨迹弧
        const lx = x1 - dy, ly = y1 + dx;
        svg.appendChild(svgEl('line', { x1, y1, x2: lx, y2: ly, class: 'pr-door' }));
        svg.appendChild(svgEl('path', { d: `M ${x2} ${y2} A ${len} ${len} 0 0 0 ${lx} ${ly}`, class: 'pr-door' }));
      }
    });

    // 窗
    d.wins.forEach(wn => {
      planLine(svg, wn[0], wn[1], wn[2], wn[3], wn[4] === 2 ? 'pr-win2' : 'pr-win');
    });

    // 阁楼天窗
    if (d.sky) {
      d.sky.forEach(s => {
        svg.appendChild(svgEl('rect', { x: psx(s[0]), y: psz(s[1]), width: 1.2 * PM, height: 1.0 * PM, class: 'pr-sky' }));
      });
      svg.appendChild(svgEl('text', { x: psx(-3.0), y: psz(1.35), 'text-anchor': 'middle', class: 'pr-note' }, '天窗'));
      svg.appendChild(svgEl('text', { x: psx(3.0), y: psz(1.35), 'text-anchor': 'middle', class: 'pr-note' }, '天窗'));
    }

    // 外墙
    svg.appendChild(svgEl('rect', { x: psx(-7.5), y: psz(-6.5), width: 15 * PM, height: 10 * PM, class: 'pr-wall' }));

    // 指北针 + 比例尺
    svg.appendChild(svgEl('path', { d: 'M 398 300 L 398 282 M 393 288 L 398 281 L 403 288', class: 'pr-door' }));
    svg.appendChild(svgEl('text', { x: 398, y: 313, 'text-anchor': 'middle', class: 'pr-label2' }, 'N'));
    const sx0 = psx(-10), sy0 = psz(6.9);
    svg.appendChild(svgEl('line', { x1: sx0, y1: sy0, x2: sx0 + 5 * PM, y2: sy0, class: 'pr-door' }));
    [0, 5].forEach(m => svg.appendChild(svgEl('line', { x1: sx0 + m * PM, y1: sy0 - 3, x2: sx0 + m * PM, y2: sy0 + 3, class: 'pr-door' })));
    svg.appendChild(svgEl('text', { x: sx0 + 2.5 * PM, y: sy0 + 12, 'text-anchor': 'middle', class: 'pr-note' }, '5 m'));

    // 相机标记（视线扇形 + 圆点 + 朝向）
    const camMark = svgEl('g', {});
    camMark.appendChild(svgEl('path', { d: 'M0 0 L52 -22 A56 56 0 0 1 52 22 Z', class: 'pr-camfov' }));
    camMark.appendChild(svgEl('line', { x1: 0, y1: 0, x2: 16, y2: 0, class: 'pr-camdir' }));
    camMark.appendChild(svgEl('circle', { r: 5, class: 'pr-camdot' }));
    svg.appendChild(camMark);

    planBody.appendChild(svg);
    engine.planSvgEl = svg;
    engine.camG = camMark;
    engine.drawPlanInto?.(svg, key);
  }

  /* ============ 状态联动 ============ */
  useEffect(() => { engineRef.current.flyTo?.(view); }, [view]);
  useEffect(() => { engineRef.current.setNight?.(night); }, [night]);
  useEffect(() => {
    const controls = engineRef.current.controls;
    if (controls) controls.autoRotate = rotate;
  }, [rotate]);
  useEffect(() => {
    const dimsGroup = engineRef.current.dims;
    if (dimsGroup) dimsGroup.visible = dims;
  }, [dims]);
  useEffect(() => {
    engineRef.current.planOpen = planOpen;
    if (planOpen) {
      drawPlan(floor);
      engineRef.current.updateCamMarker?.();
    }
  }, [planOpen]);
  useEffect(() => {
    if (planOpen) drawPlan(floor);
  }, [floor]);

  // 点击平面 → 飞行
  function handlePlanClick(e: MouseEvent) {
    const engine = engineRef.current;
    if (!engine.planSvgEl || !planOpen) return;
    const r = (engine.planSvgEl as SVGSVGElement).getBoundingClientRect();
    const vx = (e.clientX - r.left) / r.width * 440;
    const vy = (e.clientY - r.top) / r.height * 440;
    engine.flyToPoint?.(vx / PM + PX0, vy / PM + PZ0);
  }

  /* ============ 平面图面板拖拽（Pointer 事件, 兼容鼠标/触屏） ============ */
  function onPlanDragStart(e: PointerEvent) {
    if (e.button !== 0) return;                       // 仅左键
    if ((e.target as HTMLElement).closest('.plan-close')) return;  // 关闭按钮不触发拖拽
    const panel = planPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    planDragRef.current = { sx: e.clientX, sy: e.clientY, bx: rect.left, by: rect.top, w: rect.width, h: rect.height };
    e.preventDefault();                               // 防止拖拽时选中文本
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = planDragRef.current;
      if (!d) return;
      // 限制在视口范围内
      const x = Math.min(Math.max(d.bx + e.clientX - d.sx, 0), innerWidth - d.w);
      const y = Math.min(Math.max(d.by + e.clientY - d.sy, 0), innerHeight - d.h);
      setPlanPos({ x, y, w: d.w });
    }
    function onUp() { planDragRef.current = null; }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return <div className={ 'villa-wrap' + (night ? ' night' : '') }>
    <div className="villa-scene" ref={ sceneRef } />
    <div className="vignette" />

    {/* 标题卡 */}
    <div className="card title-card">
      <div className="title-col">
        <div className="title-vert">白墙木影</div>
        <div className="seal">宅</div>
      </div>
      <div className="meta">
        <h2>农村自建别墅 · 概念预览</h2>
        <div className="sub">临路地块 20 m × 15 m · 两层半 · 双坡屋顶</div>
        <div className="facts">
          <div>宅基地<b>300 ㎡</b></div>
          <div>总建筑面积<b>≈390 ㎡</b></div>
          <div>屋脊高<b>8.8 m</b></div>
        </div>
      </div>
    </div>

    {/* 指标面板 */}
    <div className={ 'card panel' + (collapsed ? ' collapsed' : '') }>
      <div className="panel-head" onClick={ () => setCollapsed(!collapsed) }>
        <h3>方案指标</h3><span className="chev">▾</span>
      </div>
      <div className="panel-body">
        <div className="row"><span className="k">宅基地</span><span className="v"><em>20 × 15</em> m · <em>300</em> ㎡</span></div>
        <div className="row"><span className="k">建筑基底</span><span className="v"><em>15 × 10</em> m · <em>150</em> ㎡</span></div>
        <div className="row"><span className="k">总建筑面积</span><span className="v">≈ <em>390</em> ㎡（含阁楼）</span></div>
        <div className="row"><span className="k">层数 / 高度</span><span className="v">2 层 + 阁楼 · 脊高 <em>8.8</em> m</span></div>
        <div className="row"><span className="k">屋面</span><span className="v">双坡顶 · 深灰金属瓦 · 挑檐 <em>0.7</em> m</span></div>
        <div className="row"><span className="k">立面</span><span className="v">暖白墙身 · 木格栅 · 木纹山墙</span></div>
        <div className="row"><span className="k">一层</span><span className="v">客厅 · 餐厨 · 老人房 · 卫</span></div>
        <div className="row"><span className="k">二层</span><span className="v">主卧套间 · 两卧 · 南向阳台</span></div>
        <div className="row"><span className="k">阁楼</span><span className="v">书房 / 多功能 · 天窗采光</span></div>
        <div className="row"><span className="k">前院</span><span className="v">硬化晒场 · 停车 · 晾晒</span></div>
        <div className="panel-note">概念方案：面宽与进深、开间划分、结构选型可在此基础上继续深化；南侧临路为晒场，采光晾晒两宜。</div>
      </div>
    </div>

    {/* 控制条 */}
    <div className="card dock">
      <div className="seg">
        { Object.keys(VIEWS).map(v => (
          <button key={ v } className={ view === v ? 'active' : '' } onClick={ () => setView(v) }>{ VIEW_NAMES[v] }</button>
        )) }
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={ rotate ? 'true' : 'false' } onClick={ () => setRotate(!rotate) }>自动环游</button>
        <button className="chip" aria-pressed={ night ? 'true' : 'false' } onClick={ () => setNight(!night) }>夜景</button>
        <button className="chip" aria-pressed={ dims ? 'true' : 'false' } onClick={ () => setDims(!dims) }>尺寸标注</button>
        <button className="chip" aria-pressed={ planOpen ? 'true' : 'false' } onClick={ () => setPlanOpen(!planOpen) }>平面图</button>
        <button className="chip" onClick={ () => route('/webitem') }>返回</button>
      </div>
    </div>

    <div className="hint">拖拽旋转 · 滚轮缩放 · 右键平移</div>

    {/* 平面图面板 · 双视图联动 */}
    <aside
      className="card plan-panel"
      ref={ planPanelRef }
      hidden={ !planOpen }
      style={ planPos ? { left: `${planPos.x}px`, top: `${planPos.y}px`, width: `${planPos.w}px`, right: 'auto', bottom: 'auto' } : undefined }
    >
      <div className="plan-head" onPointerDown={ onPlanDragStart }>
        <div>
          <div className="plan-title">室内平面 · 双视图联动</div>
          <div className="plan-sub">{ planSub }</div>
        </div>
        <button className="plan-close" aria-label="关闭平面图" onClick={ () => { setPlanOpen(false); setPlanPos(null); } }>×</button>
      </div>
      <div className="plan-tabs">
        <button className={ 'ptab' + (floor === 'f1' ? ' active' : '') } onClick={ () => setFloor('f1') }>一层</button>
        <button className={ 'ptab' + (floor === 'f2' ? ' active' : '') } onClick={ () => setFloor('f2') }>二层</button>
        <button className={ 'ptab' + (floor === 'f3' ? ' active' : '') } onClick={ () => setFloor('f3') }>阁楼</button>
      </div>
      <div className="plan-body" ref={ planBodyRef } onClick={ handlePlanClick } />
      <div className="plan-legend">
        <span><i className="sw sw-void"></i>挑空 / 上空</span>
        <span><i className="sw sw-master"></i>主卧套间</span>
        <span><i className="cam-dot"></i>相机视线 · 点击平面飞行</span>
      </div>
    </aside>

    {/* 加载层 */}
    { !loaderGone && <div className={ 'villa-loader' + (ready ? ' hide' : '') }>
      <div className="loader-inner">
        <div className="seal">宅</div>
        <div className="loader-text">正在搭建模型</div>
      </div>
    </div> }
  </div>
}
