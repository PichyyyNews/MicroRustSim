import React from 'react';
import esp32SvgUrl from '../assets/Boards/esp32/doit_esp32.svg';

interface Esp32BoardProps {
  pin2Lit?: boolean;
  onPinMouseDown?: (pinName: string, e: React.MouseEvent) => void;
}

// 1:1 Pin Coordinates mapped to 160px x 296px board rendering
export const ESP32_PINS: Record<string, { x: number; y: number; desc: string; voltage: string }> = {
  // Left Column (Top to Bottom)
  'EN': { x: 8.5, y: 35.9, desc: 'Enable / Reset (Active Low)', voltage: '3.3V' },
  'VP': { x: 8.5, y: 50.9, desc: 'GPIO36 / ADC1_CH0 / SENSOR_VP (Input Only)', voltage: '3.3V' },
  'GPIO36': { x: 8.5, y: 50.9, desc: 'GPIO36 / ADC1_CH0 / SENSOR_VP (Input Only)', voltage: '3.3V' },
  'VN': { x: 8.5, y: 64.9, desc: 'GPIO39 / ADC1_CH3 / SENSOR_VN (Input Only)', voltage: '3.3V' },
  'GPIO39': { x: 8.5, y: 64.9, desc: 'GPIO39 / ADC1_CH3 / SENSOR_VN (Input Only)', voltage: '3.3V' },
  'D34': { x: 8.5, y: 78.5, desc: 'GPIO34 / ADC1_CH6 (Input Only)', voltage: '3.3V' },
  'GPIO34': { x: 8.5, y: 78.5, desc: 'GPIO34 / ADC1_CH6 (Input Only)', voltage: '3.3V' },
  '34': { x: 8.5, y: 78.5, desc: 'GPIO34 / ADC1_CH6 (Input Only)', voltage: '3.3V' },
  'D35': { x: 8.5, y: 92.4, desc: 'GPIO35 / ADC1_CH7 (Input Only)', voltage: '3.3V' },
  'GPIO35': { x: 8.5, y: 92.4, desc: 'GPIO35 / ADC1_CH7 (Input Only)', voltage: '3.3V' },
  '35': { x: 8.5, y: 92.4, desc: 'GPIO35 / ADC1_CH7 (Input Only)', voltage: '3.3V' },
  'D32': { x: 8.5, y: 105.4, desc: 'GPIO32 / ADC1_CH4 / Touch9', voltage: '3.3V' },
  'GPIO32': { x: 8.5, y: 105.4, desc: 'GPIO32 / ADC1_CH4 / Touch9', voltage: '3.3V' },
  '32': { x: 8.5, y: 105.4, desc: 'GPIO32 / ADC1_CH4 / Touch9', voltage: '3.3V' },
  'D33': { x: 8.5, y: 119.6, desc: 'GPIO33 / ADC1_CH5 / Touch8', voltage: '3.3V' },
  'GPIO33': { x: 8.5, y: 119.6, desc: 'GPIO33 / ADC1_CH5 / Touch8', voltage: '3.3V' },
  '33': { x: 8.5, y: 119.6, desc: 'GPIO33 / ADC1_CH5 / Touch8', voltage: '3.3V' },
  'D25': { x: 8.5, y: 133.4, desc: 'GPIO25 / DAC1 / ADC2_CH8', voltage: '3.3V' },
  'GPIO25': { x: 8.5, y: 133.4, desc: 'GPIO25 / DAC1 / ADC2_CH8', voltage: '3.3V' },
  '25': { x: 8.5, y: 133.4, desc: 'GPIO25 / DAC1 / ADC2_CH8', voltage: '3.3V' },
  'D26': { x: 8.5, y: 148.1, desc: 'GPIO26 / DAC2 / ADC2_CH9', voltage: '3.3V' },
  'GPIO26': { x: 8.5, y: 148.1, desc: 'GPIO26 / DAC2 / ADC2_CH9', voltage: '3.3V' },
  '26': { x: 8.5, y: 148.1, desc: 'GPIO26 / DAC2 / ADC2_CH9', voltage: '3.3V' },
  'D27': { x: 8.5, y: 161.6, desc: 'GPIO27 / ADC2_CH7 / Touch7', voltage: '3.3V' },
  'GPIO27': { x: 8.5, y: 161.6, desc: 'GPIO27 / ADC2_CH7 / Touch7', voltage: '3.3V' },
  '27': { x: 8.5, y: 161.6, desc: 'GPIO27 / ADC2_CH7 / Touch7', voltage: '3.3V' },
  'D14': { x: 8.5, y: 175.7, desc: 'GPIO14 / HSPI_CLK / ADC2_CH6', voltage: '3.3V' },
  'GPIO14': { x: 8.5, y: 175.7, desc: 'GPIO14 / HSPI_CLK / ADC2_CH6', voltage: '3.3V' },
  '14': { x: 8.5, y: 175.7, desc: 'GPIO14 / HSPI_CLK / ADC2_CH6', voltage: '3.3V' },
  'D12': { x: 8.5, y: 189.1, desc: 'GPIO12 / HSPI_MISO / ADC2_CH5', voltage: '3.3V' },
  'GPIO12': { x: 8.5, y: 189.1, desc: 'GPIO12 / HSPI_MISO / ADC2_CH5', voltage: '3.3V' },
  '12': { x: 8.5, y: 189.1, desc: 'GPIO12 / HSPI_MISO / ADC2_CH5', voltage: '3.3V' },
  'D13': { x: 8.5, y: 203.8, desc: 'GPIO13 / HSPI_MOSI / ADC2_CH4', voltage: '3.3V' },
  'GPIO13': { x: 8.5, y: 203.8, desc: 'GPIO13 / HSPI_MOSI / ADC2_CH4', voltage: '3.3V' },
  '13': { x: 8.5, y: 203.8, desc: 'GPIO13 / HSPI_MOSI / ADC2_CH4', voltage: '3.3V' },
  'GND': { x: 8.5, y: 218.4, desc: 'System Ground (0V)', voltage: '0V' },
  'GND.1': { x: 8.5, y: 218.4, desc: 'System Ground (0V)', voltage: '0V' },
  'VIN': { x: 8.5, y: 232.0, desc: 'External Power / USB 5V Input', voltage: '5V' },
  '5V': { x: 8.5, y: 232.0, desc: 'External Power / USB 5V Input', voltage: '5V' },

  // Right Column (Top to Bottom)
  'D23': { x: 151.2, y: 36.9, desc: 'GPIO23 / VSPI_MOSI', voltage: '3.3V' },
  'GPIO23': { x: 151.2, y: 36.9, desc: 'GPIO23 / VSPI_MOSI', voltage: '3.3V' },
  '23': { x: 151.2, y: 36.9, desc: 'GPIO23 / VSPI_MOSI', voltage: '3.3V' },
  'D22': { x: 151.2, y: 51.9, desc: 'GPIO22 / I2C_SCL', voltage: '3.3V' },
  'GPIO22': { x: 151.2, y: 51.9, desc: 'GPIO22 / I2C_SCL', voltage: '3.3V' },
  'SCL': { x: 151.2, y: 51.9, desc: 'GPIO22 / I2C_SCL', voltage: '3.3V' },
  '22': { x: 151.2, y: 51.9, desc: 'GPIO22 / I2C_SCL', voltage: '3.3V' },
  'TX0': { x: 151.2, y: 66.0, desc: 'GPIO1 / UART0_TXD (Serial)', voltage: '3.3V' },
  'GPIO1': { x: 151.2, y: 66.0, desc: 'GPIO1 / UART0_TXD (Serial)', voltage: '3.3V' },
  '1': { x: 151.2, y: 66.0, desc: 'GPIO1 / UART0_TXD (Serial)', voltage: '3.3V' },
  'RX0': { x: 151.2, y: 79.6, desc: 'GPIO3 / UART0_RXD (Serial)', voltage: '3.3V' },
  'GPIO3': { x: 151.2, y: 79.6, desc: 'GPIO3 / UART0_RXD (Serial)', voltage: '3.3V' },
  '3': { x: 151.2, y: 79.6, desc: 'GPIO3 / UART0_RXD (Serial)', voltage: '3.3V' },
  'D21': { x: 151.2, y: 93.5, desc: 'GPIO21 / I2C_SDA', voltage: '3.3V' },
  'GPIO21': { x: 151.2, y: 93.5, desc: 'GPIO21 / I2C_SDA', voltage: '3.3V' },
  'SDA': { x: 151.2, y: 93.5, desc: 'GPIO21 / I2C_SDA', voltage: '3.3V' },
  '21': { x: 151.2, y: 93.5, desc: 'GPIO21 / I2C_SDA', voltage: '3.3V' },
  'D19': { x: 151.2, y: 106.4, desc: 'GPIO19 / VSPI_MISO', voltage: '3.3V' },
  'GPIO19': { x: 151.2, y: 106.4, desc: 'GPIO19 / VSPI_MISO', voltage: '3.3V' },
  '19': { x: 151.2, y: 106.4, desc: 'GPIO19 / VSPI_MISO', voltage: '3.3V' },
  'D18': { x: 151.2, y: 120.7, desc: 'GPIO18 / VSPI_CLK', voltage: '3.3V' },
  'GPIO18': { x: 151.2, y: 120.7, desc: 'GPIO18 / VSPI_CLK', voltage: '3.3V' },
  '18': { x: 151.2, y: 120.7, desc: 'GPIO18 / VSPI_CLK', voltage: '3.3V' },
  'D5': { x: 151.2, y: 134.4, desc: 'GPIO5 / VSPI_CS / Strapping', voltage: '3.3V' },
  'GPIO5': { x: 151.2, y: 134.4, desc: 'GPIO5 / VSPI_CS / Strapping', voltage: '3.3V' },
  '5': { x: 151.2, y: 134.4, desc: 'GPIO5 / VSPI_CS / Strapping', voltage: '3.3V' },
  'TX2': { x: 151.2, y: 149.1, desc: 'GPIO17 / UART2_TXD', voltage: '3.3V' },
  'GPIO17': { x: 151.2, y: 149.1, desc: 'GPIO17 / UART2_TXD', voltage: '3.3V' },
  '17': { x: 151.2, y: 149.1, desc: 'GPIO17 / UART2_TXD', voltage: '3.3V' },
  'RX2': { x: 151.2, y: 162.7, desc: 'GPIO16 / UART2_RXD', voltage: '3.3V' },
  'GPIO16': { x: 151.2, y: 162.7, desc: 'GPIO16 / UART2_RXD', voltage: '3.3V' },
  '16': { x: 151.2, y: 162.7, desc: 'GPIO16 / UART2_RXD', voltage: '3.3V' },
  'D4': { x: 151.2, y: 176.8, desc: 'GPIO4 / ADC2_CH0 / Touch0', voltage: '3.3V' },
  'GPIO4': { x: 151.2, y: 176.8, desc: 'GPIO4 / ADC2_CH0 / Touch0', voltage: '3.3V' },
  '4': { x: 151.2, y: 176.8, desc: 'GPIO4 / ADC2_CH0 / Touch0', voltage: '3.3V' },
  'D2': { x: 151.2, y: 190.2, desc: 'GPIO2 / Onboard LED / ADC2_CH2', voltage: '3.3V' },
  'GPIO2': { x: 151.2, y: 190.2, desc: 'GPIO2 / Onboard LED / ADC2_CH2', voltage: '3.3V' },
  '2': { x: 151.2, y: 190.2, desc: 'GPIO2 / Onboard LED / ADC2_CH2', voltage: '3.3V' },
  'D15': { x: 151.2, y: 204.9, desc: 'GPIO15 / ADC2_CH3 / Touch3 / Strapping', voltage: '3.3V' },
  'GPIO15': { x: 151.2, y: 204.9, desc: 'GPIO15 / ADC2_CH3 / Touch3 / Strapping', voltage: '3.3V' },
  '15': { x: 151.2, y: 204.9, desc: 'GPIO15 / ADC2_CH3 / Touch3 / Strapping', voltage: '3.3V' },
  'GND.2': { x: 151.2, y: 219.4, desc: 'System Ground (0V)', voltage: '0V' },
  '3V3': { x: 151.2, y: 233.0, desc: 'Regulated 3.3V Power Rail Output', voltage: '3.3V' },
  '3.3V': { x: 151.2, y: 233.0, desc: 'Regulated 3.3V Power Rail Output', voltage: '3.3V' },
};

export const DISPLAY_ESP32_PINS: [string, { x: number; y: number; desc: string; voltage: string }][] = [
  // Left 15 pins
  ['EN', ESP32_PINS['EN']],
  ['VP', ESP32_PINS['VP']],
  ['VN', ESP32_PINS['VN']],
  ['D34', ESP32_PINS['D34']],
  ['D35', ESP32_PINS['D35']],
  ['D32', ESP32_PINS['D32']],
  ['D33', ESP32_PINS['D33']],
  ['D25', ESP32_PINS['D25']],
  ['D26', ESP32_PINS['D26']],
  ['D27', ESP32_PINS['D27']],
  ['D14', ESP32_PINS['D14']],
  ['D12', ESP32_PINS['D12']],
  ['D13', ESP32_PINS['D13']],
  ['GND', ESP32_PINS['GND']],
  ['VIN', ESP32_PINS['VIN']],

  // Right 15 pins
  ['D23', ESP32_PINS['D23']],
  ['D22', ESP32_PINS['D22']],
  ['TX0', ESP32_PINS['TX0']],
  ['RX0', ESP32_PINS['RX0']],
  ['D21', ESP32_PINS['D21']],
  ['D19', ESP32_PINS['D19']],
  ['D18', ESP32_PINS['D18']],
  ['D5', ESP32_PINS['D5']],
  ['TX2', ESP32_PINS['TX2']],
  ['RX2', ESP32_PINS['RX2']],
  ['D4', ESP32_PINS['D4']],
  ['D2', ESP32_PINS['D2']],
  ['D15', ESP32_PINS['D15']],
  ['GND.2', ESP32_PINS['GND.2']],
  ['3V3', ESP32_PINS['3V3']],
];

export const Esp32Board: React.FC<Esp32BoardProps> = ({ pin2Lit = false, onPinMouseDown }) => {
  return (
    <div
      className="relative w-[160px] h-[296px] select-none filter drop-shadow-2xl"
      style={{ width: '160px', height: '296px' }}
    >
      {/* Official Vector SVG Board Art */}
      <img
        src={esp32SvgUrl}
        alt="DOIT ESP32 DevKit V1"
        className="w-full h-full pointer-events-none select-none block"
        draggable={false}
      />

      {/* Dynamic Status LEDs Overlay */}
      {/* Power LED (Red) near USB connector */}
      <div
        title="ESP32 Power LED (3.3V OK)"
        className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444] pointer-events-none"
        style={{ left: '72px', top: '254px' }}
      />

      {/* Builtin Blue LED (GPIO 2) */}
      <div
        id="builtin-led-gpio2"
        data-led="builtin-gpio2"
        title="Builtin LED (GPIO 2 - Blue)"
        className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none transition-all duration-75"
        style={{
          left: '88px',
          top: '254px',
          backgroundColor: pin2Lit ? '#3b82f6' : 'rgba(30, 58, 138, 0.4)',
          opacity: pin2Lit ? 1.0 : 0.3,
          boxShadow: pin2Lit ? '0 0 8px #60a5fa' : 'none',
        }}
      />

      {/* Interactive Pin Holes Overlay (Exact 30 Pin Pads) */}
      {DISPLAY_ESP32_PINS.map(([name, pin]) => (
        <div
          key={name}
          title={`Pin ${name}: ${pin.desc} [${pin.voltage}]`}
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent hover:border-blue-400 hover:bg-blue-400/90 hover:scale-125 hover:shadow-[0_0_8px_rgba(96,165,250,0.9)] hover:ring-1 hover:ring-blue-300 transition-all cursor-crosshair z-30 flex items-center justify-center group"
          style={{ left: `${pin.x}px`, top: `${pin.y}px` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPinMouseDown?.(name, e);
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-zinc-950 transition-colors" />
        </div>
      ))}
    </div>
  );
};
