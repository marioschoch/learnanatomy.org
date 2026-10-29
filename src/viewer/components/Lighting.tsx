/**
 * Soft studio lighting: a procedural room environment (no network, PMREM once) for gentle specular shape,
 * a hemisphere fill, and key + fill lights that follow the camera (key upper left, fill lower right), so
 * structures are lit the same from every side the student orbits to.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, Vector3 } from 'three';
import type { DirectionalLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const _right = new Vector3();
const _up = new Vector3();
const _fwd = new Vector3();

export function Lighting() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.22;
    return () => {
      if (scene.environment === env) scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);

  useFrame(({ camera }) => {
    const l = key.current;
    if (!l) return;
    camera.matrixWorld.extractBasis(_right, _up, _fwd);
    // _fwd is the camera's +Z (pointing backwards); the light sits behind-left-above the viewer.
    // Key light from the upper left of the view: enough angle to model bone surfaces, never from behind.
    l.position
      .copy(camera.position)
      .addScaledVector(_right, -2.4)
      .addScaledVector(_up, 2.2)
      .addScaledVector(_fwd, 0.2);
    l.target.position.copy(camera.position).addScaledVector(_fwd, -3);
    l.target.updateMatrixWorld();
    const f = fill.current;
    if (f) {
      f.position.copy(camera.position).addScaledVector(_right, 1.5).addScaledVector(_up, -0.4);
      f.target.position.copy(l.target.position);
      f.target.updateMatrixWorld();
    }
  }, -0.9);

  return (
    <>
      <hemisphereLight args={['#f4f6ff', '#3d3631', 0.65]} />
      <directionalLight ref={key} intensity={3.1} color="#fff8ee" />
      <directionalLight ref={fill} intensity={0.7} color="#e8eeff" />
    </>
  );
}
