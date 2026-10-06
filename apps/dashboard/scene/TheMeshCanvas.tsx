'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

// 3D Vault in the center
function VaultNode({ balance = 1000, shockwave = false }: { balance?: number; shockwave?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
    }
    if (ringRef.current && shockwave) {
      ringRef.current.scale.addScalar(delta * 4);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Central Vault Glass Cube */}
      <mesh ref={meshRef}>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
        <meshPhysicalMaterial
          color="#836EF9"
          transmission={0.8}
          opacity={1}
          transparent
          roughness={0.15}
          ior={1.5}
          thickness={1.2}
          emissive="#5c35f5"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Internal Liquid Core */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[1.8, 1.2, 1.8]} />
        <meshStandardMaterial color="#836EF9" emissive="#836EF9" emissiveIntensity={0.8} />
      </mesh>

      {/* Shockwave for Rejections */}
      {shockwave && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.8, 32]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}

      <Text position={[0, 2.0, 0]} fontSize={0.35} color="#c4b5fd" anchorX="center" anchorY="middle">
        {`SpendGuard Vault: $${balance.toFixed(2)}`}
      </Text>
    </group>
  );
}

// Buyer Agent Node (Left Arc)
function BuyerNode({ position, label, tier }: { position: [number, number, number]; label: string; tier: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.9}
          roughness={0.2}
        />
      </mesh>
      <Text position={[0, -1.0, 0]} fontSize={0.25} color="#e0f2fe" anchorX="center">
        {`${label} (${tier})`}
      </Text>
    </group>
  );
}

// Seller Node (Right Arc)
function SellerNode({ position, label, price }: { position: [number, number, number]; label: string; price: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.5;
      ref.current.rotation.x += delta * 0.3;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial
          color="#34d399"
          emissive="#059669"
          emissiveIntensity={0.8}
          roughness={0.1}
          wireframe={false}
        />
      </mesh>
      <Text position={[0, -1.1, 0]} fontSize={0.25} color="#a7f3d0" anchorX="center">
        {`${label} ($${price})`}
      </Text>
    </group>
  );
}

// Connecting Channel Tube with moving particle
function ChannelLink({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const particleRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const p1 = new THREE.Vector3(...start);
    const p2 = new THREE.Vector3(...end);
    const mid = p1.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, 0.8, 0));
    return new THREE.QuadraticBezierCurve3(p1, mid, p2);
  }, [start, end]);

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 20, 0.04, 8, false);
  }, [curve]);

  useFrame(({ clock }) => {
    if (particleRef.current) {
      const t = (clock.getElapsedTime() * 0.8) % 1;
      const point = curve.getPoint(t);
      particleRef.current.position.copy(point);
    }
  });

  return (
    <group>
      {/* Curved Tube */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color="#6366f1" transparent opacity={0.35} />
      </mesh>

      {/* Moving Payment Voucher Particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

export default function TheMeshCanvas({
  shockwave = false,
  is2D = false,
}: {
  shockwave?: boolean;
  is2D?: boolean;
}) {
  if (is2D) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#090a12] p-8 border border-monad-900/60 rounded-xl">
        <div className="w-full max-w-2xl grid grid-cols-3 gap-6 items-center text-center">
          {/* Buyers */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold text-sky-400 tracking-wider">Buyer Swarm</h3>
            <div className="p-3 bg-sky-950/40 border border-sky-800/50 rounded-lg">
              <div className="text-sm font-semibold text-white">Tier A Buyer</div>
              <div className="text-xs text-sky-300">Deterministic / 0% LLM</div>
            </div>
            <div className="p-3 bg-sky-950/40 border border-sky-800/50 rounded-lg">
              <div className="text-sm font-semibold text-white">Tier B Planner</div>
              <div className="text-xs text-sky-300">Procurement / 5% LLM</div>
            </div>
            <div className="p-3 bg-sky-950/40 border border-sky-800/50 rounded-lg">
              <div className="text-sm font-semibold text-white">Tier C Autonomous</div>
              <div className="text-xs text-sky-300">Tool Calling / Defense Target</div>
            </div>
          </div>

          {/* Center SpendGuard */}
          <div className="flex flex-col items-center">
            <div className={`w-32 h-32 rounded-2xl flex flex-col items-center justify-center border-2 ${shockwave ? 'border-red-500 bg-red-950/40 animate-pulse' : 'border-monad-500 bg-monad-950/60'}`}>
              <div className="text-2xl font-black text-monad-500">🛡️</div>
              <div className="text-xs font-bold text-white mt-1">SpendGuard</div>
              <div className="text-[10px] text-monad-300">$1,000.00 Vault</div>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Monad Testnet (10143)</div>
          </div>

          {/* Sellers */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Sellers (402)</h3>
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg">
              <div className="text-sm font-semibold text-white">DataSeller</div>
              <div className="text-xs text-emerald-300">$0.0001 / sentiment call</div>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg">
              <div className="text-sm font-semibold text-white">SummarizerSeller</div>
              <div className="text-xs text-emerald-300">$0.001 / AI summary call</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-gradient-to-b from-[#090a12] via-[#0d0e1a] to-[#090a12] rounded-xl overflow-hidden border border-monad-900/60">
      <Canvas camera={{ position: [0, 2, 8.5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <OrbitControls enablePan={true} enableZoom={true} maxPolarAngle={Math.PI / 2 + 0.1} minDistance={4} maxDistance={15} />

        {/* Center Vault */}
        <VaultNode balance={1000} shockwave={shockwave} />

        {/* Left Buyers Arc */}
        <BuyerNode position={[-4.2, 1.4, 0]} label="Buyer Tier A" tier="Fast" />
        <BuyerNode position={[-4.5, 0, 0]} label="Buyer Tier B" tier="Planner" />
        <BuyerNode position={[-4.2, -1.4, 0]} label="Buyer Tier C" tier="Tools" />

        {/* Right Sellers Arc */}
        <SellerNode position={[4.2, 1.2, 0]} label="DataSeller" price="0.0001" />
        <SellerNode position={[4.2, -1.2, 0]} label="Summarizer" price="0.001" />

        {/* Active Payment Channel Tubes */}
        <ChannelLink start={[-4.2, 1.4, 0]} end={[0, 0, 0]} />
        <ChannelLink start={[0, 0, 0]} end={[4.2, 1.2, 0]} />
        <ChannelLink start={[-4.2, -1.4, 0]} end={[0, 0, 0]} />
        <ChannelLink start={[0, 0, 0]} end={[4.2, -1.2, 0]} />
      </Canvas>

      {/* Floating Mode Tag */}
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[11px] font-mono text-monad-400 border border-monad-900">
        Three.js R3F Canvas • Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
