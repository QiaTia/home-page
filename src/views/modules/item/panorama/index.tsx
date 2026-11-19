import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from '@/layout/hash-router';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import notify from '@/utils/notify';
import './index.less';

/** 初始经纬度与视场角 */
const INIT_LON = 90;
const INIT_LAT = 0;
const INIT_FOV = 55;
/** 画面默认包裹的水平视角(手机全景照约120°-150°, 非完整360°) */
const INIT_HFOV = 130;
/** 纹理加载前的宽高比兜底值(14096/3744) */
const FALLBACK_ASPECT = 3.76;
/** 圆柱屏幕半径 */
const R = 500;

/** 陀螺仪朝向计算所需的常量 */
const ZEE = new THREE.Vector3(0, 0, 1);
const EULER = new THREE.Euler();
const Q0 = new THREE.Quaternion();
/** 绕 X 轴 -90° 的矫正四元数 */
const Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export default function () {
  const wrapRef = useRef<HTMLDivElement>(null);
  const vrBtnWrapRef = useRef<HTMLDivElement>(null);
  /** 陀螺仪开关与启用函数解耦, 避免闭包引用过期状态 */
  const gyroRef = useRef(false);
  const gyroBtnRef = useRef<() => void>(() => {});
  /** 视角状态供重置按钮使用 */
  const viewRef = useRef({ lon: INIT_LON, lat: INIT_LAT });
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  /** 重建圆柱屏幕(弧度调整) */
  const rebuildRef = useRef<(deg: number) => void>(() => {});

  const [loading, setLoading] = useState(true);
  const [gyroOn, setGyroOn] = useState(false);
  const [hFov, setHFov] = useState(INIT_HFOV);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const disposers: (() => void)[] = [];

    /* ============ 场景 ============ */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(INIT_FOV, wrap.clientWidth / wrap.clientHeight, 1, 1200);
    camera.position.set(0, 0, 0.01);
    camRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.xr.enabled = true;
    wrap.querySelector('.pano-stage')!.appendChild(renderer.domElement);

    /* ============ 全景纹理 ============ */
    const texture = new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}panorama.jpg`,
      (t) => {
        setLoading(false);
        // 按照片实际宽高比重建屏幕
        if (t.image && (t.image as HTMLImageElement).width) {
          photoAspect = (t.image as HTMLImageElement).width / (t.image as HTMLImageElement).height;
          buildScreen(curHfov);
        }
      },
      undefined,
      () => {
        setLoading(false);
        notify({ title: '全景图加载失败', icon: 'error' });
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    // 圆柱内壁视角下面片 u 方向与视线左右相反, 翻转纹理避免画面镜像
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });

    /* ============ 圆柱弧形屏幕 ============ */
    let photoAspect = FALLBACK_ASPECT;
    let curHfov = INIT_HFOV;
    /** 屏幕角度范围, 供视角钳制使用 */
    const screenRange = { hFovDeg: INIT_HFOV, vHalfDeg: 20 };
    let screenMesh: THREE.Mesh | null = null;

    /** 按包裹视角构建圆柱面: 弧宽 = R·θ, 高 = 弧宽/宽高比, 保持照片原始比例 */
    function buildScreen(hFovDeg: number) {
      curHfov = hFovDeg;
      const hFovRad = THREE.MathUtils.degToRad(hFovDeg);
      const height = (R * hFovRad) / photoAspect;
      screenRange.hFovDeg = hFovDeg;
      screenRange.vHalfDeg = THREE.MathUtils.radToDeg(Math.atan(height / 2 / R));
      const geo = new THREE.CylinderGeometry(R, R, height, 128, 1, true, -hFovRad / 2, hFovRad);
      if (screenMesh) {
        screenMesh.geometry.dispose();
        screenMesh.geometry = geo;
      } else {
        screenMesh = new THREE.Mesh(geo, material);
        scene.add(screenMesh);
      }
    }
    buildScreen(INIT_HFOV);
    rebuildRef.current = buildScreen;

    /* ============ 拖拽环视 (经纬度, 钳制在画面范围内) ============ */
    const view = viewRef.current;
    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let startLon = 0;
    let startLat = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (gyroRef.current) return;
      pointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
      startLon = view.lon;
      startLat = view.lat;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown || gyroRef.current) return;
      const lonRange = screenRange.hFovDeg / 2;
      const latRange = screenRange.vHalfDeg + 15;
      view.lon = clamp(startLon - (e.clientX - startX) * 0.12, INIT_LON - lonRange, INIT_LON + lonRange);
      view.lat = clamp(startLat + (e.clientY - startY) * 0.12, -latRange, latRange);
    };
    const onPointerUp = (e: PointerEvent) => {
      pointerDown = false;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    };
    /** 滚轮调整视场角模拟缩放 */
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.fov = clamp(camera.fov + e.deltaY * 0.05, 25, 100);
      camera.updateProjectionMatrix();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    disposers.push(() => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
    });

    /* ============ 陀螺仪模式 ============ */
    const deviceOrient = { alpha: 0, beta: 0, gamma: 0, screen: 0 };
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      deviceOrient.alpha = e.alpha ?? 0;
      deviceOrient.beta = e.beta ?? 0;
      deviceOrient.gamma = e.gamma ?? 0;
      const so = screen.orientation?.angle ?? (window as any).orientation ?? 0;
      deviceOrient.screen = THREE.MathUtils.degToRad(so);
    };
    gyroBtnRef.current = async () => {
      if (gyroRef.current) {
        gyroRef.current = false;
        window.removeEventListener('deviceorientation', onDeviceOrientation);
        setGyroOn(false);
        return;
      }
      const DOE = window.DeviceOrientationEvent as any;
      // iOS 13+ 需要在用户手势中申请权限
      if (DOE && typeof DOE.requestPermission === 'function') {
        try {
          const res = await DOE.requestPermission();
          if (res !== 'granted') {
            notify({ title: '未授予陀螺仪权限', icon: 'warn' });
            return;
          }
        } catch {
          notify({ title: '陀螺仪权限申请失败', icon: 'error' });
          return;
        }
      } else if (!DOE) {
        notify({ title: '当前设备不支持陀螺仪', icon: 'warn' });
        return;
      }
      gyroRef.current = true;
      window.addEventListener('deviceorientation', onDeviceOrientation);
      setGyroOn(true);
    };
    disposers.push(() => window.removeEventListener('deviceorientation', onDeviceOrientation));

    /* ============ VR 模式 (WebXR) ============ */
    const vrButton = VRButton.createButton(renderer);
    vrBtnWrapRef.current!.appendChild(vrButton);
    disposers.push(() => vrButton.remove());

    /* ============ 渲染循环 ============ */
    const dir = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      if (gyroRef.current) {
        EULER.set(
          THREE.MathUtils.degToRad(deviceOrient.beta),
          THREE.MathUtils.degToRad(deviceOrient.alpha),
          -THREE.MathUtils.degToRad(deviceOrient.gamma),
          'YXZ'
        );
        camera.quaternion.setFromEuler(EULER);
        camera.quaternion.multiply(Q1);
        camera.quaternion.multiply(Q0.setFromAxisAngle(ZEE, -deviceOrient.screen));
      } else {
        const phi = THREE.MathUtils.degToRad(90 - view.lat);
        const theta = THREE.MathUtils.degToRad(view.lon);
        dir.set(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        ).add(camera.position);
        camera.lookAt(dir);
      }
      renderer.render(scene, camera);
    });

    /* ============ 尺寸自适应 ============ */
    const onResize = () => {
      camera.aspect = wrap.clientWidth / wrap.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    };
    window.addEventListener('resize', onResize);
    disposers.push(() => window.removeEventListener('resize', onResize));

    return () => {
      renderer.setAnimationLoop(null);
      disposers.forEach((d) => d());
      screenMesh?.geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      camRef.current = null;
    };
  }, []);

  /** 重置视角: 经纬度与视场角恢复初始值 */
  const resetView = () => {
    viewRef.current.lon = INIT_LON;
    viewRef.current.lat = INIT_LAT;
    const camera = camRef.current;
    if (camera) {
      camera.fov = INIT_FOV;
      camera.updateProjectionMatrix();
    }
  };

  /** 调整画面包裹视角, 实时重建弧形屏幕 */
  const handleFovChange = (e: Event) => {
    const deg = Number((e.target as HTMLInputElement).value);
    setHFov(deg);
    rebuildRef.current?.(deg);
  };

  return (
    <div className="pano-wrap" ref={wrapRef}>
      <div className="pano-stage" />

      <div className="pano-title">
        <span className="pano-title-text">全景 · Panorama</span>
        <span className="pano-title-sub">拖拽环视 · 滚轮缩放 · 支持陀螺仪 / VR</span>
      </div>

      <button className="pano-back" onClick={() => route('/webitem')}>
        返回
      </button>

      <div className="pano-toolbar">
        <div className="pano-vr-btn" ref={vrBtnWrapRef} />
        <button className={`pano-btn ${gyroOn ? 'active' : ''}`} onClick={() => gyroBtnRef.current?.()}>
          陀螺仪
        </button>
        <button className="pano-btn" onClick={resetView}>
          重置视角
        </button>
        <div className="pano-fov">
          <span className="pano-fov-label">画面视角 {hFov}°</span>
          <input
            type="range"
            min={90}
            max={240}
            step={5}
            value={hFov}
            onInput={handleFovChange}
          />
        </div>
      </div>

      {loading && (
        <div className="pano-loading">
          <div className="pano-loading-spin" />
          <span>全景图加载中…</span>
        </div>
      )}
    </div>
  );
}
