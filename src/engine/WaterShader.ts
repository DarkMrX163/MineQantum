import * as THREE from 'three';

const vertexShader = `
  uniform float u_time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normal;

    vec3 pos = position;

    // Displace top surface vertices along animated sine waves for water ripple effect
    if (normal.y > 0.5) {
      float wave1 = sin(pos.x * 2.5 + u_time * 3.0) * 0.08;
      float wave2 = cos(pos.z * 2.5 + u_time * 2.5) * 0.08;
      pos.y += wave1 + wave2;
    }

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform sampler2D u_map;
  uniform float u_time;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Sample texture atlas tile for water
    vec4 texColor = texture2D(u_map, vUv);

    // Dynamic water color tint with specular shimmer
    vec3 waterBlue = vec3(0.18, 0.52, 0.88);

    // Subtle animated water caustics
    float shimmer = sin(vWorldPosition.x * 3.0 + vWorldPosition.z * 3.0 + u_time * 4.0) * 0.08;
    vec3 finalColor = mix(waterBlue, texColor.rgb, 0.3) + vec3(shimmer);

    // Semi-transparency (opacity: 0.6)
    gl_FragColor = vec4(finalColor, 0.62);
  }
`;

/**
 * Creates custom ShaderMaterial for animated water with sine wave vertex displacement and 0.6 opacity
 */
export function createWaterShaderMaterial(atlasTexture: THREE.CanvasTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      u_map: { value: atlasTexture },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
