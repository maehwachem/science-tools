// 마이크로비트 온도 기록기 — 방수 온도 센서(DS18B20) 값을 블루투스(UART)로 보냄
// 확장: bluetooth, dstemp (github:bsiever/microbit-dstemp)
// 연결: 센서 빨강 → 3V, 검정 → GND, 노랑(또는 흰색) → P1. 두 번째 센서는 P2
//       선만 있는 센서는 노랑(데이터)과 3V 사이에 4.7 kΩ 저항을 하나씩 이음
// 한 줄에 보내는 값: T,시간(ms),센서1 온도×100,센서2 온도×100 (읽지 못하면 x)
let connected = false
let t1 = 0
let t2 = 0
function code(t: number): string {
    if (t > -300) {
        return "" + Math.round(t * 100)
    }
    return "x"
}
bluetooth.startUartService()
basic.showIcon(IconNames.Diamond)
bluetooth.onBluetoothConnected(function () {
    connected = true
    basic.showIcon(IconNames.Yes)
})
bluetooth.onBluetoothDisconnected(function () {
    connected = false
    basic.showIcon(IconNames.Diamond)
})
input.onButtonPressed(Button.A, function () {
    basic.showNumber(Math.round(t1 * 10) / 10)
})
basic.forever(function () {
    t1 = dstemp.celsius(DigitalPin.P1)
    t2 = dstemp.celsius(DigitalPin.P2)
    if (connected) {
        bluetooth.uartWriteLine("T," + input.runningTime() + "," + code(t1) + "," + code(t2))
    }
    basic.pause(100)
})
