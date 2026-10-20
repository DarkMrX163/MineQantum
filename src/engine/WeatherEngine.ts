import * as THREE from "three";
import { sound } from "./AudioEngine";

export type WeatherType = "sunny" | "rain" | "thunderstorm" | "snow";

export class WeatherEngine {
  public currentWeather: WeatherType = "sunny";
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Particle systems
  private rainParticles?: THREE.Points;
  private snowParticles?: THREE.Points;
  private rainCount = 1800;
  private snowCount = 1200;

  private rainPositions!: Float32Array;
  private snowPositions!: Float32Array;

  // Lightning state
  public isLightningActive: boolean = false;
  private lightningTimer: number = 0;
  public lightningFlashIntensity: number = 0;

  // Weather transition timer
  private weatherTimer: number = 0;
  private weatherDuration: number = 180; // Changes weather every 3 mins

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    this.initRain();
    this.initSnow();
  }

  private initRain(): void {
    const geo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.rainPositions[i * 3 + 1] = Math.random() * 40;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }

    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.rainPositions, 3),
    );

    const mat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.28,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    this.rainParticles = new THREE.Points(geo, mat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  private initSnow(): void {
    const geo = new THREE.BufferGeometry();
    this.snowPositions = new Float32Array(this.snowCount * 3);

    for (let i = 0; i < this.snowCount; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.snowPositions[i * 3 + 1] = Math.random() * 35;
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }

    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.snowPositions, 3),
    );

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
    });

    this.snowParticles = new THREE.Points(geo, mat);
    this.snowParticles.visible = false;
    this.scene.add(this.snowParticles);
  }

  public onWeatherChange?: (type: WeatherType) => void;

  public setWeather(type: WeatherType): void {
    if (this.currentWeather !== type) {
      this.currentWeather = type;
      if (this.rainParticles)
        this.rainParticles.visible = type === "rain" || type === "thunderstorm";
      if (this.snowParticles) this.snowParticles.visible = type === "snow";
      this.onWeatherChange?.(type);
    }
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    this.weatherTimer += dt;
    if (this.weatherTimer >= this.weatherDuration) {
      this.weatherTimer = 0;
      const weathers: WeatherType[] = [
        "sunny",
        "sunny",
        "rain",
        "thunderstorm",
        "snow",
      ];
      const nextW = weathers[Math.floor(Math.random() * weathers.length)];
      this.setWeather(nextW);
    }

    // Update Rain Particles around player
    if (
      (this.currentWeather === "rain" ||
        this.currentWeather === "thunderstorm") &&
      this.rainParticles
    ) {
      this.rainParticles.position.copy(playerPos);
      const posAttr = this.rainParticles.geometry.attributes
        .position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < this.rainCount; i++) {
        arr[i * 3 + 1] -= dt * 38; // Rain speed
        if (arr[i * 3 + 1] < -10) {
          arr[i * 3 + 1] = 30 + Math.random() * 10;
          arr[i * 3] = (Math.random() - 0.5) * 60;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Update Snow Particles around player
    if (this.currentWeather === "snow" && this.snowParticles) {
      this.snowParticles.position.copy(playerPos);
      const posAttr = this.snowParticles.geometry.attributes
        .position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < this.snowCount; i++) {
        arr[i * 3 + 1] -= dt * 4.5; // Slow gentle snow sway
        arr[i * 3] += Math.sin(arr[i * 3 + 1] * 0.2 + i) * dt * 1.5;

        if (arr[i * 3 + 1] < -10) {
          arr[i * 3 + 1] = 25 + Math.random() * 10;
          arr[i * 3] = (Math.random() - 0.5) * 60;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Thunderstorm Lightning Flash Logic
    if (this.currentWeather === "thunderstorm") {
      this.lightningTimer += dt;
      if (this.lightningTimer > 8 + Math.random() * 12) {
        this.lightningTimer = 0;
        this.isLightningActive = true;
        this.lightningFlashIntensity = 1.0;
        sound.playBlockBreak(); // Thunder crack
      }

      if (this.isLightningActive) {
        this.lightningFlashIntensity -= dt * 3.5;
        if (this.lightningFlashIntensity <= 0) {
          this.lightningFlashIntensity = 0;
          this.isLightningActive = false;
        }
      }
    } else {
      this.lightningFlashIntensity = 0;
      this.isLightningActive = false;
    }
  }
}
