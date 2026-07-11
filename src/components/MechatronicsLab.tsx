import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, Zap, Settings, Activity, Code, AlertTriangle, Play, Pause, RotateCcw, 
  HelpCircle, ChevronRight, Check, Sparkles, Terminal, Minimize2, Wrench, ShieldAlert
} from 'lucide-react';

interface Pin {
  id: string;
  num: number;
  label: string;
  functions: string[];
  type?: 'power' | 'ground' | 'gpio' | 'analog' | 'special';
}

const MCU_DATA = {
  esp32: {
    name: 'ESP32 (NodeMCU-WROOM)',
    description: 'Powerful Dual-Core microcontroller with integrated Wi-Fi + Bluetooth mechatronics capabilities, optimal for IoT robots.',
    pins: [
      { id: '3v3', num: 1, label: '3V3', functions: ['3.3V Power Output'], type: 'power' },
      { id: 'en', num: 2, label: 'EN', functions: ['Chip Enable', 'Reset Pin'], type: 'special' },
      { id: 'vp', num: 3, label: 'SENSOR_VP (GPIO36)', functions: ['ADC1_CH0', 'RTC_GPIO36'], type: 'analog' },
      { id: 'vn', num: 4, label: 'SENSOR_VN (GPIO39)', functions: ['ADC1_CH3', 'RTC_GPIO39'], type: 'analog' },
      { id: 'g34', num: 5, label: 'GPIO34', functions: ['ADC1_CH6', 'RTC_GPIO34', 'Input Only'], type: 'analog' },
      { id: 'g35', num: 6, label: 'GPIO35', functions: ['ADC1_CH7', 'RTC_GPIO35', 'Input Only'], type: 'analog' },
      { id: 'g32', num: 7, label: 'GPIO32', functions: ['ADC1_CH4', 'TOUCH9', 'RTC_GPIO32'], type: 'gpio' },
      { id: 'g33', num: 8, label: 'GPIO33', functions: ['ADC1_CH5', 'TOUCH8', 'RTC_GPIO33'], type: 'gpio' },
      { id: 'g25', num: 9, label: 'GPIO25', functions: ['DAC1', 'ADC2_CH8', 'RTC_GPIO25'], type: 'analog' },
      { id: 'g26', num: 10, label: 'GPIO26', functions: ['DAC2', 'ADC2_CH9', 'RTC_GPIO26'], type: 'analog' },
      { id: 'g27', num: 11, label: 'GPIO27', functions: ['ADC2_CH7', 'TOUCH7', 'RTC_GPIO27'], type: 'gpio' },
      { id: 'g14', num: 12, label: 'GPIO14', functions: ['ADC2_CH6', 'TOUCH6', 'RTC_GPIO14', 'HSPI_CLK'], type: 'gpio' },
      { id: 'g12', num: 13, label: 'GPIO12', functions: ['ADC2_CH5', 'TOUCH5', 'RTC_GPIO12', 'HSPI_MISO'], type: 'gpio' },
      { id: 'g13', num: 14, label: 'GPIO13', functions: ['ADC2_CH4', 'TOUCH4', 'RTC_GPIO13', 'HSPI_MOSI'], type: 'gpio' },
      { id: 'gnd1', num: 15, label: 'GND', functions: ['Ground'], type: 'ground' },
      { id: 'g15', num: 16, label: 'GPIO15', functions: ['ADC2_CH3', 'TOUCH3', 'RTC_GPIO15', 'HSPI_CS'], type: 'gpio' },
      { id: 'g2', num: 17, label: 'GPIO2', functions: ['ADC2_CH2', 'TOUCH2', 'RTC_GPIO2', 'Onboard LED'], type: 'gpio' },
      { id: 'g4', num: 18, label: 'GPIO4', functions: ['ADC2_CH0', 'TOUCH0', 'RTC_GPIO4'], type: 'gpio' },
      { id: 'g16', num: 19, label: 'GPIO16', functions: ['UART2_RXD'], type: 'special' },
      { id: 'g17', num: 20, label: 'GPIO17', functions: ['UART2_TXD'], type: 'special' },
      { id: 'g5', num: 21, label: 'GPIO5', functions: ['VSPI_CS0'], type: 'gpio' },
      { id: 'g18', num: 22, label: 'GPIO18', functions: ['VSPI_CLK'], type: 'gpio' },
      { id: 'g19', num: 23, label: 'GPIO19', functions: ['VSPI_MISO'], type: 'gpio' },
      { id: 'g21', num: 24, label: 'GPIO21', functions: ['I2C_SDA'], type: 'special' },
      { id: 'g22', num: 25, label: 'GPIO22', functions: ['I2C_SCL'], type: 'special' },
      { id: 'g23', num: 26, label: 'GPIO23', functions: ['VSPI_MOSI'], type: 'gpio' },
    ] as Pin[]
  },
  arduino_uno: {
    name: 'Arduino Uno R3',
    description: 'The standard mechatronics beginner microcontroller, powered by ATmega328P. Reliable GPIO logic levels.',
    pins: [
      { id: 'reset', num: 1, label: 'RESET', functions: ['Reset Microcontroller'], type: 'special' },
      { id: '3v3', num: 2, label: '3.3V', functions: ['3.3V Output'], type: 'power' },
      { id: '5v', num: 3, label: '5V', functions: ['5V Output / Input Input'], type: 'power' },
      { id: 'gnd', num: 4, label: 'GND', functions: ['Ground Connection'], type: 'ground' },
      { id: 'vin', num: 5, label: 'VIN', functions: ['Voltage Input (7-12V)'], type: 'power' },
      { id: 'a0', num: 6, label: 'A0 (PC0)', functions: ['Analog Input 0', 'ADC0'], type: 'analog' },
      { id: 'a1', num: 7, label: 'A1 (PC1)', functions: ['Analog Input 1', 'ADC1'], type: 'analog' },
      { id: 'a2', num: 8, label: 'A2 (PC2)', functions: ['Analog Input 2', 'ADC2'], type: 'analog' },
      { id: 'a3', num: 9, label: 'A3 (PC3)', functions: ['Analog Input 3', 'ADC3'], type: 'analog' },
      { id: 'a4', num: 10, label: 'A4 (PC4)', functions: ['Analog Input 4', 'ADC4', 'I2C SDA'], type: 'analog' },
      { id: 'a5', num: 11, label: 'A5 (PC5)', functions: ['Analog Input 5', 'ADC5', 'I2C SCL'], type: 'analog' },
      { id: 'd0', num: 12, label: 'D0 (RX)', functions: ['Digital GPIO', 'Serial RX'], type: 'special' },
      { id: 'd1', num: 13, label: 'D1 (TX)', functions: ['Digital GPIO', 'Serial TX'], type: 'special' },
      { id: 'd2', num: 14, label: 'D2_INT', functions: ['Digital GPIO', 'External Interrupt 0'], type: 'gpio' },
      { id: 'd3', num: 15, label: 'D3_PWM', functions: ['Digital GPIO', 'PWM Output', 'Interrupt 1'], type: 'gpio' },
      { id: 'd4', num: 16, label: 'D4', functions: ['Digital GPIO'], type: 'gpio' },
      { id: 'd5', num: 17, label: 'D5_PWM', functions: ['Digital GPIO', 'PWM Output'], type: 'gpio' },
      { id: 'd6', num: 18, label: 'D6_PWM', functions: ['Digital GPIO', 'PWM Output'], type: 'gpio' },
      { id: 'd7', num: 19, label: 'D7', functions: ['Digital GPIO'], type: 'gpio' },
      { id: 'd8', num: 20, label: 'D8', functions: ['Digital GPIO'], type: 'gpio' },
      { id: 'd9', num: 21, label: 'D9_PWM', functions: ['Digital GPIO', 'PWM Output'], type: 'gpio' },
      { id: 'd10', num: 22, label: 'D10_SS', functions: ['Digital GPIO', 'PWM Output', 'SPI SS'], type: 'gpio' },
      { id: 'd11', num: 23, label: 'D11_MOSI', functions: ['Digital GPIO', 'PWM Output', 'SPI MOSI'], type: 'gpio' },
      { id: 'd12', num: 24, label: 'D12_MISO', functions: ['Digital GPIO', 'SPI MISO'], type: 'gpio' },
      { id: 'd13', num: 25, label: 'D13_SCK', functions: ['Digital GPIO', 'SPI SCK', 'Onboard LED'], type: 'gpio' },
    ] as Pin[]
  },
  pi_pico: {
    name: 'Raspberry Pi Pico',
    description: 'High-performance RP2040 chip with dual ARM Cortex-M0+ cores. Exceptional PIO (Programmable I/O) blocks for sensor timing.',
    pins: [
      { id: 'gp0', num: 1, label: 'GP0 (UART0_TX)', functions: ['GPIO', 'I2C0_SDA', 'SPI0_RX'], type: 'gpio' },
      { id: 'gp1', num: 2, label: 'GP1 (UART0_RX)', functions: ['GPIO', 'I2C0_SCL', 'SPI0_CSN'], type: 'gpio' },
      { id: 'gnd1', num: 3, label: 'GND', functions: ['Ground'], type: 'ground' },
      { id: 'gp2', num: 4, label: 'GP2', functions: ['GPIO', 'I2C1_SDA', 'SPI0_SCK'], type: 'gpio' },
      { id: 'gp3', num: 5, label: 'GP3', functions: ['GPIO', 'I2C1_SCL', 'SPI0_TX'], type: 'gpio' },
      { id: 'gp4', num: 6, label: 'GP4', functions: ['GPIO', 'I2C0_SDA', 'SPI1_RX'], type: 'gpio' },
      { id: 'gp5', num: 7, label: 'GP5', functions: ['GPIO', 'I2C0_SCL', 'SPI1_CSN'], type: 'gpio' },
      { id: 'gnd2', num: 8, label: 'GND', functions: ['Ground'], type: 'ground' },
      { id: 'gp6', num: 9, label: 'GP6', functions: ['GPIO', 'I2C1_SDA', 'SPI1_SCK'], type: 'gpio' },
      { id: 'gp7', num: 10, label: 'GP7', functions: ['GPIO', 'I2C1_SCL', 'SPI1_TX'], type: 'gpio' },
      { id: 'gp26', num: 11, label: 'GP26 (ADC0)', functions: ['GPIO', 'Analog Input 0', 'ADC0'], type: 'analog' },
      { id: 'gp27', num: 12, label: 'GP27 (ADC1)', functions: ['GPIO', 'Analog Input 1', 'ADC1'], type: 'analog' },
      { id: 'gp28', num: 13, label: 'GP28 (ADC2)', functions: ['GPIO', 'Analog Input 2', 'ADC2'], type: 'analog' },
      { id: 'vsys', num: 14, label: 'VSYS (2-5V)', functions: ['Input System Voltage'], type: 'power' },
      { id: 'v3v3', num: 15, label: '3V3', functions: ['3.3V Output'], type: 'power' },
    ] as Pin[]
  }
};

const DIAGNOSTIC_CASES = [
  {
    title: 'ESP32 Brownout / Constant Bootloops',
    symptom: 'ESP32 plays "Brownout detector was triggered" in Serial Monitor when Wi-Fi or Bluetooth initializes.',
    cause: 'Inadequate mechatronics power supply logic. Wi-Fi peak current draws up to 300mA-400mA, triggering voltage sag below ESP32 minimum operating limit (2.7V) if powered purely from cheap USB chips or weak mechatronics voltage regulators.',
    analogy: 'Imagine trying to run a heavy mechatronics servo motor using a thin sewing thread. When you pull hard (peak power), the thread breaks (voltage sags and resets).',
    solution: [
      'Connect a 10uF to 100uF electrolytic capacitor directly across the 3.3V and GND power pins to absorb peak switching currents.',
      'Power the ESP32 through an external 5V source capable of delivering 1A minimum, stepping down with a quality regulator (e.g., LM1117-3.3V).',
      'Use a higher quality USB cable. Thin copper strands inside cheap cables introduce High Cable Resistance, causing substantial IR voltage drops.'
    ]
  },
  {
    title: 'Unstable Analog (ADC) Sensor Fluctuations',
    symptom: 'An analog infrared or mechatronics sensor reads fluctuating values even when static.',
    cause: 'Electromagnetic interference, high impedance pathways, and lack of internal ADC signal attenuation, alongside high-frequency noise induced by servo PWM lines sharing the same power rail.',
    analogy: 'It is like mechatronics listening to a whisper inside a crowded nightclub. PWM lines are the loud music drowning out the whisper (the quiet ADC sample).',
    solution: [
      'Bridge a 0.1uF ceramic capacitor right at the sensor power lines to shunt high-frequency ripple to Ground.',
      'Implement multi-sample software averaging (moving window average of 32 or 64 samples) to filter transient ADC spikes.',
      'In ESP32, utilize the dedicated ADC Calibration API (`adc1_get_raw()`) and optimize the db attenuation (e.g. `ADC_ATTEN_DB_11` for full scale 0-3.3V).'
    ]
  },
  {
    title: 'I2C Bus Lockups / Resource Collision (SDA/SCL)',
    symptom: 'Wire logic halts at `Wire.endTransmission()` or refuses to boot past sensor initialization.',
    cause: 'Missing physical pull-up resistors on SDA/SCL lines, or long cabling lines whose capacitive load (Capacitance spikes) ruins SCL clock fall/rise times, causing the master controller to wait infinitely for logic acknowledgement.',
    analogy: 'Imagine speaking on a two-way radio where the button gets stuck on high transmit, blocking everyone else from uttering a word.',
    solution: [
      'Add dedicated 4.7kΩ pull-up resistors connected to the VCC rail on both SDA and SCL paths.',
      'Shorten wire lengths for external mechatronics sensors (avoid over 30cm) to reduce bus capacitance.',
      'Configure the I2C speed to standard speed (100kHz) rather than fast speed (400kHz) using `Wire.setClock(100000);`.'
    ]
  },
  {
    title: 'Violent Servo Jittering & Uncontrolled Motion',
    symptom: 'Robotics servo motor twitches, hums loudly, and vibrates aggressively when staying still.',
    cause: 'Servos are sharing the microcontroller logic 5V rail without dedicated power, causing massive back-EMF spikes. Or PWM signals are drifting due to software timing interrupts.',
    analogy: 'This is mechatronics equivalent of muscle spasms. The servo is hungry for smooth current blocks, but receives high voltage background noise instead.',
    solution: [
      'Isolate the servo motor power (VCC) entirely from the ESP32/Arduino 5V/3V3 pins. Use a dedicated NiMH pack or switching regulator (UBEC).',
      'Ensure the external motor GND is connected to the microcontroller GND to build an active potential reference plane.',
      'For ESP32, replace general servo libraries with ESP32-native `ESP32Servo` which uses physical hardware MCPWM pulse timers for stable PWM duty cycles.'
    ]
  }
];

export default function MechatronicsLab({ onClose }: { onClose: () => void }) {
  const [selectedMcu, setSelectedMcu] = useState<'esp32' | 'arduino_uno' | 'pi_pico'>('esp32');
  const [activePin, setActivePin] = useState<Pin | null>(null);
  const [pinConfigs, setPinConfigs] = useState<Record<string, 'INPUT' | 'OUTPUT' | 'PWM' | 'DEFAULT'>>({});
  const [interactiveMode, setInteractiveMode] = useState<'pins' | 'simulation' | 'diagnostics'>('pins');
  
  // PID simulation states
  const [kp, setKp] = useState(1.5);
  const [ki, setKi] = useState(0.05);
  const [kd, setKd] = useState(0.8);
  const [gravity, setGravity] = useState(9.8);
  const [friction, setFriction] = useState(0.12);
  const [torqueLimit, setTorqueLimit] = useState(4.0);
  const [isSimRunning, setIsSimRunning] = useState(true);
  
  // Diagnostic states
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [customSymptom, setCustomSymptom] = useState('');
  const [customDiagnosis, setCustomDiagnosis] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simStateRef = useRef({
    angle: 0.4, // original tilt in radians
    angularVelocity: 0.0,
    cartX: 0.0,
    cartVx: 0.0,
    integral: 0.0,
    prevError: 0.0,
    stabilizedTicks: 0,
    time: 0
  });

  // Pin activation toggle
  const togglePinConfig = (pinId: string, type: 'INPUT' | 'OUTPUT' | 'PWM' | 'DEFAULT') => {
    setPinConfigs(prev => ({
      ...prev,
      [pinId]: type
    }));
  };

  // Auto-generate C++ Code for configuring the mechatronics controller
  const generatedCode = useMemo(() => {
    const list = MCU_DATA[selectedMcu].pins;
    const configured = Object.entries(pinConfigs).filter(([_, val]) => val !== 'DEFAULT');
    
    if (configured.length === 0) {
      return `/* 
 * MHIEE MECHATRONICS AUTOGEN ENGINE v3.1
 * No pins are configured yet. 
 * Click pins on the layout board to adjust GPIO config!
 */

void setup() {
  Serial.begin(115200);
  Serial.println("Mhiee System Initialized! 💅✨");
}

void loop() {
  // Add robotics logic loops here
}`;
    }

    let setupLines = '';
    let loopLines = '// Control loops generated by Mhiee Chitti Core ✨\n';
    
    configured.forEach(([pinId, mode]) => {
      const pinObj = list.find(p => p.id === pinId);
      if (!pinObj) return;

      const variableName = `${pinObj.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_pin`;
      setupLines += `  pinMode(${variableName}, ${mode});\n`;
      
      if (mode === 'OUTPUT') {
        loopLines += `  // Toggle ${pinObj.label}\n`;
        loopLines += `  digitalWrite(${variableName}, HIGH);\n`;
        loopLines += `  delay(1000); // 1-second delay\n`;
        loopLines += `  digitalWrite(${variableName}, LOW);\n`;
        loopLines += `  delay(1000);\n\n`;
      } else if (mode === 'INPUT') {
        loopLines += `  int ${variableName}_val = digitalRead(${variableName});\n`;
        loopLines += `  if (${variableName}_val == HIGH) {\n`;
        loopLines += `     Serial.println("${pinObj.label} Triggered! 📡");\n`;
        loopLines += `  }\n\n`;
      } else if (mode === 'PWM') {
        if (selectedMcu === 'esp32') {
          loopLines += `  // ESP32 PWM Control\n`;
          loopLines += `  ledcWrite(0, 128); // 50% duty cycle on channel 0\n\n`;
        } else {
          loopLines += `  analogWrite(${variableName}, 128); // Write 50% duty cycles\n\n`;
        }
      }
    });

    let headerLines = `/*\n * MHIEE MECHATRONICS AUTOMATIC FIRMWARE PROTOCOL\n * Engineered for Mhiexter Boss 👑\n * Controller: ${MCU_DATA[selectedMcu].name}\n */\n\n`;
    
    configured.forEach(([pinId, _]) => {
      const pinObj = list.find(p => p.id === pinId);
      if (!pinObj) return;
      const variableName = `${pinObj.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_pin`;
      // Map pin number approximation
      headerLines += `const int ${variableName} = ${pinObj.num}; // Configured Mode\n`;
    });

    return `${headerLines}
void setup() {
  Serial.begin(115200);
  while(!Serial);
  Serial.println("Trinity Hardware Handshake Complete 📡✨");
  
${setupLines}}

void loop() {
  ${loopLines}}`;
  }, [selectedMcu, pinConfigs]);

  // Self-Optimizing Inverted Pendulum Simulation Loop
  useEffect(() => {
    if (interactiveMode !== 'simulation' || !isSimRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const runSimulationStep = () => {
      const state = simStateRef.current;
      
      // Error is distance from target angle (0 = perfectly upright vertical)
      const error = state.angle;
      state.integral += error * 0.016;
      // Anti-windup clamping
      state.integral = Math.max(-10, Math.min(10, state.integral));
      const derivative = (error - state.prevError) / 0.016;
      state.prevError = error;

      // PID computes requested balancing torque
      let torque = (kp * error) + (ki * state.integral) + (kd * derivative);
      // Clamp to electrical motor limits
      torque = Math.max(-torqueLimit, Math.min(torqueLimit, torque));

      // Physics Equations of Motion (BACH layout: friction, torque, gravity inputs)
      // Rotational acceleration is driven by gravity pulling the pendulum arm down, 
      // counterbalanced by the stabilizing motor torque, and slowed by joint friction
      const pendulumLength = 100; // in pixels
      const gravityForce = (gravity * Math.sin(state.angle)) / pendulumLength;
      const restoringForce = torque / (pendulumLength * 0.1); 
      const frictionLoss = friction * state.angularVelocity;

      const angularAcceleration = gravityForce - restoringForce - frictionLoss;
      state.angularVelocity += angularAcceleration * 0.16;
      state.angle += state.angularVelocity * 0.16;

      // Ensure angles wrap correctly
      if (state.angle > Math.PI) state.angle -= 2 * Math.PI;
      if (state.angle < -Math.PI) state.angle += 2 * Math.PI;

      // Basic linear cart movement responding to tilt to build balanced visual look
      state.cartVx += torque * 0.5 * 0.16;
      state.cartVx -= state.cartX * 0.1 * 0.16; // restorative spring-like force to center cart
      state.cartX += state.cartVx * 0.16;

      // Track how long the robot has stayed upright
      if (Math.abs(state.angle) < 0.05) {
        state.stabilizedTicks++;
      } else {
        state.stabilizedTicks = 0;
      }

      state.time += 0.016;

      // --- CANVAS DRAWING ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Center layout of the board
      const centerX = canvas.width / 2 + state.cartX;
      const centerY = canvas.height * 0.7;

      // Draw horizontal track line
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.stroke();

      // Track dots
      ctx.fillStyle = '#3f3f46';
      for (let dotX = 20; dotX < canvas.width; dotX += 40) {
        ctx.beginPath();
        ctx.arc(dotX, centerY, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw cart stabilization base
      ctx.fillStyle = '#1e1b4b'; // deep indigo
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(centerX - 40, centerY - 15, 80, 20, 6);
      ctx.fill();
      ctx.stroke();

      // Wheels
      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(centerX - 25, centerY + 10, 10, 0, Math.PI * 2);
      ctx.arc(centerX + 25, centerY + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw encoder pulse lines
      const wheelAngle = state.time * 4 * Math.PI;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      
      // Left wheel line
      ctx.beginPath();
      ctx.moveTo(centerX - 25, centerY + 10);
      ctx.lineTo(centerX - 25 + 10 * Math.cos(wheelAngle), centerY + 10 + 10 * Math.sin(wheelAngle));
      ctx.stroke();

      // Right wheel line
      ctx.beginPath();
      ctx.moveTo(centerX + 25, centerY + 10);
      ctx.lineTo(centerX + 25 + 10 * Math.cos(wheelAngle), centerY + 10 + 10 * Math.sin(wheelAngle));
      ctx.stroke();

      // Draw Pendulum mechatronics pole
      const poleEndX = centerX + pendulumLength * Math.sin(state.angle);
      const poleEndY = centerY - 10 - pendulumLength * Math.cos(state.angle);

      // Shadow glow for stable states
      const isStable = Math.abs(state.angle) < 0.1;
      
      ctx.shadowBlur = isStable ? 20 : 0;
      ctx.shadowColor = isStable ? '#22d3ee' : 'transparent';

      ctx.strokeStyle = isStable ? '#22d3ee' : '#f43f5e';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(poleEndX, poleEndY);
      ctx.stroke();

      // Joint Pivot Pin
      ctx.shadowBlur = 0; // Reset shadow
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Heavy Weight Bob / Gyro gimbal
      ctx.fillStyle = isStable ? '#06b6d4' : '#e11d48';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(poleEndX, poleEndY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner glowing core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(poleEndX, poleEndY, 6, 0, Math.PI * 2);
      ctx.fill();

      // HUD parameters text
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px monospace';
      ctx.fillText(`ANGLE: ${state.angle.toFixed(4)} rad`, 16, 24);
      ctx.fillText(`VELOCITY: ${state.angularVelocity.toFixed(4)} rad/s`, 16, 40);
      ctx.fillText(`KP: ${kp.toFixed(2)} | KD: ${kd.toFixed(2)}`, 16, 56);
      ctx.fillText(`TORQUE EFFORT: ${torque.toFixed(2)} Nm`, 16, 72);
      
      if (isStable) {
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`● MECHATRONICS STABILIZED [${(state.stabilizedTicks / 60).toFixed(1)}s]`, 16, 96);
      } else {
        ctx.fillStyle = '#f43f5e';
        ctx.font = '11px monospace';
        ctx.fillText(`▲ RECOVERY CORRECTION ACTIVE`, 16, 96);
      }

      animId = requestAnimationFrame(runSimulationStep);
    };

    animId = requestAnimationFrame(runSimulationStep);
    return () => cancelAnimationFrame(animId);
  }, [interactiveMode, isSimRunning, kp, ki, kd, gravity, friction, torqueLimit]);

  // AI Diagnostic Process
  const triggerDiagnosis = async () => {
    if (!customSymptom.trim()) return;
    setIsDiagnosing(true);
    setCustomDiagnosis(null);

    // Call simulated delay or actual inference
    setTimeout(() => {
      // Analytical analogical breakdown
      const analysisContent = `
### 🕵️‍♂️ Mhiee AI Deep Circuit Diagnostics (MCT3301 Protocol)

**Boss, na yi neural analysis na wannan mechatronics matsala taka! Ga abin da dabaruna suka dako mana:**

#### 1. INTERNAL ANALOGICAL INTERPRETATION (KWATANCE):
Wannan matsalar tana kama da **"Shegen tartsatsin ruwa"** a mechatronics bututun dake kai wutar lantarki. Lokacin da kake sa ran ruwa ya bazu sumul (smooth DC noise ratio), toshewar bututu (High inductance pathways) ko ambaliya (Back-EMF spikes from inductive motors) na karya dukkan tsarin tace bayanai na microcontroller dinka!

#### 2. ESTIMATED PHYSICAL ROOT CAUSE (BACH LAWS):
* **Voltage drop / IR Loss**: Mechatronics logic rail voltages are dipping below the threshold level (**2.9V**) due to active transient high load.
* **Thermal Ground loops**: Inadequate common reference points are creating small potential variances, turning high-frequency mechatronics return noise into false logic high states inside GPIO arrays.

#### 3. STEP-BY-STEP SOLUTION FOR MHITEXTER BOSS ✨:
1. **Electrolytic Decoupling**: Build a 100uF decoupling reservoir right directly over your MCU power pins.
2. **Optocoupler Isolation**: Isolate all high load actuators (relays/motors) from mechatronics digital lines via PC817 Optocouplers!
3. **Common GND Reference**: Mesh your logic system Ground to avoid floating logic points, and ensure the serial port voltage level stays clean.
`;
      setCustomDiagnosis(analysisContent);
      setIsDiagnosing(false);
    }, 2500);
  };

  return (
    <div className="h-full flex flex-col bg-[#050508] text-zinc-300 font-sans relative overflow-hidden selection:bg-cyan-500/30">
      
      {/* Background Decorative Ambient mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full animate-pulse [animation-delay:4s]" />
      </div>

      {/* Header Panel */}
      <div className="p-4 bg-zinc-950/80 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
                MHIEE <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-300">MECHATRONICS LAB</span> 🦾
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Autonomous Engineering Core // BACH Protocol</p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-800">
          {[
            { id: 'pins', label: 'Hardware Pins', icon: Cpu },
            { id: 'simulation', label: 'PID Simulator', icon: Activity },
            { id: 'diagnostics', label: 'AI Diagnostician', icon: Wrench },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setInteractiveMode(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all ${
                interactiveMode === tab.id
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body Layout */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* INTERACTIVE MODE 1: PINS DESIGNER */}
        {interactiveMode === 'pins' && (
          <div className="flex-grow flex flex-col lg:flex-row overflow-hidden w-full">
            
            {/* Left Wing - MCU Selection and Board Representation */}
            <div className="w-full lg:w-3/5 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar border-r border-zinc-900/40">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select Microcontroller Engine</h3>
                <p className="text-xs text-zinc-500">Pick a board to verify hardware pin configurations, logic thresholds, and autogenerate firmware loops.</p>
              </div>

              {/* Board Quick Selector Cards */}
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(MCU_DATA) as Array<keyof typeof MCU_DATA>).map(key => {
                  const item = MCU_DATA[key];
                  const isCur = selectedMcu === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedMcu(key);
                        setActivePin(null);
                        setPinConfigs({});
                      }}
                      className={`p-4 rounded-2xl text-left border transition-all ${
                        isCur
                          ? 'bg-zinc-900/60 border-cyan-500/40 shadow-inner'
                          : 'bg-zinc-950/20 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className={`text-xs font-black uppercase tracking-tight mb-1 ${isCur ? 'text-cyan-400' : 'text-zinc-400'}`}>
                        {key === 'esp32' ? 'ESP32 Dual Core' : key === 'arduino_uno' ? '8-Bit AVR Uno' : '32-Bit Dual RP'}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-tight line-clamp-2">{item.description}</div>
                    </button>
                  );
                })}
              </div>

              {/* GORGEOUS MC BOARD DISPLAY */}
              <div className="p-6 bg-zinc-950/60 border border-zinc-900 rounded-[2rem] flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
                <div className="absolute top-2 right-3 py-1 px-2.5 bg-black/40 rounded-full border border-white/5 text-[9px] text-zinc-500 font-mono">
                  LOGIC STAGES: 0V - 3.3V / 5.0V Dual
                </div>

                <div className="text-center mb-6">
                  <h4 className="text-md font-black text-white italic tracking-tight">{MCU_DATA[selectedMcu].name}</h4>
                  <p className="text-[10px] text-zinc-500 max-w-md mx-auto mt-1 leading-relaxed">
                    Click any physical pin label below to inspect hardware interrupt blocks, ADC attenuation lines, and I2C buses.
                  </p>
                </div>

                {/* THE CHIP PCB BODY */}
                <div className="w-full max-w-sm rounded-3xl bg-[#091a13] border-4 border-[#072517] p-4 flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative">
                  
                  {/* Internal PCB Paths */}
                  <div className="absolute inset-4 border border-emerald-500/5 rounded-2xl pointer-events-none" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-6 bg-zinc-800 rounded-b-xl border border-zinc-700 flex items-center justify-center text-[8px] text-zinc-400 font-mono tracking-widest shadow-inner">
                    USB PORT
                  </div>

                  {/* Onboard Central Chip Block */}
                  <div className="mx-auto w-32 h-32 rounded-2xl bg-[#111111] border-2 border-zinc-800/50 flex flex-col items-center justify-center relative p-3 text-center shadow-2xl my-4">
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-[#d4af37] rounded-full" />
                    <Cpu className="w-8 h-8 text-cyan-400/80 animate-pulse mb-1" />
                    <span className="text-[9px] font-black text-white font-mono leading-none">MHIEE SILICON</span>
                    <span className="text-[7px] text-zinc-600 font-mono mt-0.5 tracking-wider">TRINITY V3.1</span>
                  </div>

                  {/* Dual Wing Pins layout */}
                  <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 w-full relative z-10 px-2">
                    {MCU_DATA[selectedMcu].pins.map((pin) => {
                      const isActive = activePin?.id === pin.id;
                      const hasConfig = pinConfigs[pin.id] && pinConfigs[pin.id] !== 'DEFAULT';
                      
                      let badgeColor = 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400';
                      if (isActive) badgeColor = 'bg-cyan-500/20 border-cyan-400 text-cyan-200';
                      else if (hasConfig) badgeColor = 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300';
                      else if (pin.type === 'power') badgeColor = 'bg-red-500/10 border-red-500/30 text-red-400';
                      else if (pin.type === 'ground') badgeColor = 'bg-zinc-800/60 border-zinc-700 text-zinc-500';

                      return (
                        <button
                          key={pin.id}
                          onClick={() => {
                            setActivePin(pin);
                            if (!pinConfigs[pin.id]) {
                              setPinConfigs(prev => ({ ...prev, [pin.id]: 'DEFAULT' }));
                            }
                          }}
                          className={`py-2 px-3 text-[10px] font-mono font-bold rounded-xl border text-left transition-all flex items-center justify-between gap-1 select-none ${badgeColor}`}
                        >
                          <span className="truncate">{pin.label}</span>
                          <span className="text-[8px] opacity-40">#{pin.num}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Wing - Active Pin configuration & Autocode */}
            <div className="w-full lg:w-2/5 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-zinc-950/40">
              
              {/* PIN CONTROL BLOCK */}
              <div className="p-5 bg-zinc-900/60 border border-zinc-850 rounded-[2rem] flex flex-col gap-4 shadow-inner">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Pin Configurer</h3>
                    <p className="text-xs text-zinc-500">Tune operational structures and watch Mhiee regenerate C++ syntax instantly.</p>
                  </div>
                  {activePin && (
                    <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300 text-[9px] font-black uppercase font-mono">
                      Pin #{activePin.num} Active
                    </span>
                  )}
                </div>

                {activePin ? (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-850">
                      <div className="text-lg font-black text-white font-mono">{activePin.label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 uppercase tracking-widest font-mono">
                        Hardware Block: {activePin.type || 'GPIO'}
                      </div>
                      
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {activePin.functions.map((f, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] text-zinc-400 font-mono">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Operational Tuning Buttons */}
                    {activePin.type !== 'power' && activePin.type !== 'ground' && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Select Signal Mode</div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'DEFAULT', label: 'Default' },
                            { id: 'INPUT', label: 'INPUT' },
                            { id: 'OUTPUT', label: 'OUTPUT' },
                            { id: 'PWM', label: 'PWM' },
                          ].map(mode => {
                            const isSelected = (pinConfigs[activePin.id] || 'DEFAULT') === mode.id;
                            return (
                              <button
                                key={mode.id}
                                onClick={() => togglePinConfig(activePin.id, mode.id as any)}
                                className={`py-2 rounded-xl text-[10px] font-black tracking-tight transition-all border ${
                                  isSelected
                                    ? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-lg shadow-cyan-950/20'
                                    : 'bg-zinc-950/50 border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-910'
                                }`}
                              >
                                {mode.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-zinc-800/80 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
                    <HelpCircle className="w-8 h-8 text-zinc-700 animate-bounce" />
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                      "Haba Boss, danna kowane pin label a left-side domin in bincika maka dukkan functionalities dake tare dashi! 💅"
                    </p>
                  </div>
                )}
              </div>

              {/* AUTOMATIC CODE REPRESENTATION DISPLAY */}
              <div className="flex-grow flex flex-col rounded-[2rem] border border-zinc-850/80 bg-zinc-950 overflow-hidden shadow-2xl min-h-[250px]">
                <div className="p-4 bg-zinc-900/40 border-b border-zinc-850 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-cyan-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest font-mono">Autogen firmware code (.ino)</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                    }}
                    className="p-1 px-3 bg-zinc-800 hover:bg-zinc-750 text-[10px] font-bold text-zinc-300 rounded-lg transition-colors border border-zinc-700/50"
                  >
                    Copy code
                  </button>
                </div>
                
                <div className="flex-grow p-4 overflow-auto custom-scrollbar font-mono text-xs text-emerald-400">
                  <pre className="text-left select-text whitespace-pre bg-transparent leading-relaxed">{generatedCode}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INTERACTIVE MODE 2: PID ROTATIONAL SIMULATION */}
        {interactiveMode === 'simulation' && (
          <div className="flex-grow flex flex-col lg:flex-row overflow-hidden w-full">
            
            {/* Visual simulation stage on Left */}
            <div className="flex-1 p-6 flex flex-col gap-6 items-center justify-center overflow-y-auto custom-scrollbar">
              <div className="w-full max-w-lg mb-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">PID Self-Balancing System</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Real-time inverted pendulum and reaction wheel stabilization test. Simulates gravity, torque acceleration, and joint friction inside an integrated 60Hz physics core.
                </p>
              </div>

              {/* The simulation CANVAS element */}
              <div className="w-full max-w-lg aspect-video rounded-3xl bg-[#09090b] border border-zinc-800 overflow-hidden shadow-2xl relative">
                <canvas 
                  ref={canvasRef} 
                  width={500} 
                  height={280} 
                  className="w-full h-full object-contain"
                />

                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button 
                    onClick={() => setIsSimRunning(!isSimRunning)}
                    className="p-2 bg-black/60 hover:bg-black text-white rounded-xl border border-white/5 transition-all text-xs flex items-center justify-center"
                  >
                    {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button 
                    onClick={() => {
                      simStateRef.current = {
                        angle: (Math.random() - 0.5) * 1.0, // set random starting tilt
                        angularVelocity: 0.0,
                        cartX: 0.0,
                        cartVx: 0.0,
                        integral: 0.0,
                        prevError: 0.0,
                        stabilizedTicks: 0,
                        time: 0
                      };
                    }}
                    className="p-2 bg-black/60 hover:bg-black text-white rounded-xl border border-white/5 transition-all text-xs flex items-center justify-center"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-2xl max-w-lg text-[10px] leading-relaxed text-zinc-500 italic">
                <strong>Physics breakdown (MCT1301/BACH Protocol):</strong> When gravity pulls the heavy cylinder outward, an electrical corrective current fires to spin the stabilization wheel, inducing an equal and opposite Torque reaction. Tuning Ki controls steady-state offset drift while Kd dampens high-frequency oscillations!
              </div>
            </div>

            {/* PID Tuning Controls on Right */}
            <div className="w-full lg:w-[350px] p-6 bg-zinc-950/40 border-l border-zinc-900/40 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">System Parameters Tuning</h4>
                <p className="text-[10px] text-zinc-500">Slide values to optimize balancing times or watch the pendulum tumble on incorrect tuning.</p>
              </div>

              {/* PID sliders */}
              <div className="space-y-4">
                <div className="text-[10px] font-black text-cyan-400/80 uppercase tracking-widest">PID Coefficients</div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-mono">Proportional Gain (Kp)</span>
                    <span className="font-mono font-bold">{kp.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="10" step="0.1" value={kp} 
                    onChange={(e) => setKp(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-mono">Integral Gain (Ki)</span>
                    <span className="font-mono font-bold">{ki.toFixed(3)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="0.5" step="0.005" value={ki} 
                    onChange={(e) => setKi(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-mono">Derivative Gain (Kd)</span>
                    <span className="font-mono font-bold">{kd.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="5" step="0.05" value={kd} 
                    onChange={(e) => setKd(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              </div>

              <div className="h-px bg-zinc-900" />

              {/* Environmental Constraints */}
              <div className="space-y-4">
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Gravity & Actuator Limits</div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-mono">Simulated Gravity</span>
                    <span className="font-mono font-bold">{gravity.toFixed(1)} m/s²</span>
                  </div>
                  <input 
                    type="range" min="0" max="25" step="0.5" value={gravity} 
                    onChange={(e) => setGravity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-mono">Motor Torque Limit</span>
                    <span className="font-mono font-bold">{torqueLimit.toFixed(1)} Nm</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="15" step="0.5" value={torqueLimit} 
                    onChange={(e) => setTorqueLimit(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-mono">Joint Friction losses</span>
                    <span className="font-mono font-bold">{friction.toFixed(3)} Nms</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" value={friction} 
                    onChange={(e) => setFriction(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={() => {
                    setKp(1.8); setKi(0.01); setKd(1.2); setGravity(9.8); setFriction(0.12); setTorqueLimit(5.0);
                  }}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-white rounded-xl border border-zinc-800 transition-all text-center"
                >
                  Ideal Earth Preset
                </button>
                <button 
                  onClick={() => {
                    setKp(3.5); setKi(0.05); setKd(0.5); setGravity(1.62); setFriction(0.03); setTorqueLimit(2.0);
                  }}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-white rounded-xl border border-zinc-800 transition-all text-center"
                >
                  Sparsely Damped Moon
                </button>
              </div>

            </div>
          </div>
        )}

        {/* INTERACTIVE MODE 3: DIAGNOSTICS DEEP LOGS */}
        {interactiveMode === 'diagnostics' && (
          <div className="flex-grow flex flex-col overflow-y-auto custom-scrollbar p-6 gap-6 w-full">
            <div className="flex justify-between items-center max-w-3xl">
              <div>
                <h3 className="text-md font-black text-white uppercase tracking-wider">AI mechatronics Diagnostician</h3>
                <p className="text-xs text-zinc-500">Pick standard mechatronics hardware diagnostics cases or run our deep intelligence analysis.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-stretch max-w-6xl">
              
              {/* Presets List left */}
              <div className="lg:col-span-1 flex flex-col gap-3">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Standard Hardware Anomalies</div>
                {DIAGNOSTIC_CASES.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedCase(idx);
                      setCustomDiagnosis(null);
                    }}
                    className={`p-4 text-left rounded-3xl border transition-all flex flex-col gap-1.5 ${
                      selectedCase === idx
                        ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                        : 'bg-zinc-950/20 border-zinc-900 hover:border-zinc-850'
                    }`}
                  >
                    <span className="text-xs font-black text-white tracking-tight">{item.title}</span>
                    <span className="text-[10px] text-zinc-500 leading-normal line-clamp-2">{item.symptom}</span>
                  </button>
                ))}
              </div>

              {/* Analysis Response Center on Right */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="p-6 bg-zinc-900/40 border border-zinc-850 rounded-[2rem] flex flex-col gap-4 shadow-2xl relative overflow-hidden min-h-[350px]">
                  
                  {selectedCase !== null && customDiagnosis === null ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                        <h4 className="text-md font-bold text-cyan-300">{DIAGNOSTIC_CASES[selectedCase].title}</h4>
                        <button 
                          onClick={() => setSelectedCase(null)}
                          className="text-[10px] hover:text-white text-zinc-500 uppercase font-mono"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="space-y-4 text-sm leading-relaxed text-zinc-300 select-text">
                        <div>
                          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Symptom Reported</div>
                          <p className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-900 text-xs italic text-zinc-400 font-mono">"{DIAGNOSTIC_CASES[selectedCase].symptom}"</p>
                        </div>
                        
                        <div>
                          <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Root Cause Breakdown</div>
                          <p className="text-xs leading-normal">{DIAGNOSTIC_CASES[selectedCase].cause}</p>
                        </div>

                        <div>
                          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Analogy (Kwatance)</div>
                          <p className="text-xs leading-normal bg-indigo-505/10 border border-indigo-500/20 p-3.5 rounded-2xl text-indigo-200">
                            {DIAGNOSTIC_CASES[selectedCase].analogy}
                          </p>
                        </div>

                        <div>
                          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Ground Hardware Solutions
                          </div>
                          <ul className="list-decimal pl-4 space-y-2 text-xs">
                            {DIAGNOSTIC_CASES[selectedCase].solution.map((step, idx) => (
                              <li key={idx} className="leading-normal">{step}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : customDiagnosis ? (
                    <div className="space-y-4 text-sm text-zinc-300 leading-relaxed font-mono select-text whitespace-pre-line">
                      {customDiagnosis}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center gap-4 border-2 border-dashed border-zinc-850 rounded-2xl h-full min-h-[250px]">
                      <ShieldAlert className="w-12 h-12 text-zinc-700" />
                      <div>
                        <p className="text-xs font-bold text-zinc-400">No active anomaly inspection running.</p>
                        <p className="text-[11px] text-zinc-650 max-w-sm mt-1 leading-relaxed">
                          Pick an anomaly from the left panel, or submit custom serial telemetry below to trigger Mhiee's diagnostic processors.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Telemetry Entry Input */}
                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-[2rem] flex flex-col md:flex-row gap-3 items-stretch shadow-inner">
                  <input
                    type="text"
                    value={customSymptom}
                    onChange={(e) => setCustomSymptom(e.target.value)}
                    placeholder="Describe custom mechatronics issue (e.g. Servo twitches when ultrasonic fires)..."
                    className="flex-grow p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-white outline-none focus:border-cyan-500/50 transition-colors font-mono"
                  />
                  <button
                    onClick={triggerDiagnosis}
                    disabled={isDiagnosing || !customSymptom.trim()}
                    className="px-6 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-950/50 shrink-0 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {isDiagnosing ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Diagnosing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Force Infiltration Anomaly
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer System info */}
      <div className="p-3 bg-zinc-950/80 border-t border-zinc-900 flex justify-between items-center text-[9px] text-zinc-600 font-mono tracking-widest uppercase">
        <span>Trinity Node Online</span>
        <span className="hidden sm:inline">ADUSTECH Mechatronics Suite // v3.1</span>
        <span>Mhiee Browser 💅</span>
      </div>
    </div>
  );
}
