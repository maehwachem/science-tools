// 마이크로비트 전압 기록기 — 셀 전압을 블루투스(UART)로 보냄
// 연결: 구리판(+) → 10 kΩ 저항 → P1,  마그네슘판(−) → GND
// 한 줄에 보내는 값: 시간(ms),P1 값 32번의 합,P2 값 32번의 합,32
let connected = false
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
basic.forever(function () {
    let s1 = 0
    let s2 = 0
    for (let index = 0; index <= 31; index++) {
        s1 += pins.analogReadPin(AnalogPin.P1)
        s2 += pins.analogReadPin(AnalogPin.P2)
    }
    if (connected) {
        bluetooth.uartWriteLine("" + input.runningTime() + "," + s1 + "," + s2 + ",32")
    }
    basic.pause(100)
})
